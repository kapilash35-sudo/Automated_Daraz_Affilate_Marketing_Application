import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/prisma.js';

// Converts UTC Date to Sri Lanka / India Standard Time (Asia/Colombo: UTC+5:30)
const toLocalColomboDate = (utcDate: Date): Date => {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
};

export const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Domain A: News Media Operations Analytics
   * GET /api/analytics/news
   */
  fastify.get('/api/analytics/news', async (request, reply) => {
    try {
      const now = new Date();
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(now.getDate() - 14);

      // 1. Metric Counts
      const [totalIngested, totalSent, totalDuplicates, totalFailed] = await Promise.all([
        prisma.post.count({ where: { type: 'NEWS' } }),
        prisma.post.count({ where: { type: 'NEWS', status: 'SENT' } }),
        prisma.post.count({ where: { type: 'NEWS', status: 'DUPLICATE' } }),
        prisma.post.count({ where: { type: 'NEWS', status: 'FAILED' } }),
      ]);

      const totalReactionsCount = await prisma.engagement.count({
        where: { type: 'REACTION' },
      });

      const duplicateRate = totalIngested > 0 ? ((totalDuplicates / totalIngested) * 100).toFixed(1) : '0';

      // 2. Daily Volume (Past 14 Days)
      const recentPosts = await prisma.post.findMany({
        where: {
          type: 'NEWS',
          createdAt: { gte: fourteenDaysAgo },
        },
        select: {
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const dailyVolumeMap = new Map<string, { date: string; sent: number; duplicate: number; failed: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateKey = d.toISOString().slice(0, 10);
        dailyVolumeMap.set(dateKey, { date: dateKey, sent: 0, duplicate: 0, failed: 0 });
      }

      for (const p of recentPosts) {
        const dateKey = p.createdAt.toISOString().slice(0, 10);
        const dayRecord = dailyVolumeMap.get(dateKey);
        if (dayRecord) {
          if (p.status === 'SENT') dayRecord.sent++;
          else if (p.status === 'DUPLICATE') dayRecord.duplicate++;
          else if (p.status === 'FAILED') dayRecord.failed++;
        }
      }

      const dailyVolume = Array.from(dailyVolumeMap.values());

      // 3. Audience Heatmap (7 Days x 24 Hours for REACTION engagements)
      // Days: 0 (Sunday) to 6 (Saturday)
      const reactionEngagements = await prisma.engagement.findMany({
        where: {
          type: 'REACTION',
          recordedAt: { gte: fourteenDaysAgo },
        },
        select: {
          recordedAt: true,
        },
      });

      // Initialize 7x24 grid
      const heatmapGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      let maxReactionValue = 0;

      for (const eng of reactionEngagements) {
        const localDate = toLocalColomboDate(eng.recordedAt);
        const day = localDate.getDay(); // 0-6 in Asia/Colombo
        const hour = localDate.getHours(); // 0-23 in Asia/Colombo
        heatmapGrid[day][hour]++;
        if (heatmapGrid[day][hour] > maxReactionValue) {
          maxReactionValue = heatmapGrid[day][hour];
        }
      }

      // Compute peak times
      const slots: Array<{ day: number; hour: number; count: number }> = [];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          if (heatmapGrid[d][h] > 0) {
            slots.push({ day: d, hour: h, count: heatmapGrid[d][h] });
          }
        }
      }
      slots.sort((a, b) => b.count - a.count);
      const topPeakSlots = slots.slice(0, 3);

      // 4. Top Performing News (ranked by reactionsCount)
      const topPerformingNews = await prisma.post.findMany({
        where: {
          type: 'NEWS',
          status: 'SENT',
        },
        orderBy: { reactionsCount: 'desc' },
        take: 10,
        select: {
          id: true,
          processedText: true,
          mediaUrl: true,
          reactionsCount: true,
          sentAt: true,
          rawPayload: true,
        },
      });

      // 5. Live Logs (recent 25 news posts)
      const liveLogs = await prisma.post.findMany({
        where: { type: 'NEWS' },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          status: true,
          duplicateReason: true,
          sentAt: true,
          createdAt: true,
          rawPayload: true,
        },
      });

      return reply.send({
        success: true,
        summary: {
          totalIngested,
          totalSent,
          totalDuplicates,
          totalFailed,
          duplicateRate: `${duplicateRate}%`,
          totalReactions: totalReactionsCount,
        },
        dailyVolume,
        heatmap: {
          grid: heatmapGrid,
          maxValue: maxReactionValue || 1,
          topPeakSlots,
        },
        topPerformingNews: topPerformingNews.map((p) => {
          const payload = p.rawPayload as any;
          return {
            id: p.id,
            title: payload?.title || 'செய்தி குறிப்பு',
            reactionsCount: p.reactionsCount,
            sentAt: p.sentAt,
            mediaUrl: p.mediaUrl,
            processedPreview: p.processedText?.slice(0, 180),
          };
        }),
        liveLogs: liveLogs.map((l) => {
          const payload = l.rawPayload as any;
          return {
            id: l.id,
            title: payload?.title || 'WhatsApp News Update',
            status: l.status,
            reason: l.duplicateReason,
            createdAt: l.createdAt,
            sentAt: l.sentAt,
          };
        }),
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * Domain B: Daraz Affiliate Operations Analytics
   * GET /api/analytics/daraz
   */
  fastify.get('/api/analytics/daraz', async (request, reply) => {
    try {
      const now = new Date();
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(now.getDate() - 14);

      // Query parameters for dynamic revenue projection
      const query = request.query as any;
      const conversionRate = parseFloat(query?.conversionRate || '0.025'); // 2.5% default
      const avgCommission = parseFloat(query?.avgCommission || '380'); // Rs 380 default (~$1.25)

      // 1. Metric Counts
      const [totalDeals, totalSent, totalClicks, allPosts] = await Promise.all([
        prisma.post.count({ where: { type: 'DARAZ' } }),
        prisma.post.count({ where: { type: 'DARAZ', status: 'SENT' } }),
        prisma.engagement.count({ where: { type: 'CLICK' } }),
        prisma.post.findMany({
          where: { type: 'DARAZ' },
          select: { clicksCount: true, rawPayload: true },
        }),
      ]);

      const expectedOrders = Math.round(totalClicks * conversionRate);

      // Compute actual expected commission across posts
      let calculatedExpectedCommission = 0;
      for (const p of allPosts) {
        const payload = p.rawPayload as any;
        const comm = payload?.commissionAmount ? Number(payload.commissionAmount) : avgCommission;
        calculatedExpectedCommission += p.clicksCount * conversionRate * comm;
      }
      const expectedCommission =
        allPosts.length > 0 && calculatedExpectedCommission > 0
          ? Math.round(calculatedExpectedCommission)
          : Math.round(expectedOrders * avgCommission);

      // 2. Click-Through Heatmap (7 Days x 24 Hours for CLICK engagements)
      const clickEngagements = await prisma.engagement.findMany({
        where: {
          type: 'CLICK',
          recordedAt: { gte: fourteenDaysAgo },
        },
        select: {
          recordedAt: true,
        },
      });

      const heatmapGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      let maxClickValue = 0;

      for (const eng of clickEngagements) {
        const localDate = toLocalColomboDate(eng.recordedAt);
        const day = localDate.getDay(); // 0-6 in Asia/Colombo
        const hour = localDate.getHours(); // 0-23 in Asia/Colombo
        heatmapGrid[day][hour]++;
        if (heatmapGrid[day][hour] > maxClickValue) {
          maxClickValue = heatmapGrid[day][hour];
        }
      }

      // Compute peak buyer activity slots
      const slots: Array<{ day: number; hour: number; count: number }> = [];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          if (heatmapGrid[d][h] > 0) {
            slots.push({ day: d, hour: h, count: heatmapGrid[d][h] });
          }
        }
      }
      slots.sort((a, b) => b.count - a.count);
      const topPeakClickSlots = slots.slice(0, 3);

      // 3. Top Performing Daraz Deals (ranked by clicksCount)
      const topProducts = await prisma.post.findMany({
        where: {
          type: 'DARAZ',
        },
        orderBy: { clicksCount: 'desc' },
        take: 10,
        select: {
          id: true,
          clicksCount: true,
          mediaUrl: true,
          sentAt: true,
          rawPayload: true,
        },
      });

      // 4. Live Deals List
      const liveDeals = await prisma.post.findMany({
        where: { type: 'DARAZ' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          status: true,
          clicksCount: true,
          sentAt: true,
          createdAt: true,
          rawPayload: true,
        },
      });

      return reply.send({
        success: true,
        summary: {
          totalDeals,
          totalSent,
          totalClicks,
          conversionRatePercent: (conversionRate * 100).toFixed(1),
          avgCommissionPerOrder: avgCommission,
          expectedOrders,
          expectedCommission,
        },
        heatmap: {
          grid: heatmapGrid,
          maxValue: maxClickValue || 1,
          topPeakSlots: topPeakClickSlots,
        },
        topProducts: topProducts.map((p) => {
          const payload = p.rawPayload as any;
          const clicks = p.clicksCount;
          const itemCommission = payload?.commissionAmount ? Number(payload.commissionAmount) : avgCommission;
          const estRevenue = Math.round(clicks * conversionRate * itemCommission);
          return {
            id: p.id,
            title: payload?.title || 'Daraz Deal Item',
            originalPrice: payload?.originalPrice,
            discountPrice: payload?.discountPrice || payload?.price,
            discountPercentage: payload?.discountPercentage,
            commissionAmount: itemCommission,
            clicksCount: clicks,
            estimatedRevenue: estRevenue,
            mediaUrl: p.mediaUrl,
            sentAt: p.sentAt,
          };
        }),
        liveDeals: liveDeals.map((d) => {
          const payload = d.rawPayload as any;
          return {
            id: d.id,
            title: payload?.title || 'Daraz Promo',
            status: d.status,
            clicksCount: d.clicksCount,
            createdAt: d.createdAt,
            sentAt: d.sentAt,
          };
        }),
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};

