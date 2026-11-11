import { redisConnection } from '../config/redis.js';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { wahaClient } from './wahaClient.js';
import { wahaMediaService } from './wahaMediaService.js';
import { DarazExtractor } from './darazExtractor.js';
import { copywritingService } from './copywritingService.js';
import { SettingsService } from './settingsService.js';
import { addDarazJob } from '../queues/queueManager.js';

export interface AdminConversationState {
  state:
    | 'IDLE'
    | 'AWAITING_PHOTO_CHOICE'
    | 'AWAITING_MANUAL_PHOTO'
    | 'AWAITING_DEAL_TEXT'
    | 'AWAITING_COMMISSION'
    | 'AWAITING_NEW_GROUP_LINK'
    | 'AWAITING_TAMIL_GROUP_LINK'
    | 'AWAITING_SINHALA_GROUP_LINK'
    | 'AWAITING_APPROVAL';
  uploadedMediaUrl?: string;
  photoMode?: 'MANUAL' | 'AUTO' | 'NONE';
  pendingDealData?: any;
  pendingPostId?: string;
  timestamp: number;
}

export class AdminChatService {
  private static STATE_TTL = 900; // 15 minutes
  private static knownAdminLids = new Set<string>();

  /**
   * Normalizes phone numbers to compare (removes @c.us, @lid, device suffix, +, -, spaces).
   */
  static cleanPhone(phone: any): string {
    if (!phone) return '';
    const str = typeof phone === 'object' ? (phone._serialized || phone.user || '') : String(phone);
    // Remove device suffix like :7@c.us, remove @c.us, @lid, @s.whatsapp.net
    const base = str.split('@')[0].split(':')[0];
    return base.replace(/[^0-9]/g, '');
  }

  /**
   * Returns the canonical WhatsApp JID for the configured admin (e.g. 947XXXXXXXX@c.us).
   */
  static async getAdminChatId(): Promise<string> {
    const configuredAdmin = await SettingsService.get('adminPhone');
    const clean = this.cleanPhone(configuredAdmin);
    return clean ? `${clean}@c.us` : '';
  }

  /**
   * Checks whether the incoming sender or voter is the authorized Admin.
   * Handles both normal phone numbers and WhatsApp Linked Identity (LID) formats.
   */
  static async isAdmin(senderPhone: any): Promise<boolean> {
    if (!senderPhone) return false;
    const configuredAdmin = await SettingsService.get('adminPhone');
    const cleanSender = this.cleanPhone(senderPhone);
    const cleanConfigured = this.cleanPhone(configuredAdmin);

    // If no admin is configured yet, auto-register the first sender
    if (!cleanConfigured || cleanConfigured.trim() === '') {
      if (cleanSender) {
        console.log(`[AdminChat] No Admin phone configured. Auto-registering ${cleanSender} as Admin.`);
        await SettingsService.set('adminPhone', cleanSender);
        return true;
      }
      return false;
    }

    // Direct phone match (e.g. 947XXXXXXXX vs 07XXXXXXXX)
    const isDirectMatch =
      cleanSender === cleanConfigured ||
      (cleanSender.length >= 7 && cleanConfigured.length >= 7 && (
        cleanSender.endsWith(cleanConfigured.slice(-8)) ||
        cleanConfigured.endsWith(cleanSender.slice(-8))
      ));

    if (isDirectMatch) return true;

    // Check cached known admin LIDs
    const senderStr = typeof senderPhone === 'object' ? (senderPhone._serialized || senderPhone.user || '') : String(senderPhone);
    if (this.knownAdminLids.has(cleanSender) || this.knownAdminLids.has(senderStr)) {
      return true;
    }

    // Check if sender is an LID or has an unusual format, resolve via WAHA contact API
    if (cleanSender && cleanSender.length >= 7 && (senderStr.includes('@lid') || cleanSender.length > 12)) {
      try {
        const contact = await wahaClient.getContact(senderStr.includes('@') ? senderStr : `${cleanSender}@lid`);
        if (contact?.id) {
          const resolvedClean = this.cleanPhone(contact.id);
          if (
            resolvedClean === cleanConfigured ||
            (resolvedClean.length >= 7 && cleanConfigured.length >= 7 && (
              resolvedClean.endsWith(cleanConfigured.slice(-8)) ||
              cleanConfigured.endsWith(resolvedClean.slice(-8))
            ))
          ) {
            this.knownAdminLids.add(cleanSender);
            this.knownAdminLids.add(senderStr);
            if (contact.number) this.knownAdminLids.add(contact.number);
            console.log(`[AdminChat] Resolved LID ${senderStr} to Admin ${resolvedClean}`);
            return true;
          }
        }
      } catch (err: any) {
        console.warn(`[AdminChat] Error resolving contact for ${senderStr}:`, err.message);
      }
    }

    console.log(`[AdminChat] Sender ${cleanSender} (${senderStr}) does NOT match Configured Admin ${cleanConfigured}`);
    return false;
  }

  /**
   * Retrieves conversation state from Redis.
   */
  static async getState(phone: string): Promise<AdminConversationState> {
    const clean = this.cleanPhone(phone);
    const raw = await redisConnection.get(`admin_state:${clean}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return { state: 'IDLE', timestamp: Date.now() };
  }

  /**
   * Updates conversation state in Redis.
   */
  static async setState(phone: string, state: Partial<AdminConversationState>): Promise<void> {
    const clean = this.cleanPhone(phone);
    const current = await this.getState(clean);
    const updated: AdminConversationState = {
      ...current,
      ...state,
      timestamp: Date.now(),
    };
    await redisConnection.setex(
      `admin_state:${clean}`,
      this.STATE_TTL,
      JSON.stringify(updated)
    );
  }

  /**
   * Resets conversation state back to IDLE.
   */
  static async resetState(phone: string): Promise<void> {
    const clean = this.cleanPhone(phone);
    await redisConnection.del(`admin_state:${clean}`);
  }

  /**
   * Unified dispatcher for Admin actions (handles both Poll Clicks AND Number/Text Replies).
   */
  static async processAdminChoice(
    cleanFrom: string,
    formattedChatId: string,
    choiceText: string,
    currentState: AdminConversationState
  ): Promise<boolean> {
    const choice = choiceText.trim().toLowerCase();
    console.log(`[AdminChat] Processing admin choice: "${choiceText}" in state: ${currentState.state}`);

    // ==========================================
    // 1. STATE: AWAITING_PHOTO_CHOICE (or Photo Choice Poll Vote)
    // ==========================================
    const isPhotoChoice =
      currentState.state === 'AWAITING_PHOTO_CHOICE' ||
      choice.includes('சொந்த போட்டோ') ||
      choice.includes('upload photo') ||
      choice.includes('தானாக') ||
      choice.includes('auto photo') ||
      choice.includes('போட்டோ இல்லாமல்') ||
      choice.includes('text only');

    if (isPhotoChoice) {
      // Option 1: Manual Photo Upload
      if (
        choice === '1' ||
        choice.startsWith('1') ||
        choice.includes('சொந்த போட்டோ') ||
        choice.includes('நான் போட்டோ') ||
        choice.includes('upload photo')
      ) {
        await this.setState(cleanFrom, {
          state: 'AWAITING_MANUAL_PHOTO',
          photoMode: 'MANUAL',
          uploadedMediaUrl: undefined,
        });
        await wahaClient.sendTextMessage(
          formattedChatId,
          `📷 *அருமை! பொருளின் புகைப்படத்தை (Product Photo) இப்போது அனுப்புங்கள்...*`
        );
        return true;
      }

      // Option 2: Auto Scrape from Daraz
      if (
        choice === '2' ||
        choice.startsWith('2') ||
        choice.includes('தானாக') ||
        choice.includes('auto photo') ||
        choice === 'auto'
      ) {
        await this.setState(cleanFrom, {
          state: 'AWAITING_DEAL_TEXT',
          photoMode: 'AUTO',
          uploadedMediaUrl: undefined,
        });
        await wahaClient.sendTextMessage(
          formattedChatId,
          `🔗 *சரி! Daraz-ல் இருந்து Copied Text மற்றும் Link-ஐ இப்போது இங்கே அனுப்புங்கள்...*\n(படம் Daraz தளத்தில் இருந்து தானாகவே எடுக்கப்படும்)`
        );
        return true;
      }

      // Option 3: Text Only Ad (No Photo)
      if (
        choice === '3' ||
        choice.startsWith('3') ||
        choice.includes('போட்டோ இல்லாமல்') ||
        choice.includes('text only') ||
        choice.includes('no photo')
      ) {
        await this.setState(cleanFrom, {
          state: 'AWAITING_DEAL_TEXT',
          photoMode: 'NONE',
          uploadedMediaUrl: 'NONE',
        });
        await wahaClient.sendTextMessage(
          formattedChatId,
          `📝 *சரி! நீங்கள் Daraz Link மற்றும் விவரங்களை இப்போது இங்கே அனுப்புங்கள்...*\n(புகைப்படம் இல்லாமல் கவர்ச்சிகரமான Text விளம்பரமாக தயாராகும்)`
        );
        return true;
      }

      // Option 4: Back to Main Menu
      if (
        choice === '4' ||
        choice.startsWith('4') ||
        choice.includes('பிரதான மெனு') ||
        choice.includes('back')
      ) {
        await this.resetState(cleanFrom);
        await this.sendMainMenu(formattedChatId);
        return true;
      }
    }

    // ==========================================
    // 2. STATE: AWAITING_APPROVAL (or Approval Poll Vote)
    // ==========================================
    const isApprovalChoice =
      currentState.state === 'AWAITING_APPROVAL' ||
      choice.includes('ஆம்') ||
      choice.includes('approve') ||
      choice.includes('மீண்டும்') ||
      choice.includes('regenerate');

    if (isApprovalChoice) {
      // Option 1: Approve and Broadcast
      if (
        choice === '1' ||
        choice.startsWith('1') ||
        choice.includes('ஆம்') ||
        choice.includes('approve') ||
        choice.includes('yes') ||
        choice.includes('ok')
      ) {
        let targetPostId = currentState.pendingPostId;
        if (!targetPostId) {
          const latestPending = await prisma.post.findFirst({
            where: { type: 'DARAZ', status: 'PENDING_APPROVAL' },
            orderBy: { createdAt: 'desc' },
          });
          targetPostId = latestPending?.id;
        }

        if (!targetPostId) {
          await wahaClient.sendTextMessage(formattedChatId, `⚠️ ஒப்புதல் செய்வதற்கு புதிய டீல்கள் எதுவும் காத்திருக்கவில்லை.`);
          return true;
        }

        const destinationGroups = await prisma.group.findMany({
          where: { role: 'DESTINATION', type: 'DARAZ', isActive: true },
        });

        if (destinationGroups.length === 0) {
          await wahaClient.sendTextMessage(
            formattedChatId,
            `⚠️ *எச்சரிக்கை:* Dashboard-ல் எந்த WhatsApp குரூப்பும் (DESTINATION) தேர்ந்தெடுக்கப்படவில்லை. Settings-ல் குரூப்களை இயக்கவும்.`
          );
          return true;
        }

        await addDarazJob({
          postId: targetPostId,
          source: 'WAHA_SOURCE_GROUP',
          rawPayload: {},
        });

        const tamilCount = destinationGroups.filter(g => g.language === 'TAMIL' || g.language === 'ALL').length;
        const sinhalaCount = destinationGroups.filter(g => g.language === 'SINHALA' || g.language === 'ALL').length;

        await wahaClient.sendTextMessage(
          formattedChatId,
          `🚀 *விளம்பரம் ஒப்புதல் அளிக்கப்பட்டது!*\n\nவிளம்பரம் *${destinationGroups.length} குரூப்களுக்கும்* (${tamilCount} தமிழ் + ${sinhalaCount} சிங்களம்) 30 விநாடி இடைவெளியில் அனுப்பப்பட்டு வருகிறது.`
        );

        await this.resetState(cleanFrom);
        return true;
      }

      // Option 2: Regenerate Copy
      if (
        choice === '2' ||
        choice.startsWith('2') ||
        choice.includes('மீண்டும்') ||
        choice.includes('regenerate')
      ) {
        if (currentState.pendingPostId) {
          const post = await prisma.post.findUnique({
            where: { id: currentState.pendingPostId },
          });

          if (post) {
            const payload: any = post.rawPayload || {};
            const communityInviteUrl = await SettingsService.get('communityInviteUrl');
            const communityInviteUrlSinhala = await SettingsService.get('communityInviteUrlSinhala');

            await wahaClient.sendTextMessage(formattedChatId, `⏳ *Gemini மூலம் புதிய தமிழ் மற்றும் சிங்கள விளம்பரங்கள் தயாராகின்றன...*`);

            const trackingUrl = `${env.BASE_REDIRECT_URL}/r/${post.id}`;
            const { tamilText, sinhalaText } = await copywritingService.generateBilingualDarazDeals({
              title: payload.title,
              originalPrice: payload.originalPrice,
              discountPrice: payload.discountPrice,
              discountPercentage: payload.discountPercentage,
              affiliateRedirectUrl: trackingUrl,
              communityInviteUrl,
              communityInviteUrlSinhala,
            });

            await prisma.post.update({
              where: { id: post.id },
              data: {
                processedText: tamilText,
                processedTextSinhala: sinhalaText,
              },
            });

            const destinationGroups = await prisma.group.findMany({
              where: { role: 'DESTINATION', type: 'DARAZ', isActive: true },
            });
            const tamilCount = destinationGroups.filter(g => g.language === 'TAMIL' || g.language === 'ALL').length;
            const sinhalaCount = destinationGroups.filter(g => g.language === 'SINHALA' || g.language === 'ALL').length;

            const commAmount = payload.commissionAmount || 0;
            const previewHeader = `📸 *புதிய விளம்பர மாதிரி (New Ad Preview)*\n\n💰 *உண்மையான கமிஷன்:* Rs. ${commAmount} / order\n👥 *சென்றடையும் குரூப்கள்:* ${tamilCount} தமிழ் | ${sinhalaCount} சிங்களம்`;

            if (post.mediaUrl && post.mediaUrl !== 'NONE') {
              await wahaClient.sendFileMessage(
                formattedChatId,
                post.mediaUrl,
                previewHeader,
                'product.jpg',
                'image/jpeg'
              );
            }

            // Send Tamil & Sinhala copies
            await wahaClient.sendTextMessage(
              formattedChatId,
              `🇱🇰 *[தமிழ் விளம்பரம் - Tamil Copy]*\n━━━━━━━━━━━━━━━━━━━━\n${tamilText}`
            );
            await wahaClient.sendTextMessage(
              formattedChatId,
              `🇱🇰 *[சிங்கள விளம்பரம் - Sinhala Copy]*\n━━━━━━━━━━━━━━━━━━━━\n${sinhalaText}`
            );

            await this.sendApprovalMenu(formattedChatId, destinationGroups.length, post.id);
            return true;
          }
        }
      }

      // Option 3: Cancel Deal
      if (
        choice === '3' ||
        choice.startsWith('3') ||
        choice.includes('ரத்து') ||
        choice.includes('cancel') ||
        choice.includes('no')
      ) {
        if (currentState.pendingPostId) {
          await prisma.post.update({
            where: { id: currentState.pendingPostId },
            data: { status: 'REJECTED' },
          });
        }
        await this.resetState(cleanFrom);
        await wahaClient.sendTextMessage(formattedChatId, `❌ *விளம்பரம் ரத்து செய்யப்பட்டது.*`);
        return true;
      }
    }

    // ==========================================
    // 3. MAIN MENU CHOICES (ONLY if state is IDLE or unset)
    // ==========================================
    if (currentState.state === 'IDLE' || !currentState.state) {
      // Option 1: Post New Ad
      if (
        choice === '1' ||
        choice.startsWith('1') ||
        choice.includes('புதிய விளம்பரம்') ||
        choice.includes('post ad') ||
        choice === 'ad' ||
        choice === 'post'
      ) {
        await this.setState(cleanFrom, { state: 'AWAITING_PHOTO_CHOICE' });
        await this.sendPhotoChoiceMenu(formattedChatId);
        return true;
      }

      // Option 2: Update Group Link
      if (
        choice === '2' ||
        choice.startsWith('2') ||
        choice.includes('குரூப் லிங்க்') ||
        choice.includes('update link') ||
        choice === 'link'
      ) {
        const tamilLink = await SettingsService.get('communityInviteUrl');
        const sinhalaLink = await SettingsService.get('communityInviteUrlSinhala');
        await this.setState(cleanFrom, { state: 'AWAITING_NEW_GROUP_LINK' });
        await wahaClient.sendTextMessage(
          formattedChatId,
          `🔗 *குரூப் இன்வைட் லிங்க் மாற்றம் (Community Link Settings)*\n\n` +
          `📌 *1. தமிழ் குரூப் லிங்க்:*\n👉 ${tamilLink || 'இன்னும் அமைக்கப்படவில்லை'}\n\n` +
          `📌 *2. சிங்கள குரூப் லிங்க்:*\n👉 ${sinhalaLink || 'இன்னும் அமைக்கப்படவில்லை'}\n\n` +
          `எந்த லிங்கை மாற்ற வேண்டும்?\n` +
          `1️⃣ *தமிழ் குரூப் லிங்க் மாற்ற* (Reply 1)\n` +
          `2️⃣ *சிங்கள குரூப் லிங்க் மாற்ற* (Reply 2)\n\n` +
          `_அல்லது புதிய லிங்கை நேரடியாக அனுப்பவும் (எ.கா: https://chat.whatsapp.com/...)_`
        );
        return true;
      }

      // Option 3: Today Stats
      if (
        choice === '3' ||
        choice.startsWith('3') ||
        choice.includes('இன்றைய நிலவரம்') ||
        choice.includes('today stats') ||
        choice === 'stats'
      ) {
        await this.sendTodayStats(formattedChatId);
        return true;
      }

      // Option 4: Close Menu
      if (
        choice === '4' ||
        choice.startsWith('4') ||
        choice.includes('மெனுவை மூடுக') ||
        choice.includes('close') ||
        choice === 'exit'
      ) {
        await this.resetState(cleanFrom);
        await wahaClient.sendTextMessage(formattedChatId, `👍 *மெனு மூடப்பட்டது.* தேவைப்படும்போது 'Hi' என அனுப்பவும்.`);
        return true;
      }
    }

    return false;
  }

  /**
   * Handles incoming text & media messages from the Admin.
   */
  static async handleIncomingMessage(
    fromChatId: string,
    messagePayload: any
  ): Promise<boolean> {
    if (!(await this.isAdmin(fromChatId))) {
      return false; // Not admin, let default webhook logic handle it
    }

    const text = (messagePayload.body || messagePayload.caption || '').trim();
    const cleanFrom = this.cleanPhone((await SettingsService.get('adminPhone')) || fromChatId);
    const formattedChatId = fromChatId || (await this.getAdminChatId());
    const currentState = await this.getState(cleanFrom);

    console.log(`[AdminChat] Processing message from Admin in state: ${currentState.state}, text: "${text}", hasMedia: ${!!messagePayload.hasMedia}`);

    // 1. Universal Reset Commands: "hi", "hello", "menu", "start", "வணக்கம்", "restart"
    if (/^(hi|hello|menu|start|வணக்கம்|restart)$/i.test(text)) {
      await this.resetState(cleanFrom);
      await this.sendMainMenu(formattedChatId);
      return true;
    }

    // 2. Universal Cancel Command
    if (/^(cancel|ரத்து)$/i.test(text)) {
      if (currentState.pendingPostId) {
        await prisma.post.update({
          where: { id: currentState.pendingPostId },
          data: { status: 'REJECTED' },
        }).catch(() => {});
      }
      await this.resetState(cleanFrom);
      await wahaClient.sendTextMessage(formattedChatId, `❌ *நடவடிக்கை ரத்து செய்யப்பட்டது.* தேவைப்படும்போது 'Hi' என அனுப்பவும்.`);
      return true;
    }

    // 3. State: AWAITING_COMMISSION (MUST handle commission input without triggering menu numbers!)
    if (currentState.state === 'AWAITING_COMMISSION') {
      const match = text.match(/[0-9]+(\.[0-9]+)?/);
      if (!match) {
        await wahaClient.sendTextMessage(
          formattedChatId,
          `⚠️ *தயவுசெய்து சரியான கமிஷன் தொகையை ரூபாயில் அனுப்பவும்.*\n(எ.கா: 250 அல்லது 150 அல்லது ரத்து செய்ய 'cancel' என அனுப்பவும்)`
        );
        return true;
      }

      const commissionAmount = parseFloat(match[0]);
      const dealData = currentState.pendingDealData || {};
      dealData.commissionAmount = commissionAmount;

      await wahaClient.sendTextMessage(
        formattedChatId,
        `✅ *உண்மையான கமிஷன்: Rs. ${commissionAmount} பதிவு செய்யப்பட்டது!*\nGemini மூலம் தமிழ் மற்றும் சிங்கள விளம்பரங்கள் தயாராகின்றன...`
      );

      // Get active community invite links
      const communityInviteUrl = await SettingsService.get('communityInviteUrl');
      const communityInviteUrlSinhala = await SettingsService.get('communityInviteUrlSinhala');

      // Count active destination groups
      const destinationGroups = await prisma.group.findMany({
        where: { role: 'DESTINATION', type: 'DARAZ', isActive: true },
      });
      const tamilCount = destinationGroups.filter((g) => g.language === 'TAMIL' || g.language === 'ALL').length;
      const sinhalaCount = destinationGroups.filter((g) => g.language === 'SINHALA' || g.language === 'ALL').length;

      // Save Post as PENDING_APPROVAL in database first to get unique postId
      const finalMediaUrl = (dealData.mediaUrl && dealData.mediaUrl !== 'NONE') ? dealData.mediaUrl : null;
      const post = await prisma.post.create({
        data: {
          type: 'DARAZ',
          sourceRef: dealData.exactAffiliateUrl,
          mediaUrl: finalMediaUrl,
          status: 'PENDING_APPROVAL',
          rawPayload: dealData as any,
          processedText: '',
          processedTextSinhala: '',
        },
      });

      // Generate Official Tracking Redirect URL
      const trackingUrl = `${env.BASE_REDIRECT_URL}/r/${post.id}`;

      // AI Copywriting with Gemini: generate both in parallel
      const { tamilText, sinhalaText } = await copywritingService.generateBilingualDarazDeals({
        title: dealData.title,
        originalPrice: dealData.originalPrice,
        discountPrice: dealData.discountPrice,
        discountPercentage: dealData.discountPercentage,
        affiliateRedirectUrl: trackingUrl,
        communityInviteUrl,
        communityInviteUrlSinhala,
      });

      // Update post with the final AI promotional copies
      await prisma.post.update({
        where: { id: post.id },
        data: {
          processedText: tamilText,
          processedTextSinhala: sinhalaText,
        },
      });

      // Send Preview Message: Image (Photo) if available with summary
      const previewHeader = `📸 *தயாரிப்பு மாதிரி (Product Preview)*\n\n💰 *உண்மையான கமிஷன்:* Rs. ${commissionAmount} / order\n👥 *சென்றடையும் குரூப்கள்:* ${tamilCount} தமிழ் குரூப் | ${sinhalaCount} சிங்கள குரூப்`;

      if (finalMediaUrl) {
        await wahaClient.sendFileMessage(
          formattedChatId,
          finalMediaUrl,
          previewHeader,
          'product.jpg',
          'image/jpeg'
        );
      } else {
        await wahaClient.sendTextMessage(formattedChatId, previewHeader);
      }

      // Send Tamil Copy Preview
      await wahaClient.sendTextMessage(
        formattedChatId,
        `🇱🇰 *[தமிழ் விளம்பரம் - Tamil Copy]*\n━━━━━━━━━━━━━━━━━━━━\n${tamilText}`
      );

      // Send Sinhala Copy Preview
      await wahaClient.sendTextMessage(
        formattedChatId,
        `🇱🇰 *[சிங்கள விளம்பரம் - Sinhala Copy]*\n━━━━━━━━━━━━━━━━━━━━\n${sinhalaText}`
      );

      // Send Approval Menu (Poll)
      await this.sendApprovalMenu(formattedChatId, destinationGroups.length, post.id);

      await this.setState(cleanFrom, {
        state: 'AWAITING_APPROVAL',
        pendingPostId: post.id,
        pendingDealData: undefined,
      });

      return true;
    }

    // 4. State: AWAITING_NEW_GROUP_LINK
    if (currentState.state === 'AWAITING_NEW_GROUP_LINK') {
      const lower = text.trim().toLowerCase();
      if (lower === '1' || lower.includes('tamil') || lower.includes('தமிழ்')) {
        await this.setState(cleanFrom, { state: 'AWAITING_TAMIL_GROUP_LINK' });
        await wahaClient.sendTextMessage(
          formattedChatId,
          `🇱🇰 *புதிய தமிழ் WhatsApp குரூப் Invite Link-ஐ அனுப்பவும்...*\n(எ.கா: https://chat.whatsapp.com/XXXXX)`
        );
        return true;
      }

      if (lower === '2' || lower.includes('sinhala') || lower.includes('சிங்கள')) {
        await this.setState(cleanFrom, { state: 'AWAITING_SINHALA_GROUP_LINK' });
        await wahaClient.sendTextMessage(
          formattedChatId,
          `🇱🇰 *புதிய சிங்கள WhatsApp குரூப் Invite Link-ஐ அனுப்பவும்...*\n(எ.கா: https://chat.whatsapp.com/XXXXX)`
        );
        return true;
      }

      const linkMatch = text.match(/(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/i);
      if (linkMatch) {
        const newUrl = linkMatch[0].trim();
        const isSinhala = lower.includes('sinhala') || lower.includes('sin') || lower.includes('சிங்கள');
        const settingKey = isSinhala ? 'communityInviteUrlSinhala' : 'communityInviteUrl';
        const langLabel = isSinhala ? 'சிங்கள (Sinhala)' : 'தமிழ் (Tamil)';

        await SettingsService.set(settingKey, newUrl);
        await this.resetState(cleanFrom);

        await wahaClient.sendTextMessage(
          formattedChatId,
          `✅ *புதிய ${langLabel} குரூப் லிங்க் வெற்றிகரமாக மாற்றப்பட்டது!*\n\n🔗 *புதிய லிங்க்:* ${newUrl}\n\nஇனி வரும் விளம்பரங்களின் கீழ் இந்த லிங்க் தானாகவே சேர்க்கப்படும்.`
        );
        return true;
      }

      await wahaClient.sendTextMessage(
        formattedChatId,
        `⚠️ தயவுசெய்து '1' (தமிழ் லிங்க்) அல்லது '2' (சிங்கள லிங்க்) என தெரிவு செய்யவும் அல்லது நேரடியாக Link-ஐ அனுப்பவும்.`
      );
      return true;
    }

    if (currentState.state === 'AWAITING_TAMIL_GROUP_LINK') {
      const linkMatch = text.match(/(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/i);
      if (linkMatch) {
        const newUrl = linkMatch[0].trim();
        await SettingsService.set('communityInviteUrl', newUrl);
        await this.resetState(cleanFrom);

        await wahaClient.sendTextMessage(
          formattedChatId,
          `✅ *தமிழ் குரூப் லிங்க் வெற்றிகரமாக மாற்றப்பட்டது!*\n\n🔗 *புதிய தமிழ் லிங்க்:* ${newUrl}\n\nஇனி வரும் தமிழ் விளம்பரங்களின் கீழ் இந்த லிங்க் தானாகவே சேர்க்கப்படும்.`
        );
        return true;
      }

      await wahaClient.sendTextMessage(
        formattedChatId,
        `⚠️ *செல்லுபடியாகும் WhatsApp குரூப் லிங்கை அனுப்புங்கள்.*\n(எ.கா: https://chat.whatsapp.com/GzBDeals123)`
      );
      return true;
    }

    if (currentState.state === 'AWAITING_SINHALA_GROUP_LINK') {
      const linkMatch = text.match(/(https?:\/\/chat\.whatsapp\.com\/[^\s]+)/i);
      if (linkMatch) {
        const newUrl = linkMatch[0].trim();
        await SettingsService.set('communityInviteUrlSinhala', newUrl);
        await this.resetState(cleanFrom);

        await wahaClient.sendTextMessage(
          formattedChatId,
          `✅ *சிங்கள குரூப் லிங்க் வெற்றிகரமாக மாற்றப்பட்டது!*\n\n🔗 *புதிய சிங்கள லிங்க்:* ${newUrl}\n\nஇனி வரும் சிங்கள விளம்பரங்களின் கீழ் இந்த லிங்க் தானாகவே சேர்க்கப்படும்.`
        );
        return true;
      }

      await wahaClient.sendTextMessage(
        formattedChatId,
        `⚠️ *செல்லுபடியாகும் WhatsApp குரூப் லிங்கை அனுப்புங்கள்.*\n(எ.கா: https://chat.whatsapp.com/GzBDeals123)`
      );
      return true;
    }

    // 5. State: AWAITING_MANUAL_PHOTO
    if (currentState.state === 'AWAITING_MANUAL_PHOTO') {
      if (messagePayload.hasMedia) {
        const mediaSource =
          messagePayload.media?.url ||
          messagePayload.mediaUrl ||
          messagePayload.media?.data ||
          messagePayload.file?.url;

        if (mediaSource) {
          try {
            const uploadedUrl = await wahaMediaService.downloadAndStoreMedia(
              mediaSource,
              messagePayload.media?.mimetype || messagePayload.mimetype,
              messagePayload.media?.filename || messagePayload.filename
            );

            // If caption already has a Daraz link, immediately extract deal data!
            if (/daraz/i.test(text)) {
              await wahaClient.sendTextMessage(formattedChatId, `⏳ *புகைப்படம் & டீல் விபரங்கள் ஆராயப்படுகின்றன...*`);
              const dealData = await DarazExtractor.extractDealFromText(text, uploadedUrl);
              await this.setState(cleanFrom, {
                state: 'AWAITING_COMMISSION',
                uploadedMediaUrl: uploadedUrl,
                pendingDealData: dealData,
              });
              await wahaClient.sendTextMessage(
                formattedChatId,
                `📦 *பொருள்:* ${dealData.title || 'Daraz Deal'}\n💵 *விலை:* Rs. ${dealData.discountPrice || dealData.originalPrice || 'N/A'}\n\n💰 *இந்த பொருளுக்கு உங்களுக்கு கிடைக்கும் உண்மையான கமிஷன் தொகை எவ்வளவு?*\n(ரூபாயில் தொகையை மட்டும் அனுப்பவும், எ.கா: 250 அல்லது 150)`
              );
              return true;
            }

            await this.setState(cleanFrom, {
              state: 'AWAITING_DEAL_TEXT',
              photoMode: 'MANUAL',
              uploadedMediaUrl: uploadedUrl,
            });

            await wahaClient.sendTextMessage(
              formattedChatId,
              `✅ *புகைப்படம் பெறப்பட்டது!*\n\nஅடுத்து, அந்த பொருளின் *Daraz Link மற்றும் விவரங்களை* Text வடிவில் அனுப்புங்கள்...`
            );
            return true;
          } catch (err: any) {
            console.error('[AdminChat] Failed to upload manual photo:', err.message);
          }
        }
      }

      // If user clicked or typed a menu choice (e.g. 2 for auto photo, 3 for text only, 4 for back)
      if (await this.processAdminChoice(cleanFrom, formattedChatId, text, currentState)) {
        return true;
      }

      // If user pasted text containing Daraz link directly while waiting for photo
      if (/daraz/i.test(text)) {
        // Fallthrough to Deal text extraction below
      } else {
        await wahaClient.sendTextMessage(
          formattedChatId,
          `📷 *தயவுசெய்து பொருளின் புகைப்படத்தை (Image) அனுப்புங்கள்.*\n(அல்லது தானாக படம் எடுக்க '2' எனவும், படம் இல்லாமல் செய்ய '3' எனவும், மெனுவுக்கு செல்ல 'menu' எனவும் தட்டச்சு செய்யவும்).`
        );
        return true;
      }
    }

    // 6. State: AWAITING_DEAL_TEXT (or Direct Daraz Link Paste in ANY state)
    if (
      currentState.state === 'AWAITING_DEAL_TEXT' ||
      /daraz/i.test(text)
    ) {
      // Check if message is a menu navigation choice first (e.g. 'Back')
      if (currentState.state === 'AWAITING_DEAL_TEXT' && ['4', 'back', 'menu'].includes(text.toLowerCase())) {
        await this.resetState(cleanFrom);
        await this.sendMainMenu(formattedChatId);
        return true;
      }

      await wahaClient.sendTextMessage(
        formattedChatId,
        `⏳ *டீல் விபரங்கள் ஆராயப்படுகின்றன...*`
      );

      // Check if user uploaded a photo along with the text/link
      let activeMediaUrl = currentState.uploadedMediaUrl;
      if (currentState.photoMode === 'NONE' || activeMediaUrl === 'NONE') {
        activeMediaUrl = 'NONE';
      } else if (messagePayload.hasMedia) {
        const mediaSource =
          messagePayload.media?.url ||
          messagePayload.mediaUrl ||
          messagePayload.media?.data ||
          messagePayload.file?.url;
        if (mediaSource) {
          try {
            activeMediaUrl = await wahaMediaService.downloadAndStoreMedia(
              mediaSource,
              messagePayload.media?.mimetype || messagePayload.mimetype,
              messagePayload.media?.filename || messagePayload.filename
            );
          } catch (err: any) {
            console.warn('[AdminChat] Media download error:', err.message);
          }
        }
      }

      // Extract details and scrape product image if manual photo wasn't provided and not NONE
      const dealData = await DarazExtractor.extractDealFromText(
        text,
        activeMediaUrl
      );

      if (currentState.photoMode === 'NONE') {
        dealData.mediaUrl = undefined;
      }

      // Save extracted deal in state and ask for the actual commission amount
      await this.setState(cleanFrom, {
        state: 'AWAITING_COMMISSION',
        pendingDealData: dealData,
        uploadedMediaUrl: dealData.mediaUrl,
      });

      await wahaClient.sendTextMessage(
        formattedChatId,
        `📦 *பொருள்:* ${dealData.title || 'Daraz Deal'}\n💵 *விலை:* Rs. ${dealData.discountPrice || dealData.originalPrice || 'N/A'}\n\n💰 *இந்த பொருளுக்கு உங்களுக்கு கிடைக்கும் உண்மையான கமிஷன் தொகை எவ்வளவு?*\n(ரூபாயில் தொகையை மட்டும் அனுப்பவும், எ.கா: 250 அல்லது 150)`
      );
      return true;
    }

    // 7. State: AWAITING_PHOTO_CHOICE or AWAITING_APPROVAL
    if (
      currentState.state === 'AWAITING_PHOTO_CHOICE' ||
      currentState.state === 'AWAITING_APPROVAL'
    ) {
      const handled = await this.processAdminChoice(
        cleanFrom,
        formattedChatId,
        text,
        currentState
      );
      if (handled) return true;
    }

    // 8. IDLE State Fallback: check menu choice or send main menu
    const handledIdleChoice = await this.processAdminChoice(
      cleanFrom,
      formattedChatId,
      text,
      currentState
    );
    if (handledIdleChoice) {
      return true;
    }

    // Default: Send Main Menu
    await this.sendMainMenu(formattedChatId);
    return true;
  }

  /**
   * Handles incoming WhatsApp Poll Vote events from WAHA.
   */
  static async handlePollVote(votePayload: any): Promise<boolean> {
    console.log(`[AdminChat] Received raw poll vote payload:`, JSON.stringify(votePayload));

    // Extract voter from all potential fields in WAHA payload
    const voter =
      votePayload.vote?.from ||
      votePayload.vote?.participant ||
      votePayload.voter ||
      votePayload.senderId ||
      votePayload.poll?.to ||
      votePayload._data?.voter ||
      votePayload._data?.author ||
      votePayload.from ||
      '';

    if (!voter || !(await this.isAdmin(voter))) {
      console.log(`[AdminChat] Voter "${voter}" is not authorized admin.`);
      return false;
    }

    const configuredAdmin = await SettingsService.get('adminPhone');
    const cleanFrom = this.cleanPhone(configuredAdmin || voter);
    const formattedChatId = voter || (await this.getAdminChatId());

    // Extract selected option from all potential fields
    const selectedOption =
      votePayload.vote?.selectedOptions?.[0] ||
      votePayload.selectedOptions?.[0] ||
      votePayload._data?.selectedOptions?.[0]?.name ||
      votePayload._data?.selectedOptions?.[0] ||
      votePayload.selectedOption ||
      votePayload.vote?.[0] ||
      '';

    console.log(`[AdminChat] Admin voted on poll: "${selectedOption}"`);
    if (!selectedOption) return false;

    const currentState = await this.getState(cleanFrom);
    return this.processAdminChoice(cleanFrom, formattedChatId, selectedOption, currentState);
  }

  /**
   * Helper: Sends the Main Menu (Clean interactive poll).
   */
  static async sendMainMenu(chatId: string) {
    try {
      await wahaClient.sendPoll(chatId, {
        name: '👋 வணக்கம் Admin! இன்று என்ன செய்ய வேண்டும்?',
        options: [
          '1️⃣ புதிய விளம்பரம் போடுக (Post Ad)',
          '2️⃣ குரூப் லிங்க் மாற்றுக (Update Link)',
          '3️⃣ இன்றைய நிலவரம் (Today Stats)',
          '4️⃣ மெனுவை மூடுக (Close Menu)',
        ],
        multipleAnswers: false,
      });
    } catch (err: any) {
      console.warn('[AdminChat] Warning: Could not send poll, falling back to text:', err.message);
      await wahaClient.sendTextMessage(
        chatId,
        `👋 *வணக்கம் Admin!*\n1️⃣ புதிய விளம்பரம் போடுக ➡️ Reply 1\n2️⃣ குரூப் லிங்க் மாற்றுக ➡️ Reply 2\n3️⃣ இன்றைய நிலவரம் ➡️ Reply 3\n4️⃣ மெனுவை மூடுக ➡️ Reply 4`
      );
    }
  }

  /**
   * Helper: Sends the Photo Choice Menu (Clean interactive poll).
   */
  static async sendPhotoChoiceMenu(chatId: string) {
    try {
      await wahaClient.sendPoll(chatId, {
        name: '📸 விளம்பரத்திற்கான புகைப்பட முறை:',
        options: [
          '1️⃣ சொந்த போட்டோ அனுப்புகிறேன் (Upload Photo)',
          '2️⃣ Daraz தளத்திலிருந்து தானாக எடு (Auto Photo)',
          '3️⃣ போட்டோ இல்லாமல் (Text Only Ad)',
          '4️⃣ பிரதான மெனுவுக்கு செல் (Back)',
        ],
        multipleAnswers: false,
      });
    } catch (err: any) {
      console.warn('[AdminChat] Warning: Could not send photo choice poll, falling back to text:', err.message);
      await wahaClient.sendTextMessage(
        chatId,
        `📸 *விளம்பரத்திற்கான புகைப்பட முறை:*\n1️⃣ சொந்த போட்டோ அனுப்புகிறேன் ➡️ Reply 1\n2️⃣ Daraz தளத்திலிருந்து தானாக எடு ➡️ Reply 2\n3️⃣ போட்டோ இல்லாமல் (Text Only) ➡️ Reply 3\n4️⃣ பிரதான மெனுவுக்கு செல் ➡️ Reply 4`
      );
    }
  }

  /**
   * Helper: Sends the Deal Approval Menu (Clean interactive poll).
   */
  static async sendApprovalMenu(chatId: string, destinationCount: number, postId: string) {
    try {
      const pollResponse = await wahaClient.sendPoll(chatId, {
        name: `🎯 விளம்பரம் தயார்! ${destinationCount} குரூப்களுக்கு அனுப்பலாமா?`,
        options: [
          '1️⃣ ஆம், குரூப்களுக்கு அனுப்புக (Approve)',
          '2️⃣ மீண்டும் Ad எழுது (Regenerate)',
          '3️⃣ ரத்து செய் (Cancel)',
        ],
        multipleAnswers: false,
      });

      if (pollResponse?.id && postId) {
        const rawPollId = pollResponse.id;
        const cleanPollId = typeof rawPollId === 'string'
          ? rawPollId
          : ((rawPollId as any)?._serialized || (rawPollId as any)?.id || String(rawPollId));
        await prisma.post.update({
          where: { id: postId },
          data: { pollMessageId: cleanPollId },
        });
      }
    } catch (err: any) {
      console.warn('[AdminChat] Warning: Could not send approval poll, falling back to text:', err.message);
      await wahaClient.sendTextMessage(
        chatId,
        `🎯 *விளம்பரம் தயார்! ${destinationCount} குரூப்களுக்கு அனுப்பலாமா?*\n1️⃣ ஆம், குரூப்களுக்கு அனுப்புக ➡️ Reply 1\n2️⃣ மீண்டும் Ad எழுது ➡️ Reply 2\n3️⃣ ரத்து செய் ➡️ Reply 3`
      );
    }
  }

  /**
   * Helper: Sends today's stats summary to Admin.
   */
  static async sendTodayStats(chatId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todaySent, todayClicks, activeGroupsCount, todayPosts] = await Promise.all([
      prisma.post.count({
        where: { type: 'DARAZ', status: 'SENT', sentAt: { gte: startOfDay } },
      }),
      prisma.engagement.count({
        where: { type: 'CLICK', recordedAt: { gte: startOfDay } },
      }),
      prisma.group.count({
        where: { role: 'DESTINATION', type: 'DARAZ', isActive: true },
      }),
      prisma.post.findMany({
        where: { type: 'DARAZ', status: 'SENT', sentAt: { gte: startOfDay } },
        select: { clicksCount: true, rawPayload: true },
      }),
    ]);

    const convRate = parseFloat(await SettingsService.get('conversionRate', '0.025'));
    const avgComm = parseFloat(await SettingsService.get('avgCommission', '380'));
    const estOrders = Math.round(todayClicks * convRate);

    let calculatedTodayCommission = 0;
    for (const p of todayPosts) {
      const payload = p.rawPayload as any;
      const comm = payload?.commissionAmount ? Number(payload.commissionAmount) : avgComm;
      calculatedTodayCommission += p.clicksCount * convRate * comm;
    }
    const estCommission = Math.round(calculatedTodayCommission);

    const msg =
      `📊 *இன்றைய Daraz Affiliate நிலவரம் (Today's Stats)*\n\n` +
      `📢 அனுப்பப்பட்ட விளம்பரங்கள்: *${todaySent} Deals*\n` +
      `⚡ இன்றைய லிங்க் கிளிக்குகள்: *${todayClicks} Clicks*\n` +
      `📦 உத்தேச ஆர்டர்கள்: *~${estOrders} Orders*\n` +
      `💰 உத்தேச கமிஷன்: *~Rs. ${estCommission.toLocaleString()}*\n` +
      `👥 ஆக்டிவ் ஒளிபரப்பு குரூப்கள்: *${activeGroupsCount} Groups*\n\n` +
      `🖥️ விரிவான தகவல்களை Dashboard-ல் பார்க்க:\n` +
      `👉 http://localhost:3001`;

    await wahaClient.sendTextMessage(chatId, msg);
  }
}
