import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { deduplicationService } from '../services/deduplicationService.js';
import { copywritingService } from '../services/copywritingService.js';
import { wahaClient } from '../services/wahaClient.js';
import { NewsJobData } from './queueManager.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createNewsWorker() {
  const worker = new Worker<NewsJobData>(
    'news-queue',
    async (job: Job<NewsJobData>) => {
      const { postId } = job.data;
      console.log(`[NewsWorker] Processing news job ${job.id} for post ${postId}`);

      // 1. Fetch Post record
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new Error(`Post with id ${postId} not found`);
      }

      await prisma.post.update({
        where: { id: postId },
        data: { status: 'PROCESSING' },
      });

      // 2. Check Daily Limit
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const sentCountToday = await prisma.post.count({
        where: {
          type: 'NEWS',
          status: 'SENT',
          sentAt: { gte: startOfDay },
        },
      });

      if (sentCountToday >= env.DAILY_NEWS_LIMIT) {
        console.warn(`[NewsWorker] Daily limit reached (${sentCountToday}/${env.DAILY_NEWS_LIMIT}). Rejecting news post.`);
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'FAILED',
            duplicateReason: `Daily news broadcast quota limit reached (${sentCountToday}/${env.DAILY_NEWS_LIMIT}).`,
          },
        });
        return { status: 'LIMIT_EXCEEDED', sentCountToday };
      }

      // 3. Extract text content & title for AI Deduplication
      const payload: any = post.rawPayload || {};
      const candidateTitle = payload.title || payload.caption || '';
      const candidateContent = payload.content || payload.text || payload.body || candidateTitle;

      // 4. AI Deduplication with Gemini
      console.log(`[NewsWorker] Running AI Deduplication against past 24h news...`);
      const dedupResult = await deduplicationService.checkDuplicate(
        candidateContent,
        candidateTitle
      );

      if (dedupResult.isDuplicate) {
        console.log(`[NewsWorker] AI blocked duplicate news: ${dedupResult.reason}`);
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'DUPLICATE',
            duplicateReason: dedupResult.reason,
          },
        });
        return { status: 'DUPLICATE', reason: dedupResult.reason };
      }

      // 5. AI Copywriting with Gemini: WhatsApp-friendly Tamil bulletin
      console.log(`[NewsWorker] Generating WhatsApp Tamil bulletin copy with Gemini...`);
      const formattedText = await copywritingService.formatNewsForWhatsApp({
        title: candidateTitle,
        content: candidateContent,
        sourceUrl: payload.sourceUrl,
        sourceName: payload.sourceName,
      });

      // 6. Find Active Destination Groups for NEWS
      const destinationGroups = await prisma.group.findMany({
        where: {
          role: 'DESTINATION',
          type: 'NEWS',
          isActive: true,
        },
      });

      if (destinationGroups.length === 0) {
        console.warn(`[NewsWorker] No active DESTINATION groups configured for NEWS. Saving post as PENDING.`);
        await prisma.post.update({
          where: { id: postId },
          data: {
            processedText: formattedText,
            duplicateReason: 'No active DESTINATION groups found for NEWS.',
          },
        });
        return { status: 'NO_DESTINATIONS' };
      }

      // 7. WAHA Dispatcher with 30-Second Rate-Limiting Delay
      let lastWahaMessageId: string | null = null;
      let primaryGroupId: string | null = null;

      for (let i = 0; i < destinationGroups.length; i++) {
        const dest = destinationGroups[i];
        primaryGroupId = dest.id;
        console.log(`[NewsWorker] Dispatching news to group ${dest.name} (${dest.wahaChatId}) [${i + 1}/${destinationGroups.length}]`);

        try {
          let dispatchResponse;
          if (post.mediaUrl) {
            dispatchResponse = await wahaClient.sendFileMessage(
              dest.wahaChatId,
              post.mediaUrl,
              formattedText
            );
          } else {
            dispatchResponse = await wahaClient.sendTextMessage(
              dest.wahaChatId,
              formattedText
            );
          }

          if (dispatchResponse?.id) {
            lastWahaMessageId = dispatchResponse.id;
          }
        } catch (dispatchErr: any) {
          console.error(`[NewsWorker] Failed to dispatch to ${dest.wahaChatId}:`, dispatchErr.message);
        }

        // WhatsApp Anti-Ban Safeguard: 30-second delay between destination dispatches
        if (i < destinationGroups.length - 1) {
          console.log(`[NewsWorker] Waiting ${env.DISPATCH_DELAY_MS}ms before next dispatch to respect WhatsApp anti-ban limits...`);
          await sleep(env.DISPATCH_DELAY_MS);
        }
      }

      // 8. Mark Post as SENT
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'SENT',
          processedText: formattedText,
          sentAt: new Date(),
          destinationGroupId: primaryGroupId,
          wahaMessageId: lastWahaMessageId,
        },
      });

      console.log(`[NewsWorker] Successfully processed and dispatched news post ${postId}`);
      return { status: 'SENT', wahaMessageId: lastWahaMessageId };
    },
    {
      connection: redisConnection,
      concurrency: 1, // Strictly 1 concurrent job to avoid race conditions and WhatsApp spam
      limiter: {
        max: 2,
        duration: 60000, // Maximum 2 posts dispatched per minute
      },
    }
  );

  worker.on('failed', async (job, err) => {
    console.error(`[NewsWorker] Job ${job?.id} failed:`, err.message);
    if (job?.data?.postId) {
      await prisma.post.update({
        where: { id: job.data.postId },
        data: {
          status: 'FAILED',
          duplicateReason: `Worker error: ${err.message}`,
        },
      }).catch(() => {});
    }
  });

  return worker;
}

