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

      // 3. Resolve Ad Promotional Copy:
      let formattedText = post.processedText;

      if (!formattedText || !formattedText.trim()) {
        console.log(`[DarazWorker] Generating fresh Tamil Flash Deal promotional copy with Gemini...`);
        formattedText = await copywritingService.formatDarazDealForWhatsApp({
          title: payload.title || 'சிறப்பு தள்ளுபடி தயாரிப்பு',
          originalPrice: payload.originalPrice,
          discountPrice: payload.discountPrice || payload.price,
          discountPercentage: payload.discountPercentage,
          affiliateRedirectUrl: trackingUrl,
          productDetails: payload.productDetails || payload.description,
          category: payload.category,
          communityInviteUrl: communityInviteUrl || undefined,
        });
      } else {
        // Ensure the tracking redirect link is present (replace localhost:4000 or raw direct affiliate link if present)
        if (formattedText.includes('localhost:4000/r/')) {
          formattedText = formattedText.replace(/https?:\/\/localhost:4000\/r\/[^\s]+/g, trackingUrl);
        }
        if (directAffiliateUrl && formattedText.includes(directAffiliateUrl)) {
          formattedText = formattedText.replace(directAffiliateUrl, trackingUrl);
        }
        // Ensure community group invite link is present in footer
        if (communityInviteUrl && !formattedText.includes(communityInviteUrl)) {
          formattedText += `\n\n📲 *மேலும் அதிரடி தள்ளுபடி சலுகைகளை உடனுக்குடன் பெற எமது WhatsApp குழுவில் இணையுங்கள்:*\n👉 ${communityInviteUrl}`;
        }
      }

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
            processedText: formattedText,
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
        console.log(`[DarazWorker] Dispatching Daraz deal to group ${dest.name} (${dest.wahaChatId}) [${i + 1}/${destinationGroups.length}]`);

        try {
          let dispatchResponse;
          if (post.mediaUrl) {
            dispatchResponse = await wahaClient.sendFileMessage(
              dest.wahaChatId,
              post.mediaUrl,
              formattedText,
              'product.jpg',
              'image/jpeg'
            );
          } else {
            dispatchResponse = await wahaClient.sendTextMessage(
              dest.wahaChatId,
              formattedText
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
          processedText: formattedText,
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

