import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { redisConnection } from './config/redis.js';
import { ingestionRoutes } from './routes/ingestionRoutes.js';
import { wahaWebhookRoutes } from './routes/wahaWebhookRoutes.js';
import { redirectRoutes } from './routes/redirectRoutes.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { groupRoutes } from './routes/groupRoutes.js';
import { whatsappRoutes } from './routes/whatsappRoutes.js';
import { dealRoutes } from './routes/dealRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { createNewsWorker } from './queues/newsWorker.js';
import { createDarazWorker } from './queues/darazWorker.js';
import { wahaClient } from './services/wahaClient.js';

async function bootstrap() {
  const fastify = Fastify({
    logger: {
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // 1. Plugins
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(formbody);

  // 2. Swagger Documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'WhatsApp Automation & Marketing Engine API',
        description:
          'High-throughput WhatsApp media ingestion, AI deduplication, copywriting and affiliate tracking engine.',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${env.HOST}:${env.PORT}`,
          description: 'Current Environment Server',
        },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // 3. Healthcheck
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // 4. Register Route Modules
  await fastify.register(ingestionRoutes);
  await fastify.register(wahaWebhookRoutes);
  await fastify.register(redirectRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(groupRoutes);
  await fastify.register(whatsappRoutes);
  await fastify.register(dealRoutes);
  await fastify.register(settingsRoutes);

  // 5. Initialize BullMQ Workers
  fastify.log.info('Initializing BullMQ Background Workers for News and Daraz pipelines...');
  const newsWorker = createNewsWorker();
  const darazWorker = createDarazWorker();

  // 6. Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info(`Received ${signal}. Gracefully closing services...`);
      try {
        await newsWorker.close();
        await darazWorker.close();
        await fastify.close();
        await prisma.$disconnect();
        redisConnection.disconnect();
        process.exit(0);
      } catch (err) {
        fastify.log.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  // 7. Start HTTP Server
  try {
    const address = await fastify.listen({ port: env.PORT, host: env.HOST });
    fastify.log.info(`🚀 WhatsApp Automation Engine listening on ${address}`);
    fastify.log.info(`📖 Interactive API Documentation available at ${address}/docs`);

    // 8. Auto-verify WAHA webhook registration
    wahaClient.ensureWebhookConfigured().catch((err) => {
      fastify.log.warn(`Could not register WAHA webhook: ${err.message}`);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();

