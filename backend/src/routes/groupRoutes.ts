import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { wahaClient } from '../services/wahaClient.js';

const groupCreateSchema = z.object({
  wahaChatId: z.string().min(3),
  name: z.string().min(1),
  role: z.enum(['SOURCE', 'DESTINATION', 'NONE']).default('NONE'),
  type: z.enum(['NEWS', 'DARAZ']).default('NEWS'),
  isActive: z.boolean().default(true),
});

const groupUpdateSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['SOURCE', 'DESTINATION', 'NONE']).optional(),
  type: z.enum(['NEWS', 'DARAZ']).optional(),
  isActive: z.boolean().optional(),
});

export const groupRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/groups
   * List all configured WhatsApp groups
   */
  fastify.get('/api/groups', async (request, reply) => {
    try {
      const groups = await prisma.group.findMany({
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
      return reply.send({ success: true, data: groups });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/groups
   * Manually create or add a WhatsApp group
   */
  fastify.post('/api/groups', async (request, reply) => {
    try {
      const parsed = groupCreateSchema.parse(request.body);
      const group = await prisma.group.upsert({
        where: { wahaChatId: parsed.wahaChatId },
        create: parsed,
        update: parsed,
      });
      return reply.status(201).send({ success: true, data: group });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ success: false, errors: err.errors });
      }
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * PATCH /api/groups/:id
   * Update role (SOURCE/DESTINATION/NONE), channel type (NEWS/DARAZ), or active status
   */
  fastify.patch<{ Params: { id: string } }>('/api/groups/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const parsed = groupUpdateSchema.parse(request.body);

      const updated = await prisma.group.update({
        where: { id },
        data: parsed,
      });

      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ success: false, errors: err.errors });
      }
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * DELETE /api/groups/:id
   */
  fastify.delete<{ Params: { id: string } }>('/api/groups/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await prisma.group.delete({ where: { id } });
      return reply.send({ success: true, message: 'Group deleted successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/groups/sync
   * Fetches active chats directly from WAHA instance and imports any new groups
   */
  fastify.post('/api/groups/sync', async (request, reply) => {
    try {
      const wahaChats = await wahaClient.getChats();

      const getChatId = (c: any): string => {
        if (!c) return '';
        if (typeof c.id === 'string') return c.id;
        if (c.id && typeof c.id === 'object') {
          return c.id._serialized || (c.id.user ? `${c.id.user}@${c.id.server || 'g.us'}` : '');
        }
        return '';
      };

      const groupChats = (wahaChats || []).filter((c: any) => {
        const id = getChatId(c);
        return id.endsWith('@g.us') || c.isGroup === true;
      });

      let importedCount = 0;
      for (const chat of groupChats) {
        const chatId = getChatId(chat);
        if (!chatId) continue;

        try {
          const existing = await prisma.group.findUnique({
            where: { wahaChatId: chatId },
          });

          if (!existing) {
            await prisma.group.create({
              data: {
                wahaChatId: chatId,
                name: chat.name || `WhatsApp Group (${chatId.slice(0, 12)})`,
                role: 'NONE',
                type: 'DARAZ',
                isActive: true,
              },
            });
            importedCount++;
          } else if (chat.name && chat.name !== existing.name) {
            await prisma.group.update({
              where: { id: existing.id },
              data: { name: chat.name },
            });
          }
        } catch (innerErr: any) {
          fastify.log.warn(`[GroupSync] Skip chat ${chatId}: ${innerErr.message}`);
        }
      }

      const allGroups = await prisma.group.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        message: `Synced with WAHA. Imported ${importedCount} new groups.`,
        importedCount,
        totalGroups: allGroups.length,
        data: allGroups,
      });
    } catch (err: any) {
      fastify.log.error(err);
      const allGroups = await prisma.group.findMany({
        orderBy: { createdAt: 'desc' },
      }).catch(() => []);
      return reply.send({
        success: true,
        message: 'Could not reach WAHA live chats. Returning saved groups.',
        importedCount: 0,
        totalGroups: allGroups.length,
        data: allGroups,
      });
    }
  });
};

