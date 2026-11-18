import axios from 'axios';
import sharp from 'sharp';
import { wahaMediaService } from './wahaMediaService.js';
import { SettingsService } from './settingsService.js';

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
  private wrapText(text: string, maxCharsPerLine: number = 30, maxLines: number = 2): string[] {
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
        <text x="100" y="152" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle">
          ★
        </text>
      </g>
      <text x="210" y="340" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="20" fill="#64748b" text-anchor="middle">
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

    // 1. Resolve community branding & details
    const communityName =
      input.communityName || (await SettingsService.get('communityName', 'KH Daraz Deals & Updates'));
    const titleLines = this.wrapText(input.title || 'Special Daraz Flash Deal', 30, 2);
    const origPriceFormatted = this.formatPrice(input.originalPrice);
    const discPriceFormatted = this.formatPrice(input.discountPrice) || 'Hot Offer!';
    const bullets = this.resolveBullets(input.productDetails, input.features);

    let discountPercentage = input.discountPercentage;
    if (!discountPercentage && input.originalPrice && input.discountPrice) {
      const orig = parseFloat(String(input.originalPrice).replace(/[^0-9.]/g, ''));
      const disc = parseFloat(String(input.discountPrice).replace(/[^0-9.]/g, ''));
      if (orig > disc && orig > 0) {
        discountPercentage = Math.round(((orig - disc) / orig) * 100);
      }
    }
    const discountBadgeText = discountPercentage ? `-${discountPercentage}%` : 'SUPER DEAL';

    // 2. Fetch & prepare product image
    const productBase64 = await this.fetchProductImageBase64(input.mediaUrl);

    // 3. Construct 1080x1080 SVG Poster Canvas
    const svg = `
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
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
      <g transform="translate(42, 32)">
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

      <!-- 3. Header: Community Name Badge (Top Center) -->
      <g transform="translate(330, 18)">
        <rect width="420" height="42" rx="21" fill="url(#goldGradient)" stroke="#ca8a04" stroke-width="2"/>
        <circle cx="35" cy="21" r="6" fill="#1e1b4b"/>
        <path d="M 23 33 Q 23 27 35 27 Q 47 27 47 33 Z" fill="#1e1b4b"/>
        <text x="225" y="28" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="17" fill="#000000" text-anchor="middle" letter-spacing="0.5">
          ${this.escapeXml(communityName)}
        </text>
      </g>

      <!-- 4. Header: 3D Title Banner: Daraz Top Deals! -->
      <g transform="translate(245, 75)" filter="url(#ribbonShadow)">
        <polygon points="0,52 -28,26 0,0" fill="#881337"/>
        <polygon points="590,52 618,26 590,0" fill="#881337"/>
        <rect x="0" y="0" width="590" height="78" rx="16" fill="url(#ribbonRed)" stroke="#facc15" stroke-width="3"/>
        
        <!-- Daraz Logo Bag in Ribbon -->
        <g transform="translate(20, 14)">
          <rect width="50" height="50" rx="12" fill="#ffffff"/>
          <rect x="13" y="18" width="24" height="24" rx="4" fill="#ff6000"/>
          <path d="M 19 18 Q 19 10 25 10 Q 31 10 31 18" stroke="#ffffff" stroke-width="2.5" fill="none"/>
          <path d="M 21 28 L 29 28" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
        </g>
        
        <!-- 3D Banner Title Text -->
        <text x="330" y="55" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="46" fill="#fef08a" text-anchor="middle" stroke="#991b1b" stroke-width="2" letter-spacing="1">
          Daraz Top Deals!
        </text>
      </g>

      <!-- 5. Header: Top-Right Tilted Tag -->
      <g transform="translate(805, 30) rotate(5)">
        <rect width="235" height="42" rx="10" fill="#facc15" stroke="#eab308" stroke-width="2" filter="url(#pillShadow)"/>
        <text x="117" y="27" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="13" fill="#1e1b4b" text-anchor="middle" letter-spacing="0.5">
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
        <text x="90" y="22" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="13" fill="#854d0e" text-anchor="middle">
          ★ VERIFIED DEAL ★
        </text>

        ${titleLines[0] ? `<text x="0" y="68" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="33" fill="#0f172a">${this.escapeXml(titleLines[0])}</text>` : ''}
        ${titleLines[1] ? `<text x="0" y="110" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="33" fill="#0f172a">${this.escapeXml(titleLines[1])}</text>` : ''}
      </g>

      <!-- LEFT COLUMN: Feature Bullet Points & Pricing -->
      <g transform="translate(90, 350)">
        ${bullets
          .map(
            (b, i) => `
        <g transform="translate(0, ${i * 48})">
          <circle cx="16" cy="16" r="14" fill="#fef08a" stroke="#eab308" stroke-width="2"/>
          <path d="M 10 16 L 14 20 L 22 12" stroke="#854d0e" stroke-width="3" fill="none" stroke-linecap="round"/>
          <text x="44" y="22" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="18.5" fill="#1e293b">${this.escapeXml(b)}</text>
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
            <text x="0" y="0" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="28" fill="#991b1b">
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
            <text x="140" y="52" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" text-anchor="middle">
              ${this.escapeXml(discPriceFormatted)}
            </text>
          </g>

          <!-- Discount Yellow Badge -->
          <g transform="translate(295, 65)" filter="url(#pillShadow)">
            <rect width="130" height="74" rx="20" fill="url(#goldGradient)" stroke="#ca8a04" stroke-width="2"/>
            <text x="65" y="50" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="34" fill="#000000" text-anchor="middle">
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
          <text x="150" y="23" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">
            ⚡ LIMITED STOCK OFFER ⚡
          </text>
        </g>
      </g>

      <!-- 7. Bottom Footer Banner -->
      <g transform="translate(50, 895)">
        <rect width="980" height="135" rx="30" fill="#120224" stroke="#a855f7" stroke-width="3" filter="url(#cardShadow)"/>

        <!-- Left: Daraz Branding -->
        <g transform="translate(45, 42)">
          <rect width="52" height="52" rx="14" fill="#ff6000"/>
          <path d="M 26 12 Q 26 5 32 5 Q 38 5 38 12" stroke="#ffffff" stroke-width="3" fill="none"/>
          <rect x="18" y="12" width="28" height="28" rx="6" fill="#ffffff"/>
          <path d="M 24 24 L 28 28 L 38 18" stroke="#ff6000" stroke-width="3.5" fill="none" stroke-linecap="round"/>
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" letter-spacing="0.5">
            Daraz
          </text>
        </g>

        <!-- Vertical Divider -->
        <line x1="260" y1="30" x2="260" y2="105" stroke="#6b21a8" stroke-width="2.5"/>

        <!-- Center: WhatsApp CTA Button -->
        <g transform="translate(290, 35)">
          <rect width="430" height="66" rx="33" fill="#16a34a" stroke="#22c55e" stroke-width="3" filter="url(#pillShadow)"/>
          <circle cx="36" cy="33" r="22" fill="#ffffff"/>
          <g transform="translate(18, 15) scale(1.15)">
            <circle cx="16" cy="16" r="16" fill="#25D366"/>
            <path d="M 16 3 C 8.8 3 3 8.8 3 16 C 3 18.5 3.7 20.8 4.9 22.8 L 3.5 28.5 L 9.3 27.2 C 11.2 28.3 13.5 29 16 29 C 23.2 29 29 23.2 29 16 C 29 8.8 23.2 3 16 3 Z" fill="#ffffff"/>
            <path d="M 16 4.8 C 9.8 4.8 4.8 9.8 4.8 16 C 4.8 18.2 5.4 20.2 6.5 21.9 L 5.7 25.8 L 9.7 24.8 C 11.4 25.8 13.6 26.4 16 26.4 C 22.2 26.4 27.2 21.4 27.2 16 C 27.2 9.8 22.2 4.8 16 4.8 Z" fill="#25D366"/>
            <path d="M 12.5 10.5 C 12.2 9.8 11.8 9.7 11.4 9.7 C 11 9.7 10.6 9.7 10.2 10.1 C 9.8 10.5 8.7 11.5 8.7 13.6 C 8.7 15.7 10.3 17.7 10.5 18 C 10.8 18.3 13.5 22.6 17.8 24.3 C 21.4 25.7 22.1 25.4 22.9 25.3 C 23.7 25.2 25.4 24.3 25.8 23.2 C 26.1 22.1 26.1 21.1 26 20.9 C 25.9 20.7 25.5 20.6 24.9 20.3 C 24.3 20 21.5 18.6 21 18.4 C 20.5 18.2 20.1 18.1 19.8 18.6 C 19.4 19.1 18.4 20.3 18.1 20.6 C 17.8 20.9 17.5 21 16.9 20.7 C 16.3 20.4 14.4 19.8 12.2 17.8 C 10.5 16.3 9.3 14.4 9 13.8 C 8.7 13.2 9 12.9 9.3 12.6 C 9.6 12.3 9.9 11.9 10.2 11.5 C 10.5 11.1 10.6 10.8 10.8 10.4 C 11 10 10.9 9.6 10.7 9.3 Z" fill="#ffffff"/>
          </g>
          <text x="75" y="41" font-family="DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="18.5" fill="#ffffff">
            Join WhatsApp Group for Links
          </text>
        </g>

        <!-- Right: Tagline -->
        <g transform="translate(740, 48)">
          <text x="110" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-style="italic" font-weight="bold" font-size="18" fill="#fde047" text-anchor="middle">
            Shop Smart.
          </text>
          <text x="110" y="55" font-family="DejaVu Sans, Arial, sans-serif" font-style="italic" font-weight="bold" font-size="18" fill="#ffffff" text-anchor="middle">
            Save More!
          </text>
        </g>
      </g>
    </svg>
    `;

    // 4. Rasterize to high-quality JPEG Buffer
    const jpegBuffer = await sharp(Buffer.from(svg))
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    // 5. Upload directly to MinIO
    const posterUrl = await wahaMediaService.uploadBuffer(jpegBuffer, 'image/jpeg', 'deal-poster');
    console.log(`[PosterService] Single deal poster generated & stored in ${Date.now() - startTime}ms: ${posterUrl}`);
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
