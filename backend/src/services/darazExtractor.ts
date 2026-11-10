import axios from 'axios';
import { wahaMediaService } from './wahaMediaService.js';

export interface ExtractedDealData {
  exactAffiliateUrl: string;
  title: string;
  originalPrice?: string;
  discountPrice?: string;
  discountPercentage?: number;
  commissionAmount?: number;
  mediaUrl?: string;
  rawText: string;
}

export class DarazExtractor {
  /**
   * Extracts URL, product title, prices, and product image from Daraz share text.
   */
  static async extractDealFromText(
    text: string,
    existingMediaUrl?: string
  ): Promise<ExtractedDealData> {
    // 1. Extract URL (s.daraz.lk or daraz.lk)
    const urlMatch = text.match(/(https?:\/\/[^\s]+daraz[^\s]+)/i);
    const exactUrl = urlMatch ? urlMatch[0].trim() : '';

    // 2. Extract Product Name from user message
    let title = '';
    const titleMatch = text.match(/Product Name:\s*([^\n\r]+)/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // 3. Extract Prices from user message
    let originalPrice = '';
    const origPriceMatch = text.match(/Product Price:\s*([^\n\r]+)/i);
    if (origPriceMatch) {
      originalPrice = origPriceMatch[1].trim().replace(/Rs\.?\s*/i, '');
    }

    let discountPrice = '';
    const discPriceMatch = text.match(/Discount Price:\s*([^\n\r]+)/i);
    if (discPriceMatch) {
      discountPrice = discPriceMatch[1].trim().split(/\s+http/)[0].replace(/Rs\.?\s*/i, '');
    }

    // Compute discount % if both prices exist
    let discountPercentage: number | undefined;
    const origNum = parseFloat(originalPrice.replace(/,/g, ''));
    const discNum = parseFloat(discountPrice.replace(/,/g, ''));
    if (!isNaN(origNum) && !isNaN(discNum) && origNum > discNum) {
      discountPercentage = Math.round(((origNum - discNum) / origNum) * 100);
    }

    // 4. Image Handling:
    // If the user explicitly requested no photo ('NONE'), skip image scraping
    let mediaUrl = existingMediaUrl;
    if (existingMediaUrl === 'NONE') {
      mediaUrl = undefined;
    } else if (!mediaUrl && exactUrl) {
      try {
        console.log(`[DarazExtractor] Resolving Daraz URL to scrape product image: ${exactUrl}`);
        const response = await axios.get(exactUrl, {
          maxRedirects: 5,
          timeout: 10000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        const html = typeof response.data === 'string' ? response.data : '';

        // Extract OpenGraph Image
        const ogImageMatch =
          html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);

        let scrapedImageUrl = ogImageMatch ? ogImageMatch[1] : null;

        // If title was missing in message, grab from og:title
        if (!title) {
          const ogTitleMatch =
            html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
            html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
          if (ogTitleMatch) {
            title = ogTitleMatch[1].replace(/\|\s*Daraz.*$/i, '').trim();
          }
        }

        // Scraped product image from Daraz CDN
        if (scrapedImageUrl) {
          if (scrapedImageUrl.startsWith('//')) {
            scrapedImageUrl = `https:${scrapedImageUrl}`;
          }
          // Clean avif format to jpg for maximum WhatsApp compatibility
          scrapedImageUrl = scrapedImageUrl.replace(/\/format,avif/g, '/format,jpg');
          console.log(`[DarazExtractor] Found Daraz product image: ${scrapedImageUrl}`);
          mediaUrl = scrapedImageUrl;
        }
      } catch (err: any) {
        console.warn(`[DarazExtractor] Could not extract image from Daraz link: ${err.message}`);
      }
    }

    // Fallback title if still empty
    if (!title) {
      title = text.split('\n')[0]?.slice(0, 100) || 'Daraz Flash Deal';
    }

    return {
      exactAffiliateUrl: exactUrl,
      title,
      originalPrice,
      discountPrice,
      discountPercentage,
      mediaUrl,
      rawText: text,
    };
  }
}

