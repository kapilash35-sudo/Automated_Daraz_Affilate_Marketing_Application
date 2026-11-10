import { GoogleGenAI } from '@google/genai';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

export interface DeduplicationResult {
  isDuplicate: boolean;
  reason: string;
  matchedPostId?: string;
  confidence?: number;
}

export class DeduplicationService {
  private ai: GoogleGenAI | null = null;
  private model: string;

  constructor() {
    this.model = env.GEMINI_MODEL || 'gemini-3.8-flash';
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      } catch (err: any) {
        console.warn('[DeduplicationService] Failed to initialize GoogleGenAI client:', err.message);
      }
    } else {
      console.warn('[DeduplicationService] GEMINI_API_KEY not configured. Mocking AI deduplication for development.');
    }
  }

  /**
   * Checks whether the given news text/payload duplicates any news story sent in the past 24 hours.
   */
  async checkDuplicate(
    candidateText: string,
    candidateTitle?: string
  ): Promise<DeduplicationResult> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch sent news posts from the last 24 hours
    const recentSentPosts = await prisma.post.findMany({
      where: {
        type: 'NEWS',
        status: 'SENT',
        sentAt: { gte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        processedText: true,
        rawPayload: true,
        sentAt: true,
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    if (recentSentPosts.length === 0) {
      return {
        isDuplicate: false,
        reason: 'Clean history: No news stories were sent in the last 24 hours.',
      };
    }

    // Format recent posts for the prompt
    const recentSummaries = recentSentPosts.map((p, idx) => {
      let title = '';
      if (p.rawPayload && typeof p.rawPayload === 'object' && 'title' in p.rawPayload) {
        title = String((p.rawPayload as any).title);
      }
      const textPreview = (p.processedText || JSON.stringify(p.rawPayload)).slice(0, 250);
      return `[Post ${idx + 1}] ID: "${p.id}", Sent: "${p.sentAt?.toISOString()}", Title: "${title}", Preview: "${textPreview.replace(/"/g, "'")}"`;
    }).join('\n');

    // If Gemini client is not configured, perform smart keyword heuristic fallback
    if (!this.ai) {
      return this.heuristicFallbackCheck(candidateText, candidateTitle, recentSentPosts);
    }

    const prompt = `You are a high-precision News Editorial Deduplication Engine for WhatsApp news broadcast channels.
Your job is to determine whether the incoming CANDIDATE NEWS STORY is a duplicate or substantially reports the identical underlying event/story that was already sent in the past 24 hours.

CANDIDATE STORY:
Title: ${candidateTitle || 'N/A'}
Content: ${candidateText}

RECENTLY SENT STORIES (PAST 24 HOURS):
${recentSummaries}

DEDUPLICATION RULES:
1. Mark as DUPLICATE (true) if:
   - The candidate reports the exact same event, announcement, incident, casualty report, or sports match result, even if phrased differently or sourced from another outlet.
2. Mark as NOT DUPLICATE (false) if:
   - The candidate reports a fundamentally distinct event or topic.
   - The candidate provides a major, critical breaking update (e.g. initial report: "Earthquake hits region", update: "Death toll confirmed at 50 with rescue operation launched").
3. Always provide a clear, one-sentence rationale in the "reason" field.

Return your evaluation ONLY in the following JSON format:
{
  "isDuplicate": boolean,
  "matchedPostId": string | null,
  "confidence": number,
  "reason": string
}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      const parsed: DeduplicationResult = JSON.parse(responseText);
      console.log(`[DeduplicationService] AI Check: duplicate=${parsed.isDuplicate}, reason="${parsed.reason}"`);
      return parsed;
    } catch (err: any) {
      console.error('[DeduplicationService] Error invoking Gemini API for deduplication:', err.message);
      // Fallback to local heuristic if Gemini API error occurs
      return this.heuristicFallbackCheck(candidateText, candidateTitle, recentSentPosts);
    }
  }

  /**
   * Fallback heuristic based on token overlap / similarity
   */
  private heuristicFallbackCheck(
    candidateText: string,
    candidateTitle: string | undefined,
    recentPosts: Array<{ id: string; processedText: string | null; rawPayload: any }>
  ): DeduplicationResult {
    const candidateTokens = new Set(
      `${candidateTitle || ''} ${candidateText}`
        .toLowerCase()
        .replace(/[^\w\s\u0B80-\u0BFF]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    for (const post of recentPosts) {
      let postText = post.processedText || '';
      if (post.rawPayload && typeof post.rawPayload === 'object' && 'title' in post.rawPayload) {
        postText += ' ' + post.rawPayload.title;
      }
      const postTokens = new Set(
        postText
          .toLowerCase()
          .replace(/[^\w\s\u0B80-\u0BFF]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );

      let commonCount = 0;
      for (const token of candidateTokens) {
        if (postTokens.has(token)) commonCount++;
      }

      const similarity = candidateTokens.size > 0 ? commonCount / candidateTokens.size : 0;
      if (similarity > 0.65) {
        return {
          isDuplicate: true,
          matchedPostId: post.id,
          confidence: Math.round(similarity * 100) / 100,
          reason: `High semantic/token overlap (${Math.round(similarity * 100)}%) detected with previously sent post.`,
        };
      }
    }

    return {
      isDuplicate: false,
      reason: 'No high-overlap duplicate detected among recent 24-hour posts.',
      confidence: 0.95,
    };
  }
}

export const deduplicationService = new DeduplicationService();

