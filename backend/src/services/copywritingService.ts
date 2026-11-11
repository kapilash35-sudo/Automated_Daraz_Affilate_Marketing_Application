import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

export interface NewsCopywritingInput {
  title?: string;
  content: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface DarazCopywritingInput {
  title: string;
  originalPrice?: string | number;
  discountPrice?: string | number;
  discountPercentage?: string | number;
  affiliateRedirectUrl: string;
  productDetails?: string;
  category?: string;
  communityInviteUrl?: string;
  communityInviteUrlSinhala?: string;
}

export class CopywritingService {
  private ai: GoogleGenAI | null = null;
  private model: string;

  constructor() {
    this.model = env.GEMINI_MODEL || 'gemini-3.8-flash';
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      } catch (err: any) {
        console.warn('[CopywritingService] Failed to initialize GoogleGenAI client:', err.message);
      }
    }
  }

  /**
   * Generates a high-engagement WhatsApp-friendly Tamil news bulletin (Hook + Bullets).
   */
  async formatNewsForWhatsApp(input: NewsCopywritingInput): Promise<string> {
    if (!this.ai) {
      return this.formatNewsFallback(input);
    }

    const prompt = `You are a professional Tamil WhatsApp news editor.
Rewrite the following raw news article into an ultra-engaging, readable WhatsApp news format in fluent Tamil.

RAW NEWS:
Title: ${input.title || 'N/A'}
Content: ${input.content}
Source: ${input.sourceName || input.sourceUrl || 'செய்தி பிரிவு'}

WHATSAPP FORMATTING REQUIREMENTS:
1. Hook Headline: Start with an attention-grabbing breaking news emoji (🚨 / 📢 / ⚡) and a bold headline in Tamil (*bold*).
2. Key Points: Provide 3 to 4 concise, factual bullet points in Tamil using emoji bullets (🔹, 📌, 📍).
3. Context / Time: Mention the context clearly.
4. Call to Action / Footer: Include a clean footer encouraging readers to stay updated (e.g., "📲 உடனுக்குடன் செய்திகளை அறிய எமது குழுவில் இணையுங்கள்!").
5. Use proper WhatsApp markdown formatting: *bold*, _italics_.
6. Keep sentences crisp, engaging, and easy to read quickly on mobile screens.

Return ONLY the formatted WhatsApp message text. Do not wrap in markdown code blocks.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: 0.3,
        },
      });

      return response.text?.trim() || this.formatNewsFallback(input);
    } catch (err: any) {
      console.error('[CopywritingService] Error calling Gemini for news copywriting:', err.message);
      return this.formatNewsFallback(input);
    }
  }

  /**
   * Generates an irresistible WhatsApp Flash Deal promo in Tamil for Daraz affiliate marketing.
   */
  async formatDarazDealForWhatsApp(input: DarazCopywritingInput): Promise<string> {
    if (!this.ai) {
      return this.formatDarazFallback(input);
    }

    const prompt = `You are an expert e-commerce affiliate marketing copywriter specializing in viral, high-converting WhatsApp deal alerts for Daraz Sri Lanka and South Asian shoppers.
Your goal is to write a catchy, fresh, and modern WhatsApp promotion message in friendly, natural Tamil mixed with common shopping English (Tanglish/conversational style).

PRODUCT DETAILS:
Title: ${input.title}
Original Price: ${input.originalPrice ? `Rs. ${input.originalPrice}` : 'N/A'}
Offer Price: ${input.discountPrice ? `Rs. ${input.discountPrice}` : 'N/A'}
Discount: ${input.discountPercentage ? `${input.discountPercentage}% OFF` : 'Super Deal!'}
Tracking Link: ${input.affiliateRedirectUrl}
Features/Details: ${input.productDetails || 'உயர்தர தரம் வாய்ந்த பொருள்'}

CRITICAL COPYWRITING & TONE RULES:
1. DYNAMIC CATCHY HOOK (DO NOT always use "மின்னல் நேர அதிரடி தள்ளுபடி!"):
   - Create a UNIQUE, fresh opening headline tailored to the specific product type, using relevant emojis.
   - For Tech/Gadgets: e.g. 🔥 *Budget Gadget Alert!* 🎧, ⚡ *Trending Tech Deal!* 📱, 🚀 *Must-Have Gadget Offer!* ⌚
   - For Beauty/Personal Care: e.g. ✨ *Self-Care & Beauty Pick!* 💄, 🌸 *Super Saver Beauty Pack!* 🧴
   - For Kitchen/Home: e.g. 🏠 *Home & Kitchen Essential!* 🍳, 💡 *Smart Home Deal!* ✨
   - For Fashion/Lifestyle: e.g. 👟 *Trending Fashion Steal!* 👗, 🎒 *Style on a Budget!* 🕶️
   - For Huge Discounts (40%+): e.g. 💥 *Crazy Price Drop Alert!* 🔥, 🚨 *Loot Offer - Huge Savings!* 🛍️
   - For Everyday Essentials: e.g. 🛒 *Daily Essential Value Deal!* 📦, ⭐ *Today's Hot Pick!* 🎉

2. NATURAL CONVERSATIONAL TONE (TAMIL + CASUAL ENGLISH):
   - Use natural, friendly Tamil mixed with standard everyday English shopping terms (Tanglish).
   - DO NOT awkwardly translate common terms into ancient/formal Tamil! Keep terms like:
     "Super Quality", "Trending Item", "Value Pack", "Battery Life", "Long-lasting", "Free Delivery / COD Available", "Best Seller", "Eco Pack", "Easy to use", "Gift Idea".
   - Keep the tone exciting, friendly, and persuasive—like an experienced deal finder recommending a great buy to friends on WhatsApp.

3. PRICING & SAVINGS SECTION:
   - Clear, clean pricing breakdown:
     ❌ வழக்கமான விலை: Rs. ${input.originalPrice || '---'}
     ✅ *இன்றைய Offer விலை:* *Rs. ${input.discountPrice || '---'}*
     🔥 *சேமிப்பு:* ${input.discountPercentage ? `${input.discountPercentage}% OFF` : 'Mega Savings!'}

4. KEY HIGHLIGHTS:
   - 2 to 3 crisp, appealing bullet points explaining WHY this product is worth buying (practical use, durability, convenience, or comfort).

5. CLEAR CALL TO ACTION (CTA):
   👉 *உடனடியாக ஓடர் செய்ய இங்கே கிளிக் பண்ணுங்க:*
   ${input.affiliateRedirectUrl}

6. COMMUNITY INVITE & URGENCY FOOTER:
   ⚠️ *Limited Stock Offer! உடனே முந்துங்கள்!*
   ${input.communityInviteUrl ? `\n📲 *இதே போன்ற Super Deals & Updates-ஐ உடனுக்குடன் பெற எமது WhatsApp Group-ல் இணையுங்கள்:*\n👉 ${input.communityInviteUrl}` : ''}

7. FORMATTING:
   - Use WhatsApp markdown (*bold*, _italics_).
   - Keep line spacing clean and pleasant to read on mobile screens.
   - NEVER alter, break, or remove the exact Tracking Link.

Return ONLY the final WhatsApp message text. Do not wrap in markdown code fences or backticks.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: 0.65,
        },
      });

      return response.text?.trim() || this.formatDarazFallback(input);
    } catch (err: any) {
      console.error('[CopywritingService] Error calling Gemini for Daraz copywriting:', err.message);
      return this.formatDarazFallback(input);
    }
  }

  /**
   * Generates an irresistible WhatsApp Flash Deal promo in Sinhala (Singlish / Conversational Sinhala)
   * for Daraz Sri Lanka shoppers.
   */
  async formatDarazDealSinhalaForWhatsApp(input: DarazCopywritingInput): Promise<string> {
    if (!this.ai) {
      return this.formatDarazSinhalaFallback(input);
    }

    const sinhalaCommunityUrl = input.communityInviteUrlSinhala || input.communityInviteUrl;

    const prompt = `You are an expert e-commerce affiliate marketing copywriter specializing in viral, high-converting WhatsApp deal alerts for Daraz Sri Lanka shoppers.
Your goal is to write a catchy, fresh, and modern WhatsApp promotion message in natural, conversational Sinhala mixed with common shopping English (Singlish style).

PRODUCT DETAILS:
Title: ${input.title}
Original Price: ${input.originalPrice ? `Rs. ${input.originalPrice}` : 'N/A'}
Offer Price: ${input.discountPrice ? `Rs. ${input.discountPrice}` : 'N/A'}
Discount: ${input.discountPercentage ? `${input.discountPercentage}% OFF` : 'Super Deal!'}
Tracking Link: ${input.affiliateRedirectUrl}
Features/Details: ${input.productDetails || 'ඉහළම තත්ත්වයේ නිෂ්පාදනයක්'}

CRITICAL COPYWRITING & TONE RULES:
1. DYNAMIC CATCHY HOOK:
   - Create a UNIQUE, exciting opening headline tailored to the product type, using relevant emojis.
   - For Tech/Gadgets: e.g. 🔥 *Trending Tech Deal Alert!* 📱, ⚡ *Budget Gadget Offer!* 🎧, 🚀 *Must-Have Tech Deal!* ⌚
   - For Beauty/Personal Care: e.g. ✨ *Self-Care & Beauty Pick!* 💄, 🌸 *Super Saver Beauty Pack!* 🧴
   - For Kitchen/Home: e.g. 🏠 *Home & Kitchen Essential!* 🍳, 💡 *Smart Home Deal!* ✨
   - For Fashion/Lifestyle: e.g. 👟 *Trending Fashion Steal!* 👗, 🎒 *Style on a Budget!* 🕶️
   - For Huge Discounts (40%+): e.g. 💥 *Crazy Price Drop Alert!* 🔥, 🚨 *Loot Offer - Huge Savings!* 🛍️
   - For Everyday Essentials: e.g. 🛒 *Daily Essential Value Deal!* 📦, ⭐ *Today's Hot Pick!* 🎉

2. NATURAL CONVERSATIONAL TONE (SINHALA + CASUAL ENGLISH / SINGLISH):
   - Use natural, friendly Sinhala mixed with standard everyday English shopping terms (Singlish).
   - DO NOT awkwardly translate common terms into ancient/formal Sinhala! Keep terms like:
     "Super Quality", "Trending Item", "Value Pack", "Battery Life", "Long-lasting", "Cash on Delivery (COD) Available", "Best Seller", "Island-wide Fast Delivery", "Easy to use", "Gift Idea".
   - Keep the tone exciting, friendly, and persuasive—like an experienced deal finder recommending a great buy to friends on WhatsApp.

3. PRICING & SAVINGS SECTION:
   - Clear, clean pricing breakdown:
     ❌ සාමාන්‍ය මිල: Rs. ${input.originalPrice || '---'}
     ✅ *අද විශේෂ Offer මිල:* *Rs. ${input.discountPrice || '---'}*
     🔥 *වට්ටම:* ${input.discountPercentage ? `${input.discountPercentage}% OFF` : 'Mega Savings!'}

4. KEY HIGHLIGHTS:
   - 2 to 3 crisp, appealing bullet points in Sinhala explaining WHY this product is worth buying.

5. CLEAR CALL TO ACTION (CTA):
   👉 *දැන්ම Order කිරීමට මෙතන Click කරන්න:*
   ${input.affiliateRedirectUrl}

6. COMMUNITY INVITE & URGENCY FOOTER:
   ⚠️ *Limited Stock! Offer එක ඉවර වෙන්න කලින් ඉක්මන් කරන්න!*
   ${sinhalaCommunityUrl ? `\n📲 *මෙවැනිම සුපිරි Offers සහ Deals දිනපතා ලබාගැනීමට අපගේ WhatsApp සමූහයට එක්වන්න:*\n👉 ${sinhalaCommunityUrl}` : ''}

7. FORMATTING:
   - Use WhatsApp markdown (*bold*, _italics_).
   - Keep line spacing clean and pleasant to read on mobile screens.
   - NEVER alter, break, or remove the exact Tracking Link.

Return ONLY the final WhatsApp message text. Do not wrap in markdown code fences or backticks.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: 0.65,
        },
      });

      return response.text?.trim() || this.formatDarazSinhalaFallback(input);
    } catch (err: any) {
      console.error('[CopywritingService] Error calling Gemini for Daraz Sinhala copywriting:', err.message);
      return this.formatDarazSinhalaFallback(input);
    }
  }

  /**
   * Generates both Tamil and Sinhala promotional copies in parallel.
   */
  async generateBilingualDarazDeals(
    input: DarazCopywritingInput
  ): Promise<{ tamilText: string; sinhalaText: string }> {
    const [tamilText, sinhalaText] = await Promise.all([
      this.formatDarazDealForWhatsApp(input),
      this.formatDarazDealSinhalaForWhatsApp(input),
    ]);
    return { tamilText, sinhalaText };
  }

  // Fallback templates when Gemini API key is not present
  private formatNewsFallback(input: NewsCopywritingInput): string {
    const title = input.title || 'முக்கிய செய்தி';
    return `🚨 *முக்கிய செய்தி வெளியீடு!*

*${title}*

🔹 ${input.content.slice(0, 150)}...
🔹 முழுமையான விபரங்கள் தொடர்ந்தும் சேகரிக்கப்பட்டு வருகின்றன.
🔹 சமீபத்திய நம்பகமான தகவல்களுக்காக இணைந்திருங்கள்.

📅 _பதிவு: ${new Date().toLocaleDateString('ta-IN')}_
📲 *உடனுக்குடன் செய்திகளை அறிய எமது WhatsApp குழுவில் இணையுங்கள்!*`;
  }

  private formatDarazFallback(input: DarazCopywritingInput): string {
    return `⚡ *மின்னல் நேர அதிரடி சலுகை!* ⚡

*${input.title}*

${input.originalPrice ? `❌ முந்தைய விலை: ~Rs. ${input.originalPrice}~` : ''}
${input.discountPrice ? `✅ *இன்றைய சலுகை விலை: Rs. ${input.discountPrice}*` : ''}
${input.discountPercentage ? `🔥 *தள்ளுபடி: ${input.discountPercentage}% OFF*` : ''}

📌 *சிறப்பம்சங்கள்:*
✔ 100% உத்தரவாதமான தரமான தயாரிப்பு
✔ விரைவான விநியோகம் (Cash on Delivery வசதி)

👉 *உடனடியாக தள்ளுபடி விலையில் ஓடர் செய்ய:*
🔗 ${input.affiliateRedirectUrl}
${input.communityInviteUrl ? `\n📲 *மேலும் அதிரடி தள்ளுபடி சலுகைகளை உடனுக்குடன் பெற எமது WhatsApp குழுவில் இணையுங்கள்:*\n👉 ${input.communityInviteUrl}` : ''}

⚠️ _வரையறுக்கப்பட்ட ஸ்டொக் மட்டுமே! சலுகை முடிவதற்குள் முந்துங்கள்!_`;
  }

  private formatDarazSinhalaFallback(input: DarazCopywritingInput): string {
    const sinhalaCommunityUrl = input.communityInviteUrlSinhala || input.communityInviteUrl;
    return `⚡ *විශේෂ මිල අඩුකිරීමක්!* ⚡

*${input.title}*

${input.originalPrice ? `❌ සාමාන්‍ය මිල: ~Rs. ${input.originalPrice}~` : ''}
${input.discountPrice ? `✅ *අද විශේෂ Offer මිල: Rs. ${input.discountPrice}*` : ''}
${input.discountPercentage ? `🔥 *වට්ටම: ${input.discountPercentage}% OFF*` : ''}

📌 *විශේෂාංග:*
✔ 100% Original Brand New Product
✔ Island-wide Delivery & Cash on Delivery (COD) පහසුකම සහිතයි

👉 *දැන්ම Order කිරීමට මෙතන Click කරන්න:*
🔗 ${input.affiliateRedirectUrl}
${sinhalaCommunityUrl ? `\n📲 *තවත් මෙවැනි විශේෂ Offer විස්තර දිනපතා ලබාගැනීමට අපගේ WhatsApp Group එකට එකතු වන්න:*\n👉 ${sinhalaCommunityUrl}` : ''}

⚠️ _සීමිත තොග ප්‍රමාණයක් පමණි! අවස්ථාව මගනොහරින්න!_`;
  }
}

export const copywritingService = new CopywritingService();

