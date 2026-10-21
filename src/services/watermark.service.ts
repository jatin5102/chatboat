import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export class WatermarkService {
  /**
   * Stretches or renders a professional watermark banner directly onto an image
   * containing the user's name, phone number, and timestamp.
   */
  public async watermarkImage(
    imagePath: string,
    userName: string,
    userPhone: string
  ): Promise<Buffer> {
    const imageBuffer = await fs.readFile(imagePath);
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 800;

    const bannerHeight = Math.max(70, Math.round(height * 0.1));
    const fontSizeTitle = Math.max(16, Math.round(bannerHeight * 0.28));
    const fontSizeSub = Math.max(12, Math.round(bannerHeight * 0.20));

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const safeName = this.escapeXml(userName || 'Valued Client');
    const safePhone = this.escapeXml(userPhone || '');

    // SVG banner overlay
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Top left confidential tag -->
        <g opacity="0.9">
          <rect x="20" y="20" width="220" height="34" rx="6" fill="#0f172a" opacity="0.75"/>
          <text x="32" y="42" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">
            VERIFIED PROPOSAL
          </text>
        </g>

        <!-- Subtle center watermark -->
        <g opacity="0.18">
          <text x="${width / 2}" y="${height / 2}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${Math.round(width * 0.045)}" 
                font-weight="bold" 
                fill="#ffffff" 
                text-anchor="middle" 
                transform="rotate(-25 ${width / 2} ${height / 2})">
            ${safeName} • ${safePhone}
          </text>
        </g>

        <!-- Bottom personalization banner -->
        <g>
          <!-- Dark gradient background rectangle -->
          <rect x="0" y="${height - bannerHeight}" width="${width}" height="${bannerHeight}" fill="#0b1120" opacity="0.85"/>
          <line x1="0" y1="${height - bannerHeight}" x2="${width}" y2="${height - bannerHeight}" stroke="#38bdf8" stroke-width="3" opacity="0.9"/>
          
          <!-- Personalized Text Details -->
          <text x="30" y="${height - bannerHeight + Math.round(bannerHeight * 0.42)}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${fontSizeTitle}" 
                font-weight="bold" 
                fill="#ffffff">
            Prepared exclusively for: <tspan fill="#38bdf8">${safeName}</tspan> | Mobile: <tspan fill="#facc15">${safePhone}</tspan>
          </text>
          
          <text x="30" y="${height - bannerHeight + Math.round(bannerHeight * 0.78)}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${fontSizeSub}" 
                fill="#cbd5e1">
            Personalized Property Portfolio &#8226; Date: ${dateStr} &#8226; Confidential &#8226; Not for redistribution
          </text>
        </g>
      </svg>
    `;

    return sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0
        }
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Injects personalized watermark header, footer and diagonal watermark on each page of a PDF.
   */
  public async watermarkPdf(
    pdfPath: string,
    userName: string,
    userPhone: string
  ): Promise<Buffer> {
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const safePdfName = (userName || 'Client').replace(/[^\x20-\x7E]/g, '').trim() || 'Client';
    const safePdfPhone = (userPhone || '').replace(/[^\x20-\x7E]/g, '').trim();

    const displayClient = `${safePdfName} | MOBILE: ${safePdfPhone}`;
    const watermarkCenterText = `PREPARED FOR ${safePdfName.toUpperCase()} - ${safePdfPhone}`;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();

      // 1. Top Header Banner
      page.drawRectangle({
        x: 0,
        y: height - 28,
        width: width,
        height: 28,
        color: rgb(0.06, 0.09, 0.16),
        opacity: 0.95
      });

      page.drawText(`EXCLUSIVE PROPOSAL | PREPARED FOR: ${displayClient}`, {
        x: 20,
        y: height - 19,
        size: 9.5,
        font: helveticaBold,
        color: rgb(0.22, 0.74, 0.97)
      });

      page.drawText(`DATE: ${dateStr}`, {
        x: width - 110,
        y: height - 19,
        size: 8.5,
        font: helvetica,
        color: rgb(1, 1, 1)
      });

      // 2. Prominent Client Allocation Box on Cover Page
      if (pageIndex === 0) {
        page.drawRectangle({
          x: 40,
          y: height - 190,
          width: width - 80,
          height: 44,
          color: rgb(0.95, 0.97, 1),
          borderColor: rgb(0.15, 0.55, 0.92),
          borderWidth: 1.2
        });

        page.drawText('CONFIDENTIAL CLIENT ALLOCATION', {
          x: 55,
          y: height - 162,
          size: 8.5,
          font: helveticaBold,
          color: rgb(0.12, 0.45, 0.8)
        });

        page.drawText(`PROPOSAL FOR: ${safePdfName.toUpperCase()}   |   MOBILE: ${safePdfPhone}`, {
          x: 55,
          y: height - 179,
          size: 10,
          font: helveticaBold,
          color: rgb(0.08, 0.15, 0.28)
        });
      }

      // 3. Diagonal Semi-transparent Watermark across center
      page.drawText(watermarkCenterText, {
        x: width * 0.15,
        y: height * 0.35,
        size: 26,
        font: helveticaBold,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.13,
        rotate: degrees(38)
      });

      // 4. Bottom Footer Strip
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 22,
        color: rgb(0.06, 0.09, 0.16),
        opacity: 0.92
      });

      page.drawText(
        `Confidential property brochure for ${safePdfName} | Mobile: ${safePdfPhone} - Strictly not for unauthorized redistribution`,
        {
          x: 20,
          y: 7,
          size: 7.5,
          font: helvetica,
          color: rgb(0.8, 0.8, 0.8)
        }
      );
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '\'':
          return '&apos;';
        case '"':
          return '&quot;';
        default:
          return c;
      }
    });
  }
}

export const watermarkService = new WatermarkService();
