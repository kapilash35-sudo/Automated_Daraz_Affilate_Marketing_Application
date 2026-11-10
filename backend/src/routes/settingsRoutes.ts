import { FastifyPluginAsync } from 'fastify';
import { SettingsService } from '../services/settingsService.js';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/settings
   * Returns all system settings
   */
  fastify.get('/api/settings', async (request, reply) => {
    try {
      const settings = await SettingsService.getAll();
      return reply.send({ success: true, data: settings });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  /**
   * PATCH /api/settings
   * Updates system settings
   */
  fastify.patch('/api/settings', async (request, reply) => {
    try {
      const body = request.body as Record<string, string>;
      if (!body || typeof body !== 'object') {
        return reply.status(400).send({ success: false, error: 'Invalid settings payload' });
      }

      const updated = await SettingsService.updateAll(body);
      return reply.send({ success: true, message: 'Settings saved successfully', data: updated });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });
};

