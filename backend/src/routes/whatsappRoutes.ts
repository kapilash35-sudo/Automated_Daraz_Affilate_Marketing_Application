import { FastifyPluginAsync } from 'fastify';
import { wahaClient } from '../services/wahaClient.js';
import { SettingsService } from '../services/settingsService.js';

export const whatsappRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/whatsapp/status
   * Returns WhatsApp connection status for current active session or specified ?session=
   */
  fastify.get('/api/whatsapp/status', async (request, reply) => {
    try {
      const query = request.query as any;
      const targetSession = query?.session || (await wahaClient.getActiveSession());
      const session = await wahaClient.getSessionStatus(targetSession);

      if (!session) {
        return reply.send({
          connected: false,
          status: 'STOPPED',
          session: targetSession,
          me: null,
        });
      }

      return reply.send({
        connected: session.status === 'WORKING',
        status: session.status,
        session: session.name,
        me: session.me || null,
        engine: session.engine || null,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/whatsapp/qr
   * Returns base64 PNG QR code data URI for active session or specified ?session=
   */
  fastify.get('/api/whatsapp/qr', async (request, reply) => {
    try {
      const query = request.query as any;
      const targetSession = query?.session || (await wahaClient.getActiveSession());
      const session = await wahaClient.getSessionStatus(targetSession);
      const qrDataUri = await wahaClient.getQRCodeDataUri(targetSession);

      return reply.send({
        status: session?.status || 'SCAN_QR_CODE',
        connected: session?.status === 'WORKING',
        session: targetSession,
        qr: qrDataUri,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/whatsapp/start
   * Creates/starts session in WAHA and saves wahaSessionName in DB
   */
  fastify.post('/api/whatsapp/start', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const targetSession = (body?.session || (await wahaClient.getActiveSession())).trim();

      const ok = await wahaClient.startSession(targetSession);
      if (ok) {
        await SettingsService.set('wahaSessionName', targetSession);
      }

      return reply.send({
        success: ok,
        session: targetSession,
        message: ok ? `Session "${targetSession}" created / started successfully` : 'Failed to start session',
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * GET /api/whatsapp/sessions
   * Returns all available sessions from WAHA
   */
  fastify.get('/api/whatsapp/sessions', async (request, reply) => {
    try {
      const sessions = await wahaClient.getAllSessions();
      const activeSession = await wahaClient.getActiveSession();
      return reply.send({
        activeSession,
        sessions,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/whatsapp/restart
   */
  fastify.post('/api/whatsapp/restart', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const targetSession = body?.session || (await wahaClient.getActiveSession());
      const ok = await wahaClient.restartSession(targetSession);
      return reply.send({ success: ok, session: targetSession });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/whatsapp/logout
   */
  fastify.post('/api/whatsapp/logout', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const targetSession = body?.session || (await wahaClient.getActiveSession());
      const ok = await wahaClient.logoutSession(targetSession);
      return reply.send({ success: ok, session: targetSession });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * DELETE /api/whatsapp/sessions/:session
   * Deletes a session and wipes its data in WAHA
   */
  fastify.delete('/api/whatsapp/sessions/:session', async (request, reply) => {
    try {
      const { session } = request.params as { session: string };
      if (!session) {
        return reply.status(400).send({ error: 'Session name is required' });
      }

      const ok = await wahaClient.deleteSession(session);
      return reply.send({ success: ok, session });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ error: err.message });
    }
  });
};

