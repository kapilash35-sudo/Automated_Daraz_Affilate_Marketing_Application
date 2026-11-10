import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export interface NewsJobData {
  postId: string;
  source: 'SCRAPER' | 'WAHA_SOURCE_GROUP';
  rawPayload: any;
}

export interface DarazJobData {
  postId: string;
  source: 'SCRAPER' | 'WAHA_SOURCE_GROUP';
  rawPayload: any;
}

export const newsQueue = new Queue<NewsJobData>('news-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const darazQueue = new Queue<DarazJobData>('daraz-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function addNewsJob(data: NewsJobData) {
  try {
    const existing = await newsQueue.getJob(`news-${data.postId}`);
    if (existing) await existing.remove();
  } catch {}
  return await newsQueue.add(`news-job-${data.postId}`, data, {
    jobId: `news-${data.postId}-${Date.now()}`,
  });
}

export async function addDarazJob(data: DarazJobData) {
  try {
    const existing = await darazQueue.getJob(`daraz-${data.postId}`);
    if (existing) await existing.remove();
  } catch {}
  return await darazQueue.add(`daraz-job-${data.postId}`, data, {
    jobId: `daraz-${data.postId}-${Date.now()}`,
  });
}

