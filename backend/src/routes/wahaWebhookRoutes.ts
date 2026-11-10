import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../config/prisma.js';
import { wahaMediaService } from '../services/wahaMediaService.js';
import { addDarazJob } from '../queues/queueManager.js';
import { AdminChatService } from '../services/adminChatService.js';

// Message and Event Deduplication Cache (5-minute TTL)
const processedEventIds = new Map<string, number>();

function isDuplicateEvent(id: string): boolean {
  if (!id) return false;
  const now = Date.now();
  if (processedEventIds.size > 2000) {
    for (const [key, timestamp] of processedEventIds.entries()) {
      if (now - timestamp > 300000) {
        processedEventIds.delete(key);
      }
    }
  }
  if (processedEventIds.has(id)) {
    return true;
  }
  processedEventIds.set(id, now);
  return false;
}

export const wahaWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * WAHA Incoming Messages & Events Webhook
   * POST /api/webhooks/waha/incoming
   */
  fastify.post('/api/webhooks/waha/incoming', async (request, reply) => {
    try {
      const body: any = request.body || {};
      fastify.log.info(`[WAHA Webhook] Received event: ${body.event}`);

      // Handle Session Status Events (keep alive / status update)
      if (body.event === 'session.status') {
        return reply.status(200).send({ success: true, event: 'session.status' });
      }

      // Ignore message.any events since we already process 'message' events for incoming chats
      // This eliminates duplicate messages received by admin and handlers
      if (body.event === 'message.any') {
        return reply.status(200).send({ ignored: true, reason: 'message.any ignored in favor of message' });
      }

      // 1. Handle Poll Vote Events (Admin Approval / Selection)
      if (body.event === 'poll.vote' || body.event === 'poll') {
        const payload = body.payload || body;
        const voteId = payload.vote?.id || payload.id;
        const voteKey = typeof voteId === 'string' ? `poll_${voteId}` : `poll_${JSON.stringify(voteId)}`;
        if (voteId && isDuplicateEvent(voteKey)) {
          fastify.log.info(`[WAHA Webhook] Duplicate poll.vote ${voteKey} ignored`);
          return reply.status(200).send({ ignored: true, reason: 'duplicate_poll_vote' });
        }

        fastify.log.info(`[WAHA Webhook] Processing poll.vote: ${JSON.stringify(payload)}`);
        const handled = await AdminChatService.handlePollVote(payload);
        return reply.status(200).send({
          success: true,
          handledPollVote: handled,
        });
      }

      // 2. Handle Reaction Events
      if (body.event === 'message.reaction') {
        return handleReactionEvent(body, fastify, reply);
      }

      const messagePayload = body.payload || body;

      // Ignore our own outbound messages to prevent loops
      if (messagePayload.fromMe === true || messagePayload._data?.id?.fromMe === true) {
        return reply.status(200).send({ ignored: true, reason: 'fromMe' });
      }

      // Deduplicate incoming message by unique message ID
      const rawMsgId =
        messagePayload.id?._serialized ||
        messagePayload.id ||
        messagePayload._data?.id?._serialized ||
        messagePayload._data?.id?.id;
      const messageId = typeof rawMsgId === 'string' ? rawMsgId : (rawMsgId ? JSON.stringify(rawMsgId) : null);

      if (messageId && isDuplicateEvent(messageId)) {
        fastify.log.info(`[WAHA Webhook] Duplicate incoming message ${messageId} ignored`);
        return reply.status(200).send({ ignored: true, reason: 'duplicate_message_id', messageId });
      }
      const rawSender = messagePayload.author || messagePayload.from || messagePayload.chatId || messagePayload.to;
      const fromChatId = typeof rawSender === 'object' ? (rawSender._serialized || rawSender.user || '') : String(rawSender);

      if (!fromChatId) {
        return reply.status(400).send({ error: 'Missing chat identifier in payload' });
      }

      fastify.log.info(`[WAHA Webhook] Incoming message from: ${fromChatId}, text: "${messagePayload.body || messagePayload.caption || ''}"`);

      // 3. Check if message is from the authorized Admin (Direct Chat / 1-on-1)
      const isGroup = fromChatId.endsWith('@g.us') || messagePayload.isGroup === true;
      if (!isGroup) {
        const handledByAdmin = await AdminChatService.handleIncomingMessage(
          fromChatId,
          messagePayload
        );
        if (handledByAdmin) {
          return reply.status(200).send({
            success: true,
            handledByAdmin: true,
          });
        }
      }

      // 4. Check if the message is coming from an active SOURCE group
      const sourceGroup = await prisma.group.findFirst({
        where: {
          wahaChatId: fromChatId,
          role: 'SOURCE',
          isActive: true,
        },
      });

      if (!sourceGroup) {
        fastify.log.info(`[WAHA Webhook] Chat ${fromChatId} is not an active SOURCE group or Admin. Ignored.`);
        return reply.status(200).send({
          ignored: true,
          reason: 'Chat is not an active SOURCE group or Admin',
          chatId: fromChatId,
        });
      }

      fastify.log.info(`[WAHA Webhook] Ingesting message from SOURCE group: ${sourceGroup.name}`);

      // Handle media download and MinIO storage if message has media
      let mediaUrl: string | null = null;
      if (messagePayload.hasMedia) {
        const mediaSource =
          messagePayload.media?.url ||
          messagePayload.mediaUrl ||
          messagePayload.media?.data ||
          messagePayload.file?.url;

        if (mediaSource) {
          try {
            mediaUrl = await wahaMediaService.downloadAndStoreMedia(
              mediaSource,
              messagePayload.media?.mimetype || messagePayload.mimetype,
              messagePayload.media?.filename || messagePayload.filename
            );
          } catch (mediaErr: any) {
            fastify.log.error(`[WAHA Webhook] Failed to upload media: ${mediaErr.message}`);
          }
        }
      }

      const textContent = messagePayload.body || messagePayload.caption || '';

      // Create Post record in DB as PENDING_APPROVAL
      const post = await prisma.post.create({
        data: {
          type: 'DARAZ',
          sourceRef: messageId || fromChatId,
          mediaUrl,
          status: 'PENDING_APPROVAL',
          rawPayload: {
            ...messagePayload,
            sourceGroupName: sourceGroup.name,
            content: textContent,
            title: textContent.split('\n')[0]?.slice(0, 120) || 'Daraz Flash Deal',
          },
        },
      });

      return reply.status(201).send({
        success: true,
        message: `Message ingested from ${sourceGroup.name} and waiting for approval`,
        postId: post.id,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * WAHA Message Reactions Webhook
   * POST /api/webhooks/waha/reactions
   */
  fastify.post('/api/webhooks/waha/reactions', async (request, reply) => {
    return handleReactionEvent(request.body, fastify, reply);
  });
};

async function handleReactionEvent(body: any, fastify: any, reply: any) {
  try {
    const payload = body.payload || body;
    const reaction = payload.reaction || payload;

    const targetMessageId = reaction.messageId || reaction.id || payload.messageId;
    const emoji = reaction.text || reaction.emoji || '👍';
    const senderId = reaction.senderId || payload.from;
    const timestamp = reaction.timestamp ? new Date(reaction.timestamp * 1000) : new Date();

    if (!targetMessageId) {
      return reply.status(400).send({ error: 'Missing target message ID in reaction payload' });
    }

    fastify.log.info(`[WAHA Reactions] Received reaction '${emoji}' for message ${targetMessageId}`);

    const post = await prisma.post.findFirst({
      where: {
        OR: [
          { wahaMessageId: targetMessageId },
          { sourceRef: targetMessageId },
        ],
      },
    });

    if (!post) {
      return reply.status(200).send({
        matched: false,
        message: 'No matching post found for reacted message ID',
      });
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        reactionsCount: { increment: 1 },
      },
    });

    const engagement = await prisma.engagement.create({
      data: {
        postId: post.id,
        type: 'REACTION',
        recordedAt: timestamp,
        metadata: {
          emoji,
          senderId,
          targetMessageId,
        },
      },
    });

    return reply.status(200).send({
      success: true,
      postId: post.id,
      engagementId: engagement.id,
    });
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ success: false, error: err.message });
  }
}
