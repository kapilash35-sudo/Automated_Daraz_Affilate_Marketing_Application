import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { DarazExtractor } from '../services/darazExtractor.js';
import { copywritingService } from '../services/copywritingService.js';
import { SettingsService } from '../services/settingsService.js';
import { addDarazJob } from '../queues/queueManager.js';
import { wahaMediaService } from '../services/wahaMediaService.js';
import { wahaClient } from '../services/wahaClient.js';
import { AdminChatService } from '../services/adminChatService.js';

const quickCreateSchema = z.object({
  text: z.string().min(5, 'Deal text or link is required'),
  imageUrl: z.string().optional(),
  commissionAmount: z.union([z.number(), z.string()]).optional(),
  autoApprove: z.boolean().default(false),
});

export const dealRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/deals/pending
   * Returns all deals waiting for Admin approval
   */
  fastify.get('/api/deals/pending', async (request, reply) => {
    try {
      const pendingDeals = await prisma.post.findMany({
        where: {
          type: 'DARAZ',
          status: 'PENDING_APPROVAL',
        },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send({ success: true, data: pendingDeals });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/deals/:id/approve
   * Approves a deal and dispatches to all active destination groups via BullMQ
   */
  fastify.post<{ Params: { id: string } }>('/api/deals/:id/approve', async (request, reply) => {
    try {
      const { id } = request.params;
      const post = await prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        return reply.status(404).send({ success: false, error: 'Deal not found' });
      }

      const activeGroups = await prisma.group.findMany({
        where: { role: 'DESTINATION', type: 'DARAZ', isActive: true },
      });

      if (activeGroups.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'No active DESTINATION WhatsApp groups configured. Please configure groups in Settings.',
        });
      }

      // Enqueue in BullMQ for 30s-paced dispatch
      await addDarazJob({
        postId: post.id,
        source: 'SCRAPER',
        rawPayload: post.rawPayload,
      });

      return reply.send({
        success: true,
        message: `Deal approved! Enqueued for dispatch to ${activeGroups.length} groups with 30s pacing.`,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/deals/:id/reject
   * Rejects a deal draft
   */
  fastify.post<{ Params: { id: string } }>('/api/deals/:id/reject', async (request, reply) => {
    try {
      const { id } = request.params;
      await prisma.post.update({
        where: { id },
        data: { status: 'REJECTED' },
      });
      return reply.send({ success: true, message: 'Deal rejected' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/deals/create
   * Quick Create deal from Dashboard (paste text + optional image)
   */
  fastify.post('/api/deals/create', async (request, reply) => {
    try {
      const parsed = quickCreateSchema.parse(request.body);

      let mediaUrl = parsed.imageUrl;
      if (mediaUrl && !mediaUrl.startsWith('http')) {
        // If base64, save to MinIO
        mediaUrl = await wahaMediaService.downloadAndStoreMedia(mediaUrl);
      }

      // Extract details and scrape product image if not provided
      const dealData = await DarazExtractor.extractDealFromText(parsed.text, mediaUrl);

      // Attach actual commission if provided
      if (parsed.commissionAmount !== undefined && parsed.commissionAmount !== null) {
        const comm =
          typeof parsed.commissionAmount === 'string'
            ? parseFloat(parsed.commissionAmount)
            : parsed.commissionAmount;
        if (!isNaN(comm)) {
          dealData.commissionAmount = comm;
        }
      }

      // Get active community invite link
      const communityInviteUrl = await SettingsService.get('communityInviteUrl');

      // Create post first to acquire unique postId
      const post = await prisma.post.create({
        data: {
          type: 'DARAZ',
          sourceRef: dealData.exactAffiliateUrl,
          mediaUrl: dealData.mediaUrl,
          status: parsed.autoApprove ? 'PROCESSING' : 'PENDING_APPROVAL',
          rawPayload: dealData as any,
          processedText: '',
          processedTextSinhala: '',
        },
      });

      const trackingUrl = `${env.BASE_REDIRECT_URL}/r/${post.id}`;

      // AI Copywriting with Gemini: generate both Tamil and Sinhala in parallel
      const { tamilText, sinhalaText } = await copywritingService.generateBilingualDarazDeals({
        title: dealData.title,
        originalPrice: dealData.originalPrice,
        discountPrice: dealData.discountPrice,
        discountPercentage: dealData.discountPercentage,
        affiliateRedirectUrl: trackingUrl,
        communityInviteUrl,
      });

      await prisma.post.update({
        where: { id: post.id },
        data: {
          processedText: tamilText,
          processedTextSinhala: sinhalaText,
        },
      });

      if (parsed.autoApprove) {
        await addDarazJob({
          postId: post.id,
          source: 'SCRAPER',
          rawPayload: dealData as any,
        });
      } else {
        // Send preview and approval poll to Admin on WhatsApp
        try {
          const adminChatId = await AdminChatService.getAdminChatId();
          const activeGroups = await prisma.group.findMany({
            where: { role: 'DESTINATION', type: 'DARAZ', isActive: true },
          });
          const tamilCount = activeGroups.filter((g) => g.language === 'TAMIL' || g.language === 'ALL').length;
          const sinhalaCount = activeGroups.filter((g) => g.language === 'SINHALA' || g.language === 'ALL').length;

          const commInfo = dealData.commissionAmount
            ? `\n\n💰 *உண்மையான கமிஷன்:* Rs. ${dealData.commissionAmount} / order`
            : '';
          const preview = `📢 *Dashboard-ல் புதிய விளம்பரம் உருவாக்கப்பட்டது!*\n\n👥 *குரூப்கள்:* ${tamilCount} தமிழ் | ${sinhalaCount} சிங்களம்${commInfo}\n\n🇱🇰 *[தமிழ்]:*\n${tamilText}\n\n🇱🇰 *[සිංහල]:*\n${sinhalaText}`;
          if (dealData.mediaUrl) {
            await wahaClient.sendFileMessage(adminChatId, dealData.mediaUrl, preview);
          } else {
            await wahaClient.sendTextMessage(adminChatId, preview);
          }
          await AdminChatService.sendApprovalMenu(adminChatId, activeGroups.length, post.id);
        } catch (adminErr: any) {
          fastify.log.warn(`Could not notify admin on WhatsApp: ${adminErr.message}`);
        }
      }

      return reply.status(201).send({
        success: true,
        message: parsed.autoApprove
          ? 'Deal created and enqueued for broadcast!'
          : 'Deal draft created and awaiting your approval!',
        postId: post.id,
        status: post.status,
        preview: {
          title: dealData.title,
          image: dealData.mediaUrl,
          copy: tamilText,
          copySinhala: sinhalaText,
        },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ success: false, errors: err.errors });
      }
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/deals
   * List all deals (with status filter and pagination)
   */
  fastify.get('/api/deals', async (request, reply) => {
    try {
      const query = request.query as any;
      const statusFilter = query.status;

      const deals = await prisma.post.findMany({
        where: {
          type: 'DARAZ',
          status: statusFilter ? statusFilter : undefined,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send({ success: true, data: deals });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};
