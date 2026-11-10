import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env.js';
import { SettingsService } from './settingsService.js';

export interface WahaSendTextPayload {
  chatId: string;
  text: string;
  session?: string;
  reply_to?: string;
}

export interface WahaSendFilePayload {
  chatId: string;
  file: {
    url?: string;
    data?: string;
    mimetype?: string;
    filename?: string;
  };
  caption?: string;
  session?: string;
}

export interface WahaMessageResponse {
  id: string;
  timestamp: number;
  from?: string;
  to?: string;
  body?: string;
  hasMedia?: boolean;
}

export interface WahaChat {
  id: string;
  name: string;
  isGroup: boolean;
  unreadCount?: number;
}

export interface WahaSessionStatus {
  name: string;
  status: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';
  me?: {
    id: string;
    pushName?: string;
  } | null;
  engine?: any;
  config?: any;
}

function extractMessageId(data: any): string {
  if (!data) return '';
  const rawId = data.id || data._data?.id;
  if (!rawId) return '';
  if (typeof rawId === 'string') return rawId;
  if (typeof rawId === 'object') {
    return rawId._serialized || rawId.id || JSON.stringify(rawId);
  }
  return String(rawId);
}

export class WahaClient {
  private client: AxiosInstance;
  private session: string;

  constructor() {
    this.session = env.WAHA_SESSION;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (env.WAHA_API_KEY) {
      headers['X-Api-Key'] = env.WAHA_API_KEY;
    }

    this.client = axios.create({
      baseURL: env.WAHA_BASE_URL,
      timeout: 30000,
      headers,
    });
  }

  async getActiveSession(): Promise<string> {
    try {
      const configured = await SettingsService.get('wahaSessionName');
      if (configured && configured.trim()) {
        return configured.trim();
      }
    } catch {}
    return this.session || 'default';
  }

  async sendTextMessage(chatId: string, text: string, sessionName?: string): Promise<WahaMessageResponse | null> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const payload: WahaSendTextPayload = {
        session,
        chatId,
        text,
      };
      const response = await this.client.post('/api/sendText', payload);
      const cleanId = extractMessageId(response.data);
      return {
        ...response.data,
        id: cleanId,
      };
    } catch (error: any) {
      console.error(`[WAHA] Error sending text to ${chatId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async sendFileMessage(
    chatId: string,
    fileUrl: string,
    caption?: string,
    filename: string = 'product.jpg',
    mimetype: string = 'image/jpeg',
    sessionName?: string
  ): Promise<WahaMessageResponse | null> {
    try {
      const session = sessionName || (await this.getActiveSession());
      let resolvedFileUrl = fileUrl;
      if (
        resolvedFileUrl.includes('localhost:9000') ||
        resolvedFileUrl.includes('127.0.0.1:9000')
      ) {
        resolvedFileUrl = resolvedFileUrl.replace(
          /http:\/\/(localhost|127\.0\.0\.1):9000/,
          'http://minio:9000'
        );
      }

      const isImage =
        mimetype.startsWith('image/') ||
        /\.(jpe?g|png|webp|gif)/i.test(filename) ||
        /\.(jpe?g|png|webp|gif)/i.test(resolvedFileUrl.split('?')[0]);

      // If it is an image, download buffer to base64 so WAHA doesn't have network or hash mismatch issues
      let filePayload: { url?: string; data?: string; filename?: string; mimetype?: string } = {
        url: resolvedFileUrl,
        filename,
        mimetype,
      };

      if (isImage && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
        try {
          const fetchUrl = fileUrl.includes('minio:9000')
            ? fileUrl.replace('minio:9000', 'localhost:9000')
            : fileUrl;

          const imgRes = await axios.get(fetchUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
          });
          const base64Data = Buffer.from(imgRes.data).toString('base64');
          const rawContentType = imgRes.headers['content-type'];
          const serverMime = typeof rawContentType === 'string' ? rawContentType.split(';')[0]?.trim() : undefined;
          filePayload = {
            data: base64Data,
            filename: filename || 'product.jpg',
            mimetype: serverMime || mimetype || 'image/jpeg',
          };
        } catch (fetchErr: any) {
          console.warn(`[WAHA] Could not pre-fetch image buffer, falling back to url:`, fetchErr.message);
        }
      }

      const payload: WahaSendFilePayload = {
        session,
        chatId,
        file: filePayload,
        caption,
      };

      let response;
      if (isImage) {
        try {
          response = await this.client.post('/api/sendImage', payload);
        } catch (imgErr: any) {
          console.warn(`[WAHA] /api/sendImage failed, trying /api/sendFile:`, imgErr.response?.data || imgErr.message);
          response = await this.client.post('/api/sendFile', payload);
        }
      } else {
        response = await this.client.post('/api/sendFile', payload);
      }

      const cleanId = extractMessageId(response.data);
      return {
        ...response.data,
        id: cleanId,
      };
    } catch (error: any) {
      console.error(`[WAHA] Error sending file to ${chatId}:`, error.response?.data || error.message);
      if (caption) {
        console.log(`[WAHA] Falling back to text message for ${chatId}...`);
        return await this.sendTextMessage(chatId, caption, sessionName);
      }
      throw error;
    }
  }

  async sendPoll(
    chatId: string,
    poll: { name: string; options: string[]; multipleAnswers?: boolean },
    sessionName?: string
  ): Promise<WahaMessageResponse | null> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const payload = {
        session,
        chatId,
        poll: {
          name: poll.name,
          options: poll.options,
          multipleAnswers: poll.multipleAnswers ?? false,
        },
      };
      const response = await this.client.post('/api/sendPoll', payload);
      const cleanId = extractMessageId(response.data);
      return {
        ...response.data,
        id: cleanId,
      };
    } catch (error: any) {
      console.error(`[WAHA] Error sending poll to ${chatId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getContact(contactId: string, sessionName?: string): Promise<any | null> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const response = await this.client.get(`/api/${session}/contacts/${encodeURIComponent(contactId)}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async getChats(sessionName?: string): Promise<WahaChat[]> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const response = await this.client.get(`/api/${session}/chats`, { timeout: 8000 });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      console.warn(`[WAHA] Warning: Could not fetch chats:`, error.response?.data || error.message);
      return [];
    }
  }

  async getSessionStatus(sessionName?: string): Promise<WahaSessionStatus | null> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const response = await this.client.get(`/api/sessions/${session}`);
      return response.data;
    } catch (error: any) {
      console.warn(`[WAHA] Error getting session status:`, error.response?.data || error.message);
      return null;
    }
  }

  async getQRCodeDataUri(sessionName?: string): Promise<string | null> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const response = await this.client.get(`/api/${session}/auth/qr`, {
        responseType: 'arraybuffer',
      });
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error: any) {
      console.warn(`[WAHA] Error fetching QR code:`, error.response?.data || error.message);
      return null;
    }
  }

  async startSession(sessionName?: string): Promise<boolean> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const current = await this.getSessionStatus(session);
      if (current?.status === 'FAILED') {
        try {
          await this.client.post('/api/sessions/stop', { name: session });
        } catch {}
      }
      await this.client.post('/api/sessions/start', { name: session });
      this.session = session;
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || '';
      if (msg.includes('already started') || error.response?.status === 422) {
        const session = sessionName || (await this.getActiveSession());
        this.session = session;
        return true;
      }
      console.warn(`[WAHA] Error starting session ${sessionName}:`, error.response?.data || error.message);
      return false;
    }
  }

  async ensureWebhookConfigured(sessionName?: string): Promise<boolean> {
    try {
      const session = sessionName || (await this.getActiveSession());
      const webhookUrl = 'http://172.18.0.1:4000/api/webhooks/waha/incoming';
      const status = await this.getSessionStatus(session);
      const existingWebhooks = (status?.config as any)?.webhooks || [];
      const hasHook = existingWebhooks.some((w: any) => w.url === webhookUrl);

      if (!hasHook) {
        console.log(`[WAHA] Registering webhook for session ${session} -> ${webhookUrl}`);
        await this.client.put(`/api/sessions/${session}`, {
          config: {
            webhooks: [
              {
                url: webhookUrl,
                events: ['message', 'poll.vote', 'session.status'],
              },
            ],
          },
        });
      }
      return true;
    } catch (err: any) {
      console.warn(`[WAHA] Warning: Could not configure webhook:`, err.response?.data || err.message);
      return false;
    }
  }

  async restartSession(sessionName?: string): Promise<boolean> {
    try {
      const session = sessionName || (await this.getActiveSession());
      await this.client.post('/api/sessions/restart', { name: session });
      return true;
    } catch {
      return false;
    }
  }

  async logoutSession(sessionName?: string): Promise<boolean> {
    try {
      const session = sessionName || (await this.getActiveSession());
      await this.client.post('/api/sessions/logout', { name: session });
      return true;
    } catch {
      return false;
    }
  }

  async deleteSession(sessionName: string): Promise<boolean> {
    try {
      await this.client.delete(`/api/sessions/${encodeURIComponent(sessionName)}`);
      return true;
    } catch (err: any) {
      console.warn(`[WAHA] Error deleting session ${sessionName}:`, err.response?.data || err.message);
      return false;
    }
  }

  async getAllSessions(): Promise<any[]> {
    try {
      const response = await this.client.get('/api/sessions');
      return response.data || [];
    } catch {
      return [];
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const wahaClient = new WahaClient();
