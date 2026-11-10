import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/prisma.js';

export const redirectRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Daraz Affiliate Click Tracking & Redirect
   * GET /r/:postId
   */
  fastify.get<{ Params: { postId: string } }>('/r/:postId', async (request, reply) => {
    const { postId } = request.params;

    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
      });

      if (!post) {
        fastify.log.warn(`[Redirect] Click on non-existent post: ${postId}`);
        return reply.status(404).send('Product link not found or expired.');
      }

      // 1. Record Engagement of type CLICK with exact timestamp
      const userAgent = request.headers['user-agent'] || 'Unknown';
      const ip = request.ip || 'Unknown';

      await prisma.$transaction([
        prisma.engagement.create({
          data: {
            postId: post.id,
            type: 'CLICK',
            recordedAt: new Date(),
            metadata: {
              userAgent,
              ip,
              referer: request.headers['referer'] || null,
            },
          },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: {
            clicksCount: { increment: 1 },
          },
        }),
      ]);

      fastify.log.info(`[Redirect] Logged CLICK for post ${postId}. New count: ${post.clicksCount + 1}`);

      // 2. Extract target destination affiliate URL
      const payload: any = post.rawPayload || {};
      const targetUrl =
        payload.exactAffiliateUrl ||
        payload.affiliateUrl ||
        payload.url ||
        post.sourceRef ||
        'https://www.daraz.lk';

      // 3. Issue HTTP 302 redirect
      return reply.redirect(targetUrl, 302);
    } catch (err: any) {
      fastify.log.error(`[Redirect] Error handling click for ${postId}: ${err.message}`);
      return reply.redirect('https://www.daraz.lk', 302);
    }
  });
};

