import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/whatsapp_marketing?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // MinIO / S3
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('whatsapp-media'),
  MINIO_PUBLIC_URL: z.string().default('http://localhost:9000/whatsapp-media'),

  // WAHA
  WAHA_BASE_URL: z.string().default('http://localhost:3000'),
  WAHA_SESSION: z.string().default('default'),
  WAHA_API_KEY: z.string().default('waha_secret_key'),

  // Gemini AI - Explicitly user requested: gemini-3.0
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.0'),

  // Business Rules
  BASE_REDIRECT_URL: z.string().default('http://localhost:4000'),
  DAILY_NEWS_LIMIT: z.coerce.number().default(50),
  DISPATCH_DELAY_MS: z.coerce.number().default(30000),
});

export const env = envSchema.parse(process.env);
