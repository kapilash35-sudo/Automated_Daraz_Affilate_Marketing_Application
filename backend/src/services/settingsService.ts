import { prisma } from '../config/prisma.js';

export class SettingsService {
  private static defaultSettings: Record<string, string> = {
    adminPhone: '',
    communityInviteUrl: 'https://chat.whatsapp.com/',
    communityInviteUrlSinhala: 'https://chat.whatsapp.com/',
    autoApprove: 'false',
    conversionRate: '0.025',
    avgCommission: '380',
    wahaSessionName: 'default',
  };

  /**
   * Retrieves a setting by key, with optional fallback default.
   */
  static async get(key: string, defaultValue?: string): Promise<string> {
    try {
      const record = await prisma.systemSetting.findUnique({
        where: { key },
      });
      if (record) return record.value;
      return defaultValue ?? this.defaultSettings[key] ?? '';
    } catch {
      return defaultValue ?? this.defaultSettings[key] ?? '';
    }
  }

  /**
   * Saves or updates a setting.
   */
  static async set(key: string, value: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /**
   * Retrieves all system settings.
   */
  static async getAll(): Promise<Record<string, string>> {
    try {
      const records = await prisma.systemSetting.findMany();
      const result: Record<string, string> = { ...this.defaultSettings };
      for (const rec of records) {
        result[rec.key] = rec.value;
      }
      return result;
    } catch {
      return { ...this.defaultSettings };
    }
  }

  /**
   * Bulk updates settings.
   */
  static async updateAll(settings: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value === 'string') {
        await this.set(key, value);
      }
    }
    return this.getAll();
  }
}

