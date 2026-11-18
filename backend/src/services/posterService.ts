import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { wahaMediaService } from './wahaMediaService.js';
import { SettingsService } from './settingsService.js';
import { copywritingService } from './copywritingService.js';

export interface PosterInput {
  title: string;
  originalPrice?: string | number;
  discountPrice?: string | number;
  discountPercentage?: string | number;
  mediaUrl?: string | null;
  productDetails?: string;
  features?: string[];
  category?: string;
  communityName?: string;
}

export class PosterService {
  private khLogoBase64: string | null = null;
  private darazLogoBase64: string | null = null;
  private waLogoBase64: string | null = null;
  private fontBase64: string | null = null;

  constructor() {
    this.loadBrandingAssets();
  }

  /**
   * Pre-loads branding logos and Montserrat font into memory for lightning-fast flyer rendering.
   */
  private loadBrandingAssets(): void {
    try {
      const rootDir = process.cwd();

      // 1. KH Official Circular Logo Badge
      const khPath = path.resolve(rootDir, 'assets/branding/kh_badge_160.png');
      const khAltPath = path.resolve(rootDir, 'assets/branding/kh_logo_circle.png');
      if (fs.existsSync(khPath)) {
        this.khLogoBase64 = fs.readFileSync(khPath).toString('base64');
      } else if (fs.existsSync(khAltPath)) {
        this.khLogoBase64 = fs.readFileSync(khAltPath).toString('base64');
      }

      // 2. Official Orange Daraz Logo Badge
      const darazPath = path.resolve(rootDir, 'assets/branding/daraz_badge_120.png');
      const darazAltPath = path.resolve(rootDir, 'assets/branding/daraz_logo.png');
      if (fs.existsSync(darazPath)) {
        this.darazLogoBase64 = fs.readFileSync(darazPath).toString('base64');
      } else if (fs.existsSync(darazAltPath)) {
        this.darazLogoBase64 = fs.readFileSync(darazAltPath).toString('base64');
      }

      // 3. Official WhatsApp Logo Badge
      const waPath = path.resolve(rootDir, 'assets/branding/wa_badge_120.png');
      const waAltPath = path.resolve(rootDir, 'assets/branding/whatsapp_logo.png');
      if (fs.existsSync(waPath)) {
        this.waLogoBase64 = fs.readFileSync(waPath).toString('base64');
      } else if (fs.existsSync(waAltPath)) {
        this.waLogoBase64 = fs.readFileSync(waAltPath).toString('base64');
      }

      // 4. Montserrat ExtraBold Font
      const fontPath = path.resolve(rootDir, 'assets/fonts/Montserrat-ExtraBold.ttf');
      if (fs.existsSync(fontPath)) {
        this.fontBase64 = fs.readFileSync(fontPath).toString('base64');
      }

      console.log('[PosterService] Branding assets loaded in memory:', {
        hasKhLogo: !!this.khLogoBase64,
        hasDarazLogo: !!this.darazLogoBase64,
        hasWaLogo: !!this.waLogoBase64,
        hasCustomFont: !!this.fontBase64,
      });
    } catch (err: any) {
      console.warn('[PosterService] Asset loading notice:', err.message);
    }
  }

  /**
   * Escapes XML characters for safe SVG text embedding.
   */
  private escapeXml(unsafe: any): string {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\x27/g, '&apos;');
  }

  /**
   * Wraps long text into multiple lines of at most maxCharsPerLine.
   */
  private wrapText(text: string, maxCharsPerLine: number = 28, maxLines: number = 2): string[] {
    const clean = text.replace(/[\r\n]+/g, ' ').trim();
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
        if (lines.length === maxLines - 1) break;
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine);
    }
    return lines;
  }

  /**
   * Formats numeric or string price to clean "Rs. X,XXX" representation.
   */
  private formatPrice(price?: string | number): string {
    if (!price) return '';
    const num = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num <= 0) return '';
    return `Rs. ${Math.round(num).toLocaleString('en-US')}`;
  }

  /**
   * Resolves 3 to 4 crisp, high-conversion selling points.
   */
  private resolveBullets(details?: string, features?: string[]): string[] {
    const fallbackBullets = [
      '100% Genuine Brand Quality',
      'Island-wide Fast Delivery',
      'Cash on Delivery (COD) Available',
      'Verified Best Seller Rating',
    ];

    if (features && Array.isArray(features) && features.length > 0) {
      const clean = features
        .map((f) => f.replace(/^[\r\n•\-\*✔\s]+/, '').trim())
        .filter((f) => f.length > 3 && f.length < 50 && !/http|daraz|price|discount/i.test(f));
      if (clean.length >= 3) {
        return clean.slice(0, 4);
      }
    }

    if (!details || !details.trim()) {
      return fallbackBullets;
    }

    const lines = details
      .split(/[\r\n•\-\*✔]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && l.length < 50 && !/http|daraz|price|discount/i.test(l));

    if (lines.length >= 3) {
      return lines.slice(0, 4);
    }

    const merged = [...lines, ...fallbackBullets];
    const unique = Array.from(new Set(merged));
    return unique.slice(0, 4);
  }

  /**
   * Downloads product image, normalizes and resizes it to 420x420, returning base64.
   */
  private async fetchProductImageBase64(mediaUrl?: string | null): Promise<string> {
    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      return this.generateFallbackProductBase64();
    }

    try {
      console.log(`[PosterService] Downloading product image from: ${mediaUrl}`);
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      const buffer = Buffer.from(response.data);
      const resized = await sharp(buffer)
        .resize(420, 420, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();

      return resized.toString('base64');
    } catch (err: any) {
      console.warn(`[PosterService] Failed to fetch product image (${err.message}), using fallback.`);
      return this.generateFallbackProductBase64();
    }
  }

  /**
   * Generates a clean fallback product illustration when photo is unavailable.
   */
  private async generateFallbackProductBase64(): Promise<string> {
    const fallbackSvg = `
    <svg width="420" height="420" viewBox="0 0 420 420" xmlns="http://www.w3.org/2000/svg">
      <rect width="420" height="420" fill="#f8fafc"/>
      <g transform="translate(110, 80)">
        <rect width="200" height="220" rx="30" fill="#ffedd5" stroke="#f97316" stroke-width="4"/>
        <path d="M 60 70 Q 60 10 100 10 Q 140 10 140 70" stroke="#f97316" stroke-width="6" fill="none" stroke-linecap="round"/>
        <circle cx="100" cy="140" r="45" fill="#f97316"/>
        <text x="100" y="152" font-family="'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle">
          ★
        </text>
      </g>
      <text x="210" y="340" font-family="'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="bold" font-size="20" fill="#64748b" text-anchor="middle">
        Daraz Verified Product
      </text>
    </svg>
    `;
    const buffer = await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
    return buffer.toString('base64');
  }

  /**
   * Generates the High-Converting Single Deal Poster (1080x1080) and uploads to MinIO.
   * Returns the permanent public image URL.
   */
  async generateSingleDealPoster(input: PosterInput): Promise<string> {
    const startTime = Date.now();

    // 1. Resolve community branding
    const communityName =
      input.communityName || (await SettingsService.get('communityName', 'KH Daraz Deals & Updates'));

    // 2. Hybrid AI Step: Use Gemini AI to extract punchy 2-line title & top 4 selling points
    let productTitle = input.title || 'Special Daraz Flash Deal';
    let bullets = this.resolveBullets(input.productDetails, input.features);

    try {
      const aiExtraction = await copywritingService.extractPosterHighlights(input.title, input.productDetails);
      if (aiExtraction) {
        if (aiExtraction.shortTitle && aiExtraction.shortTitle.length > 5) {
          productTitle = aiExtraction.shortTitle;
        }
        if (aiExtraction.bullets && aiExtraction.bullets.length >= 3) {
          bullets = aiExtraction.bullets;
        }
        console.log(`[PosterService] Hybrid Gemini AI highlights applied: title="${productTitle}"`);
      }
    } catch (e: any) {
      console.warn('[PosterService] Fallback to heuristic title/bullets:', e.message);
    }

    const titleLines = this.wrapText(productTitle, 28, 2);
    const origPriceFormatted = this.formatPrice(input.originalPrice);
    const discPriceFormatted = this.formatPrice(input.discountPrice) || 'Hot Offer!';

    let discountPercentage = input.discountPercentage;
    if (!discountPercentage && input.originalPrice && input.discountPrice) {
      const orig = parseFloat(String(input.originalPrice).replace(/[^0-9.]/g, ''));
      const disc = parseFloat(String(input.discountPrice).replace(/[^0-9.]/g, ''));
      if (orig > disc && orig > 0) {
        discountPercentage = Math.round(((orig - disc) / orig) * 100);
      }
    }
    const discountBadgeText = discountPercentage ? `-${discountPercentage}%` : 'SUPER DEAL';

    // 3. Fetch & prepare product image
    const productBase64 = await this.fetchProductImageBase64(input.mediaUrl);

    // 4. Ensure branding assets are ready
    if (!this.khLogoBase64 || !this.darazLogoBase64 || !this.waLogoBase64) {
      this.loadBrandingAssets();
    }

    const khLogo = this.khLogoBase64;
    const darazLogo = this.darazLogoBase64;
    const waLogo = this.waLogoBase64;
    const customFont = this.fontBase64;

    // 5. Construct 1080x1080 SVG Poster Canvas
    const svg = `
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${
          customFont
            ? `
        <style>
          @font-face {
            font-family: 'CustomMontserrat';
            src: url('data:font/ttf;base64,${customFont}') format('truetype');
            font-weight: 700 900;
            font-style: normal;
          }
        </style>
        `
            : ''
        }

        <!-- Background Gradients -->
        <linearGradient id="mainBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#190338"/>
          <stop offset="35%" stop-color="#3b0764"/>
          <stop offset="70%" stop-color="#581c87"/>
          <stop offset="100%" stop-color="#14022c"/>
        </linearGradient>

        <radialGradient id="sunburst" cx="50%" cy="12%" r="65%">
          <stop offset="0%" stop-color="#c084fc" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="#7e22ce" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#190338" stop-opacity="0"/>
        </radialGradient>

        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="40%" stop-color="#facc15"/>
          <stop offset="100%" stop-color="#eab308"/>
        </linearGradient>

        <linearGradient id="redPill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#b91c1c"/>
        </linearGradient>

        <linearGradient id="ribbonRed" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f43f5e"/>
          <stop offset="40%" stop-color="#e11d48"/>
          <stop offset="100%" stop-color="#9f1239"/>
        </linearGradient>

        <!-- Drop Shadows -->
        <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.55"/>
        </filter>
        <filter id="pillShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#7f1d1d" flood-opacity="0.45"/>
        </filter>
        <filter id="ribbonShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>

      <!-- 1. Background & Sunburst -->
      <rect width="1080" height="1080" fill="url(#mainBg)"/>
      <rect width="1080" height="650" fill="url(#sunburst)"/>

      <!-- Lightburst Rays -->
      <g opacity="0.14" fill="#ffffff">
        <polygon points="540,110 440,0 490,0"/>
        <polygon points="540,110 590,0 640,0"/>
        <polygon points="540,110 180,0 240,0"/>
        <polygon points="540,110 840,0 900,0"/>
        <polygon points="540,110 0,60 0,110"/>
        <polygon points="540,110 1080,60 1080,110"/>
      </g>

      <!-- Sparkle Stars -->
      <path d="M 75 190 Q 75 170 85 165 Q 75 160 75 140 Q 75 160 65 165 Q 75 170 75 190 Z" fill="#fde047"/>
      <path d="M 985 210 Q 985 190 995 185 Q 985 180 985 160 Q 985 180 975 185 Q 985 190 985 210 Z" fill="#fde047"/>
      <circle cx="160" cy="70" r="3" fill="#ffffff" opacity="0.8"/>
      <circle cx="890" cy="85" r="4" fill="#ffffff" opacity="0.8"/>

      <!-- 2. Header: Megaphone Graphic (Left) -->
      <g transform="translate(42, 28)">
        <circle cx="48" cy="48" r="44" fill="url(#goldGradient)" filter="url(#ribbonShadow)"/>
        <circle cx="48" cy="48" r="38" fill="#ffffff"/>
        <g transform="translate(24, 25) scale(0.95)">
          <polygon points="12,18 36,8 36,40 12,30" fill="#e11d48"/>
          <ellipse cx="36" cy="24" rx="5" ry="16" fill="#facc15"/>
          <ellipse cx="36" cy="24" rx="2" ry="12" fill="#881337"/>
          <polygon points="16,28 14,44 22,44 20,29" fill="#1e1b4b"/>
          <rect x="6" y="20" width="8" height="8" rx="2" fill="#facc15"/>
          <path d="M 44 14 Q 50 24 44 34" stroke="#facc15" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <path d="M 49 8 Q 58 24 49 40" stroke="#facc15" stroke-width="3" fill="none" stroke-linecap="round"/>
        </g>
      </g>

      <!-- 3. Header: Community Name Badge with KH Brand Logo (Top Center) -->
      <g transform="translate(280, 16)" filter="url(#pillShadow)">
        <rect width="520" height="52" rx="26" fill="url(#goldGradient)" stroke="#ca8a04" stroke-width="2.5"/>
        
        <!-- Embedded User's KH Circular Logo Avatar -->
        <g transform="translate(10, 6)">
          <circle cx="20" cy="20" r="20" fill="#0f172a" stroke="#ca8a04" stroke-width="1.5"/>
          ${
            khLogo
              ? `
          <clipPath id="khAvatarClip">
            <circle cx="20" cy="20" r="19"/>
          </clipPath>
          <image href="data:image/png;base64,${khLogo}" x="0" y="0" width="40" height="40" preserveAspectRatio="xMidYMid slice" clip-path="url(#khAvatarClip)"/>
          `
              : `
          <text x="20" y="26" font-family="'CustomMontserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="14" fill="#facc15" text-anchor="middle">KH</text>
          `
          }
        </g>
        
        <!-- Community Text in Reference Poster Font Style -->
        <text x="280" y="34" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="20" fill="#000000" text-anchor="middle" letter-spacing="0.6">
          ${this.escapeXml(communityName)}
        </text>
      </g>

      <!-- 4. Header: 3D Title Banner: Daraz Top Deals! with Real Daraz Logo -->
      <g transform="translate(245, 76)" filter="url(#ribbonShadow)">
        <polygon points="0,52 -28,26 0,0" fill="#881337"/>
        <polygon points="590,52 618,26 590,0" fill="#881337"/>
        <rect x="0" y="0" width="590" height="78" rx="16" fill="url(#ribbonRed)" stroke="#facc15" stroke-width="3"/>
        
        <!-- Embedded Real Daraz Orange Logo in Ribbon -->
        <g transform="translate(20, 14)">
          ${
            darazLogo
              ? `
          <image href="data:image/png;base64,${darazLogo}" x="0" y="0" width="50" height="50" preserveAspectRatio="xMidYMid meet"/>
          `
              : `
          <rect width="50" height="50" rx="12" fill="#ffffff"/>
          <rect x="13" y="18" width="24" height="24" rx="4" fill="#ff6000"/>
          `
          }
        </g>
        
        <!-- 3D Banner Title Text -->
        <text x="330" y="55" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="46" fill="#fef08a" text-anchor="middle" stroke="#991b1b" stroke-width="2" letter-spacing="1">
          Daraz Top Deals!
        </text>
      </g>

      <!-- 5. Header: Top-Right Tilted Tag -->
      <g transform="translate(805, 30) rotate(5)">
        <rect width="235" height="42" rx="10" fill="#facc15" stroke="#eab308" stroke-width="2" filter="url(#pillShadow)"/>
        <text x="117" y="27" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="13" fill="#1e1b4b" text-anchor="middle" letter-spacing="0.5">
          ★ DON&apos;T MISS THIS OFFER! ★
        </text>
      </g>

      <!-- 6. Main Center White Card (Product Showcase) -->
      <g filter="url(#cardShadow)">
        <rect x="50" y="175" width="980" height="690" rx="36" fill="#ffffff" stroke="#facc15" stroke-width="5"/>
        <path d="M 50 205 Q 50 175 80 175 L 1000 175 Q 1030 175 1030 205 L 1030 220 L 50 220 Z" fill="#fefce8"/>
      </g>

      <!-- Product Title & Verified Deal Badge inside Card -->
      <g transform="translate(90, 205)">
        <rect width="180" height="32" rx="8" fill="#fef08a" stroke="#facc15" stroke-width="1.5"/>
        <text x="90" y="22" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="13" fill="#854d0e" text-anchor="middle">
          ★ VERIFIED DEAL ★
        </text>

        ${titleLines[0] ? `<text x="0" y="68" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="33" fill="#0f172a">${this.escapeXml(titleLines[0])}</text>` : ''}
        ${titleLines[1] ? `<text x="0" y="110" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="33" fill="#0f172a">${this.escapeXml(titleLines[1])}</text>` : ''}
      </g>

      <!-- LEFT COLUMN: Feature Bullet Points & Pricing -->
      <g transform="translate(90, 350)">
        ${bullets
          .map(
            (b, i) => `
        <g transform="translate(0, ${i * 48})">
          <circle cx="16" cy="16" r="14" fill="#fef08a" stroke="#eab308" stroke-width="2"/>
          <path d="M 10 16 L 14 20 L 22 12" stroke="#854d0e" stroke-width="3" fill="none" stroke-linecap="round"/>
          <text x="44" y="22" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="bold" font-size="18.5" fill="#1e293b">${this.escapeXml(b)}</text>
        </g>
        `
          )
          .join('')}

        <!-- PRICE SECTION -->
        <g transform="translate(0, 220)">
          <!-- Original Price with Strikethrough -->
          ${
            origPriceFormatted
              ? `
          <g transform="translate(60, 40)">
            <text x="0" y="0" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="bold" font-size="28" fill="#991b1b">
              ${this.escapeXml(origPriceFormatted)}
            </text>
            <line x1="-10" y1="-8" x2="${origPriceFormatted.length * 18}" y2="-8" stroke="#dc2626" stroke-width="4.5"/>
          </g>
          `
              : ''
          }

          <!-- Big Red Offer Price Pill -->
          <g transform="translate(0, 65)" filter="url(#pillShadow)">
            <rect width="280" height="74" rx="20" fill="url(#redPill)" stroke="#b91c1c" stroke-width="2"/>
            <text x="140" y="52" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" text-anchor="middle">
              ${this.escapeXml(discPriceFormatted)}
            </text>
          </g>

          <!-- Discount Yellow Badge -->
          <g transform="translate(295, 65)" filter="url(#pillShadow)">
            <rect width="130" height="74" rx="20" fill="url(#goldGradient)" stroke="#ca8a04" stroke-width="2"/>
            <text x="65" y="50" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="34" fill="#000000" text-anchor="middle">
              ${this.escapeXml(discountBadgeText)}
            </text>
          </g>
        </g>
      </g>

      <!-- RIGHT COLUMN: Product Image Frame -->
      <g transform="translate(540, 310)">
        <rect width="440" height="440" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2.5" filter="url(#pillShadow)"/>
        <image href="data:image/png;base64,${productBase64}" x="10" y="10" width="420" height="420" preserveAspectRatio="xMidYMid meet"/>
        
        <!-- Limited Stock Alert Badge on bottom of image -->
        <g transform="translate(70, 415)">
          <rect width="300" height="34" rx="10" fill="#dc2626" stroke="#ffffff" stroke-width="2"/>
          <text x="150" y="23" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">
            ⚡ LIMITED STOCK OFFER ⚡
          </text>
        </g>
      </g>

      <!-- 7. Bottom Footer Banner with Official Daraz and WhatsApp Logos -->
      <g transform="translate(50, 895)">
        <rect width="980" height="135" rx="30" fill="#120224" stroke="#a855f7" stroke-width="3" filter="url(#cardShadow)"/>

        <!-- Left: Official Daraz App Logo + Typography -->
        <g transform="translate(45, 38)">
          ${
            darazLogo
              ? `
          <image href="data:image/png;base64,${darazLogo}" x="0" y="4" width="58" height="58" preserveAspectRatio="xMidYMid meet"/>
          `
              : `
          <rect width="52" height="52" rx="14" fill="#ff6000"/>
          `
          }
          <text x="75" y="46" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" letter-spacing="0.5">
            Daraz
          </text>
        </g>

        <!-- Vertical Divider -->
        <line x1="240" y1="30" x2="240" y2="105" stroke="#6b21a8" stroke-width="2.5"/>

        <!-- Center: Official WhatsApp Button with Real WhatsApp Logo -->
        <g transform="translate(265, 35)">
          <rect width="470" height="68" rx="34" fill="#16a34a" stroke="#22c55e" stroke-width="3" filter="url(#pillShadow)"/>
          
          <!-- Official WhatsApp Logo Icon -->
          <g transform="translate(18, 9)">
            ${
              waLogo
                ? `
            <image href="data:image/png;base64,${waLogo}" x="0" y="0" width="50" height="50" preserveAspectRatio="xMidYMid meet"/>
            `
                : `
            <circle cx="25" cy="25" r="22" fill="#ffffff"/>
            `
            }
          </g>
          
          <text x="265" y="43" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-weight="900" font-size="18.5" fill="#ffffff" text-anchor="middle">
            Join WhatsApp Group for Links
          </text>
        </g>

        <!-- Right: Tagline -->
        <g transform="translate(760, 48)">
          <text x="100" y="30" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-style="italic" font-weight="bold" font-size="17" fill="#fde047" text-anchor="middle">
            Shop Smart.
          </text>
          <text x="100" y="55" font-family="'CustomMontserrat', 'Montserrat', 'DejaVu Sans', Arial, sans-serif" font-style="italic" font-weight="bold" font-size="17" fill="#ffffff" text-anchor="middle">
            Save More!
          </text>
        </g>
      </g>
    </svg>
    `;

    // 6. Rasterize to high-quality JPEG Buffer with Sharp
    const jpegBuffer = await sharp(Buffer.from(svg))
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    // 7. Upload directly to MinIO
    const posterUrl = await wahaMediaService.uploadBuffer(jpegBuffer, 'image/jpeg', 'deal-poster');
    console.log(`[PosterService] Hybrid deal poster generated & stored in ${Date.now() - startTime}ms: ${posterUrl}`);
    return posterUrl;
  }

  /**
   * Alias for createAndUploadPoster matching existing calls in routes & workers.
   */
  async createAndUploadPoster(input: PosterInput): Promise<string> {
    return this.generateSingleDealPoster(input);
  }
}

export const posterService = new PosterService();
