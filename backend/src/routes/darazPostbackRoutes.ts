import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/prisma.js';
import { SettingsService } from '../services/settingsService.js';
import { wahaClient } from '../services/wahaClient.js';

export const darazPostbackRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Helper to process incoming Daraz Affiliate Postback with full Macro Support
   */
  const handlePostback = async (request: any, reply: any) => {
    try {
      const params = {
        ...(request.query as Record<string, any>),
        ...(typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, any>) : {}),
      };

      fastify.log.info({ params }, '[DarazPostback] Received S2S conversion event');

      // 1. Extract Order & Conversion Parameters from Daraz Macros
      const orderId = String(
        params.order_id ||
          params.orderId ||
          params.trade_id ||
          params.order_sn ||
          params.transaction_id ||
          params._p_transaction ||
          params.id ||
          `daraz_${Date.now()}`
      );

      // Check if this is a Daraz "Run Test" mock ping
      const isTestOrder =
        orderId.toLowerCase().includes('test') ||
        String(params.sub_order_id || '').toLowerCase().includes('test');

      const subOrderId = params.sub_order_id || params._p_sub_transaction || null;
      const subAffId = params.sub_aff_id || null;
      const subId = params.sub_id || params.sub1 || params.sub_id1 || params.post_id || null;
      const language = params.language || params.sub_id2 || (subAffId?.includes('sin') ? 'SINHALA' : 'TAMIL');

      const itemId = params.item_id || params._p_purchased_item_id || params.itemId || params.sku || null;
      const sku = params.sku || params._p_sku_daraz || null;
      const itemName = params.item_name || params.itemName || params.product_name || params.title || null;

      const category1 = params.category1 || params._p_cate_name_lv1 || null;
      const category2 = params.category2 || params._p_cate_name_lv2 || null;

      const deviceOs = params.device_os || params._device_os || null;
      const platform = params.platform || params._p_platform || null;
      const isNewUser = params.is_new_user === '1' || params._p_new_user === '1';

      const commissionRate = parseFloat(params.commission_rate || params._p_com_rate || '0') || 0;

      const orderAmount =
        parseFloat(
          params.amount ||
            params.order_amount ||
            params.orderAmount ||
            params._p_pay_amount ||
            params._p_sub_order_amount ||
            params.price ||
            params.pay_price ||
            params.gmv ||
            '0'
        ) || 0;

      const commissionAmount =
        parseFloat(
          params.payout ||
            params.commission ||
            params.commission_amount ||
            params.commissionAmount ||
            params._p_payout ||
            params._p_cps_payout ||
            params.revenue ||
            '0'
        ) || 0;

      const currency = params.currency || params._p_currency || 'LKR';
      const status = params.status || params._p_status || params.type || 'Order';

      // 2. Resolve Associated Deal/Post in Database (if sub_id1 / post_id provided)
      let resolvedPostId: string | null = null;
      if (subId && typeof subId === 'string' && subId.trim().length > 0) {
        const matchingPost = await prisma.post.findUnique({
          where: { id: subId.trim() },
          select: { id: true, ordersCount: true, actualRevenue: true, actualCommission: true },
        });

        if (matchingPost) {
          resolvedPostId = matchingPost.id;

          // Increment Post Attribution counters if not a mock test
          if (!isTestOrder) {
            await prisma.post.update({
              where: { id: matchingPost.id },
              data: {
                ordersCount: { increment: 1 },
                actualRevenue: { increment: orderAmount },
                actualCommission: { increment: commissionAmount },
              },
            });
          }
        }
      }

      // 3. Upsert Order in Database
      const order = await prisma.darazOrder.upsert({
        where: { orderId },
        create: {
          orderId,
          subOrderId,
          subAffId,
          subId,
          postId: resolvedPostId,
          language,
          itemId,
          sku,
          itemName,
          category1,
          category2,
          deviceOs,
          platform,
          isNewUser,
          commissionRate,
          orderAmount,
          commissionAmount,
          currency,
          status,
          rawPayload: params,
        },
        update: {
          status,
          subOrderId: subOrderId || undefined,
          category1: category1 || undefined,
          category2: category2 || undefined,
          deviceOs: deviceOs || undefined,
          platform: platform || undefined,
          orderAmount: orderAmount > 0 ? orderAmount : undefined,
          commissionAmount: commissionAmount > 0 ? commissionAmount : undefined,
          rawPayload: params,
        },
      });

      fastify.log.info(
        `[DarazPostback] Upserted order ${orderId} (Status: ${status}, Comm: ${commissionAmount} ${currency}, Post: ${resolvedPostId || 'None'})`
      );

      // 4. Notify Admin on WhatsApp in Real-Time (Skip automated spam on test orders)
      if (!isTestOrder) {
        try {
          const adminPhone = await SettingsService.get('authorizedAdminPhone');
          if (adminPhone) {
            const cleanPhone = adminPhone.replace(/\D/g, '');
            const adminChatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

            const amountFormatted = orderAmount > 0 ? `Rs. ${orderAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
            const commFormatted = commissionAmount > 0 ? `Rs. ${commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
            const rateFormatted = commissionRate > 0 ? ` (${(commissionRate * 100).toFixed(1)}%)` : '';
            const channelText = language === 'SINHALA' ? 'KH Daraz [SINHALA]' : 'KH Daraz [TAMIL]';
            const deviceText = deviceOs ? `${deviceOs} (${platform || 'App'})` : 'Mobile/App';

            const alertMsg =
              `🎉 *புதிய Daraz ஆர்டர் பதிவாகியுள்ளது!*\n\n` +
              `📦 *Order ID:* \`${orderId}\`\n` +
              (itemName ? `🛍️ *பொருள்:* ${itemName}\n` : '') +
              (category1 ? `📂 *பிரிவு:* ${category1}${category2 ? ` > ${category2}` : ''}\n` : '') +
              `💰 *விற்பனை தொகை:* ${amountFormatted}\n` +
              `💵 *உங்கள் கமிஷன்:* ${commFormatted}${rateFormatted}\n` +
              `👥 *சேனல்:* ${channelText}\n` +
              `📱 *சாதனம்:* ${deviceText}\n` +
              (isNewUser ? `⭐ *வாடிக்கையாளர்:* புதிய பயனர் (New User!)\n` : '') +
              `⚡ *நிலை:* ${status}\n\n` +
              `_Daraz Affiliate Real-time Webhook_`;

            await wahaClient.sendTextMessage(adminChatId, alertMsg);
          }
        } catch (notifyErr: any) {
          fastify.log.warn(`[DarazPostback] WhatsApp admin notification failed: ${notifyErr.message}`);
        }
      }

      return reply.status(200).send({
        success: true,
        message: isTestOrder ? 'Mock test verification acknowledged successfully' : 'Postback processed successfully',
        orderId: order.orderId,
      });
    } catch (err: any) {
      fastify.log.error(err, '[DarazPostback] Error handling postback');
      // Always return 200 to prevent Daraz S2S retry storm in case of non-fatal payload parsing
      return reply.status(200).send({ success: false, error: err.message });
    }
  };

  /**
   * Daraz Affiliate Webhook: GET & POST
   */
  fastify.get('/api/webhooks/daraz/postback', handlePostback);
  fastify.post('/api/webhooks/daraz/postback', handlePostback);

  /**
   * GET /api/orders
   * Retrieve real Daraz orders captured via Postback
   */
  fastify.get('/api/orders', async (request, reply) => {
    try {
      const orders = await prisma.darazOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          post: {
            select: {
              id: true,
              mediaUrl: true,
              rawPayload: true,
            },
          },
        },
      });

      const totalOrders = await prisma.darazOrder.count();
      const confirmedOrders = await prisma.darazOrder.count({
        where: {
          status: { in: ['Order', 'Delivered', 'Paid', 'Approved', 'Fulfilled'] },
        },
      });

      const totals = await prisma.darazOrder.aggregate({
        _sum: {
          orderAmount: true,
          commissionAmount: true,
        },
      });

      return reply.send({
        success: true,
        totalOrders,
        confirmedOrders,
        totalSalesVolume: totals._sum.orderAmount || 0,
        totalRealCommission: totals._sum.commissionAmount || 0,
        orders,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};
