import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/prisma.js';
import { SettingsService } from '../services/settingsService.js';
import { wahaClient } from '../services/wahaClient.js';

export const darazPostbackRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Helper to process incoming Daraz Affiliate Postback
   */
  const handlePostback = async (request: any, reply: any) => {
    try {
      const params = {
        ...(request.query as Record<string, any>),
        ...(typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, any>) : {}),
      };

      fastify.log.info({ params }, '[DarazPostback] Received S2S conversion event');

      // 1. Extract Order & Conversion Parameters
      const orderId = String(
        params.order_id ||
          params.orderId ||
          params.trade_id ||
          params.order_sn ||
          params.transaction_id ||
          params.id ||
          `daraz_${Date.now()}`
      );

      const subId = params.sub_id || params.subId || params.sub1 || params.aff_sub || params.click_id || null;
      const itemId = params.item_id || params.itemId || params.sku || null;
      const itemName = params.item_name || params.itemName || params.product_name || params.title || null;

      const orderAmount =
        parseFloat(
          params.order_amount ||
            params.orderAmount ||
            params.amount ||
            params.price ||
            params.pay_price ||
            params.gmv ||
            '0'
        ) || 0;

      const commissionAmount =
        parseFloat(
          params.commission ||
            params.commission_amount ||
            params.commissionAmount ||
            params.payout ||
            params.revenue ||
            '0'
        ) || 0;

      const currency = params.currency || 'LKR';
      const status = params.status || params.type || 'Order';

      // 2. Upsert Order in Database
      const order = await prisma.darazOrder.upsert({
        where: { orderId },
        create: {
          orderId,
          subId,
          itemId,
          itemName,
          orderAmount,
          commissionAmount,
          currency,
          status,
          rawPayload: params,
        },
        update: {
          status,
          orderAmount: orderAmount > 0 ? orderAmount : undefined,
          commissionAmount: commissionAmount > 0 ? commissionAmount : undefined,
          rawPayload: params,
        },
      });

      fastify.log.info(`[DarazPostback] Upserted order ${orderId} (Status: ${status}, Comm: ${commissionAmount} ${currency})`);

      // 3. Notify Admin on WhatsApp in Real-Time
      try {
        const adminPhone = await SettingsService.get('authorizedAdminPhone');
        if (adminPhone) {
          const cleanPhone = adminPhone.replace(/\D/g, '');
          const adminChatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@c.us`;

          const amountFormatted = orderAmount > 0 ? `Rs. ${orderAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
          const commFormatted = commissionAmount > 0 ? `Rs. ${commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

          const alertMsg =
            `🎉 *புதிய Daraz ஆர்டர் பதிவாகியுள்ளது!*\n\n` +
            `📦 *Order ID:* \`${orderId}\`\n` +
            (itemName ? `🛍️ *பொருள்:* ${itemName}\n` : '') +
            `💰 *விற்பனை தொகை:* ${amountFormatted}\n` +
            `💵 *உங்கள் கமிஷன்:* ${commFormatted}\n` +
            `⚡ *நிலை:* ${status}\n\n` +
            `_Daraz Affiliate Real-time Webhook_`;

          await wahaClient.sendTextMessage(adminChatId, alertMsg);
        }
      } catch (notifyErr: any) {
        fastify.log.warn(`[DarazPostback] WhatsApp admin notification failed: ${notifyErr.message}`);
      }

      return reply.status(200).send({
        success: true,
        message: 'Postback processed successfully',
        orderId: order.orderId,
      });
    } catch (err: any) {
      fastify.log.error(err, '[DarazPostback] Error handling postback');
      return reply.status(500).send({ success: false, error: err.message });
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
      });

      const totalOrders = await prisma.darazOrder.count();
      const confirmedOrders = await prisma.darazOrder.count({
        where: {
          status: { in: ['Order', 'Delivered', 'Paid', 'Approved'] },
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
