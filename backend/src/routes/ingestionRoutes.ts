import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { wahaMediaService } from '../services/wahaMediaService.js';
import { addNewsJob, addDarazJob } from '../queues/queueManager.js';

const newsIngestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(5, 'Content must be at least 5 characters'),
  sourceUrl: z.string().optional(),
  sourceName: z.string().optional(),
  imageUrl: z.string().optional(),
  publishedAt: z.string().optional(),
});

const darazIngestSchema = z.object({
  title: z.string().min(1, 'Product title is required'),
  originalPrice: z.union([z.string(), z.number()]).optional(),
  discountPrice: z.union([z.string(), z.number()]),
  discountPercentage: z.union([z.string(), z.number()]).optional(),
  affiliateUrl: z.string().url('A valid affiliate URL is required'),
  imageUrl: z.string().optional(),
  productDetails: z.string().optional(),
  category: z.string().optional(),
});

export const ingestionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * External Scraper Ingestion for News
   * POST /api/ingest/news
   */
  fastify.post('/api/ingest/news', async (request, reply) => {
    try {
      const parsed = newsIngestSchema.parse(request.body);

      let mediaUrl: string | null = null;
      if (parsed.imageUrl) {
        try {
          mediaUrl = await wahaMediaService.downloadAndStoreMedia(parsed.imageUrl);
        } catch (mediaErr: any) {
          fastify.log.warn(`Could not store news media in MinIO: ${mediaErr.message}`);
        }
      }

      // Create Post record in DB with PENDING status
      const post = await prisma.post.create({
        data: {
          type: 'NEWS',
          sourceRef: parsed.sourceUrl || 'EXTERNAL_SCRAPER',
          mediaUrl,
          status: 'PENDING',
          rawPayload: parsed,
        },
      });

      // Push to BullMQ News Queue for Deduplication, Copywriting & Dispatch
      await addNewsJob({
        postId: post.id,
        source: 'SCRAPER',
        rawPayload: parsed,
      });

      return reply.status(202).send({
        success: true,
        message: 'News post ingested and queued for AI deduplication and copywriting',
        postId: post.id,
        status: 'PENDING',
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
   * External Scraper Ingestion for Daraz Deals
   * POST /api/ingest/daraz
   */
  fastify.post('/api/ingest/daraz', async (request, reply) => {
    try {
      const parsed = darazIngestSchema.parse(request.body);

      let mediaUrl: string | null = null;
      if (parsed.imageUrl) {
        try {
          mediaUrl = await wahaMediaService.downloadAndStoreMedia(parsed.imageUrl);
        } catch (mediaErr: any) {
          fastify.log.warn(`Could not store Daraz media in MinIO: ${mediaErr.message}`);
        }
      }

      // Create Post record in DB
      const post = await prisma.post.create({
        data: {
          type: 'DARAZ',
          sourceRef: parsed.affiliateUrl,
          mediaUrl,
          status: 'PENDING',
          rawPayload: parsed,
        },
      });

      // Push to BullMQ Daraz Queue for tracking URL generation, copywriting & dispatch
      await addDarazJob({
        postId: post.id,
        source: 'SCRAPER',
        rawPayload: parsed,
      });

      return reply.status(202).send({
        success: true,
        message: 'Daraz deal ingested and queued for tracking link injection and dispatch',
        postId: post.id,
        status: 'PENDING',
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ success: false, errors: err.errors });
      }
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};

