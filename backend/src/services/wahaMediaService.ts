import { PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import { s3Client } from '../config/s3.js';
import { env } from '../config/env.js';

export class WahaMediaService {
  private bucket: string;
  private bucketInitialized: boolean = false;

  constructor() {
    this.bucket = env.MINIO_BUCKET;
  }

  private async ensureBucketExists(): Promise<void> {
    if (this.bucketInitialized) return;
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketInitialized = true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.log(`[MinIO] Bucket ${this.bucket} does not exist. Creating...`);
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.bucketInitialized = true;
          console.log(`[MinIO] Bucket ${this.bucket} created successfully.`);
        } catch (createErr: any) {
          console.error(`[MinIO] Failed to create bucket:`, createErr.message);
        }
      } else {
        console.warn(`[MinIO] Bucket check warning:`, err.message);
      }
    }
  }

  /**
   * Downloads incoming media from WAHA or external URL, uploads to MinIO, and returns the public URL.
   */
  async downloadAndStoreMedia(
    sourceUrlOrBase64: string,
    mimetype?: string,
    originalFilename?: string
  ): Promise<string> {
    await this.ensureBucketExists();

    let buffer: Buffer;
    let contentType = mimetype || 'application/octet-stream';
    let extension = '.jpg';

    if (sourceUrlOrBase64.startsWith('data:') || !sourceUrlOrBase64.startsWith('http')) {
      // Base64 data
      const cleanBase64 = sourceUrlOrBase64.replace(/^data:([A-Za-z-+\/]+);base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else {
      // HTTP URL (from WAHA or External Scraper)
      let fetchUrl = sourceUrlOrBase64;
      // If URL is relative or local to WAHA container
      if (fetchUrl.startsWith('/')) {
        fetchUrl = `${env.WAHA_BASE_URL}${fetchUrl}`;
      }

      console.log(`[WahaMediaService] Downloading media from: ${fetchUrl}`);
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (
        fetchUrl.includes('3000') ||
        fetchUrl.includes('/api/files') ||
        fetchUrl.includes(env.WAHA_BASE_URL)
      ) {
        headers['X-Api-Key'] = env.WAHA_API_KEY || 'waha_secret_key';
      }

      const response = await axios.get(fetchUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers,
      });

      buffer = Buffer.from(response.data);
      if (response.headers['content-type']) {
        contentType = String(response.headers['content-type']);
      }
    }

    // Determine file extension
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      extension = '.jpg';
    } else if (contentType.includes('png')) {
      extension = '.png';
    } else if (contentType.includes('webp')) {
      extension = '.webp';
    } else if (contentType.includes('mp4')) {
      extension = '.mp4';
    } else if (contentType.includes('pdf')) {
      extension = '.pdf';
    } else if (originalFilename) {
      extension = path.extname(originalFilename) || '.bin';
    }

    const uniqueId = crypto.randomUUID();
    const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const objectKey = `whatsapp/${datePrefix}/${uniqueId}${extension}`;

    // Upload to MinIO S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      })
    );

    // Form permanent public URL
    const publicUrl = `${env.MINIO_PUBLIC_URL}/${objectKey}`;
    console.log(`[WahaMediaService] Uploaded media to MinIO: ${publicUrl}`);
    return publicUrl;
  }
}

export const wahaMediaService = new WahaMediaService();

