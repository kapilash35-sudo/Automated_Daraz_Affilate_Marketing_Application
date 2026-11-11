import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { copywritingService } from '../services/copywritingService.js';
import { wahaClient } from '../services/wahaClient.js';
import { SettingsService } from '../services/settingsService.js';
import { DarazJobData } from './queueManager.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDarazWorker() {
  const worker = new Worker<DarazJobData>(
    'daraz-queue',
    async (job: Job<DarazJobData>) => {
      const { postId } = job.data;
      console.log(`[DarazWorker] Processing Daraz deal job ${job.id} for post ${postId}`);

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

      const payload: any = post.rawPayload || {};

      // 2. Resolve URLs
      const directAffiliateUrl = payload.exactAffiliateUrl || post.sourceRef || '';
      const communityInviteUrl = await SettingsService.get('communityInviteUrl');
      const trackingUrl = `${env.BASE_REDIRECT_URL}/r/${postId}`;

      // 3. Resolve Ad Promotional Copies (Tamil & Sinhala):
      let formattedTextTamil = post.processedText;
      let formattedTextSinhala = post.processedTextSinhala || (payload?.processedTextSinhala as string);

      if (!formattedTextTamil || !formattedTextTamil.trim() || !formattedTextSinhala || !formattedTextSinhala.trim()) {
        console.log(`[DarazWorker] Generating fresh Bilingual (Tamil + Sinhala) Flash Deal copy with Gemini...`);
        const bilingual = await copywritingService.generateBilingualDarazDeals({
          title: payload.title || 'சிறப்பு தள்ளுபடி தயாரிப்பு',
          originalPrice: payload.originalPrice,
          discountPrice: payload.discountPrice || payload.price,
          discountPercentage: payload.discountPercentage,
          affiliateRedirectUrl: trackingUrl,
          productDetails: payload.productDetails || payload.description,
          category: payload.category,
          communityInviteUrl: communityInviteUrl || undefined,
        });

        if (!formattedTextTamil || !formattedTextTamil.trim()) formattedTextTamil = bilingual.tamilText;
        if (!formattedTextSinhala || !formattedTextSinhala.trim()) formattedTextSinhala = bilingual.sinhalaText;
      }

      // Helper to sanitize links in copy:
      const sanitizeCopy = (text: string) => {
        let t = text;
        if (t.includes('localhost:4000/r/')) {
          t = t.replace(/https?:\/\/localhost:4000\/r\/[^\s]+/g, trackingUrl);
        }
        if (directAffiliateUrl && t.includes(directAffiliateUrl)) {
          t = t.replace(directAffiliateUrl, trackingUrl);
        }
        return t;
      };

      formattedTextTamil = sanitizeCopy(formattedTextTamil);
      formattedTextSinhala = sanitizeCopy(formattedTextSinhala);

      // 4. Find Active Destination Groups for DARAZ
      const destinationGroups = await prisma.group.findMany({
        where: {
          role: 'DESTINATION',
          type: 'DARAZ',
          isActive: true,
        },
      });

      if (destinationGroups.length === 0) {
        console.warn(`[DarazWorker] No active DESTINATION groups configured for DARAZ.`);
        await prisma.post.update({
          where: { id: postId },
          data: {
            processedText: formattedTextTamil,
            processedTextSinhala: formattedTextSinhala,
            duplicateReason: 'No active DESTINATION groups found for DARAZ.',
          },
        });
        return { status: 'NO_DESTINATIONS' };
      }

      // 5. WAHA Dispatcher with 30-Second Rate-Limiting Delay
      let lastWahaMessageId: string | null = null;
      let primaryGroupId: string | null = null;

      for (let i = 0; i < destinationGroups.length; i++) {
        const dest = destinationGroups[i];
        primaryGroupId = dest.id;

        // Choose text based on group's configured language
        let groupText = formattedTextTamil;
        if (dest.language === 'SINHALA') {
          groupText = formattedTextSinhala;
        } else if (dest.language === 'ALL') {
          groupText = `${formattedTextTamil}\n\n━━━━━━━━━━━━━━━\n\n${formattedTextSinhala}`;
        }

        console.log(`[DarazWorker] Dispatching Daraz deal [Lang: ${dest.language}] to group ${dest.name} (${dest.wahaChatId}) [${i + 1}/${destinationGroups.length}]`);

        try {
          let dispatchResponse;
          if (post.mediaUrl) {
            dispatchResponse = await wahaClient.sendFileMessage(
              dest.wahaChatId,
              post.mediaUrl,
              groupText,
              'product.jpg',
              'image/jpeg'
            );
          } else {
            dispatchResponse = await wahaClient.sendTextMessage(
              dest.wahaChatId,
              groupText
            );
          }

          if (dispatchResponse?.id) {
            const rawId = dispatchResponse.id;
            lastWahaMessageId = typeof rawId === 'string'
              ? rawId
              : ((rawId as any)._serialized || (rawId as any).id || String(rawId));
          }
        } catch (dispatchErr: any) {
          console.error(`[DarazWorker] Failed to dispatch to ${dest.wahaChatId}:`, dispatchErr.message);
        }

        // WhatsApp Anti-Ban Safeguard: 30-second delay between destination dispatches
        if (i < destinationGroups.length - 1) {
          console.log(`[DarazWorker] Waiting ${env.DISPATCH_DELAY_MS}ms before next dispatch...`);
          await sleep(env.DISPATCH_DELAY_MS);
        }
      }

      // 6. Mark Post as SENT
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'SENT',
          processedText: formattedTextTamil,
          processedTextSinhala: formattedTextSinhala,
          sentAt: new Date(),
          destinationGroupId: primaryGroupId,
          wahaMessageId: lastWahaMessageId ? String(lastWahaMessageId) : null,
        },
      });

      console.log(`[DarazWorker] Successfully dispatched Daraz deal ${postId}`);
      return { status: 'SENT', wahaMessageId: lastWahaMessageId };
    },
    {
      connection: redisConnection,
      concurrency: 1,
      limiter: {
        max: 2,
        duration: 60000,
      },
    }
  );

  worker.on('failed', async (job, err) => {
    console.error(`[DarazWorker] Job ${job?.id} failed:`, err.message);
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

