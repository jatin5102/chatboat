import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export class WatermarkService {
  /**
   * Stretches or renders a professional watermark banner directly onto an image
   * containing the channel partner name, firm name, RERA number, phone, and timestamp.
   */
  public async watermarkImage(
    imagePath: string,
    userName: string,
    userPhone: string,
    firmName: string = '',
    reraNumber: string = ''
  ): Promise<Buffer> {
    const imageBuffer = await fs.readFile(imagePath);
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 800;

    const bannerHeight = Math.max(75, Math.round(height * 0.12));
    const fontSizeTitle = Math.max(14, Math.round(bannerHeight * 0.25));
    const fontSizeSub = Math.max(11, Math.round(bannerHeight * 0.18));

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const safeName = this.escapeXml(userName || 'M3M Partner');
    const safePhone = this.escapeXml(userPhone || '');
    const safeFirm = this.escapeXml(firmName || '');
    const safeRera = this.escapeXml(reraNumber || '');

    // SVG banner overlay
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Top left badge -->
        <g opacity="0.92">
          <rect x="20" y="20" width="280" height="34" rx="6" fill="#0f172a" opacity="0.85"/>
          <text x="32" y="42" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">
            M3M NOIDA MARKETING COLLATERAL
          </text>
        </g>

        <!-- Subtle center diagonal watermark -->
        <g opacity="0.20">
          <text x="${width / 2}" y="${height / 2}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${Math.round(width * 0.04)}" 
                font-weight="bold" 
                fill="#ffffff" 
                text-anchor="middle" 
                transform="rotate(-25 ${width / 2} ${height / 2})">
            ${safeFirm ? safeFirm + ' • ' : ''}${safeName} • ${safePhone}
          </text>
        </g>

        <!-- Bottom personalization banner -->
        <g>
          <!-- Dark gradient background rectangle -->
          <rect x="0" y="${height - bannerHeight}" width="${width}" height="${bannerHeight}" fill="#0b1120" opacity="0.90"/>
          <line x1="0" y1="${height - bannerHeight}" x2="${width}" y2="${height - bannerHeight}" stroke="#38bdf8" stroke-width="3" opacity="0.95"/>
          
          <!-- Personalized Text Details -->
          <text x="30" y="${height - bannerHeight + Math.round(bannerHeight * 0.38)}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${fontSizeTitle}" 
                font-weight="bold" 
                fill="#ffffff">
            Partner: <tspan fill="#38bdf8">${safeName}</tspan>${safeFirm ? ' | Firm: <tspan fill="#facc15">' + safeFirm + '</tspan>' : ''}${safeRera ? ' | RERA: <tspan fill="#4ade80">' + safeRera + '</tspan>' : ''} | Mobile: <tspan fill="#facc15">${safePhone}</tspan>
          </text>
          
          <text x="30" y="${height - bannerHeight + Math.round(bannerHeight * 0.76)}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${fontSizeSub}" 
                fill="#cbd5e1">
            M3M Noida Authorized Channel Partner Creative &#8226; Date: ${dateStr} &#8226; Verified Collateral
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
    userPhone: string,
    firmName: string = '',
    reraNumber: string = ''
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

    const safePdfName = (userName || 'Partner').replace(/[^\x20-\x7E]/g, '').trim() || 'Partner';
    const safePdfPhone = (userPhone || '').replace(/[^\x20-\x7E]/g, '').trim();
    const safePdfFirm = (firmName || '').replace(/[^\x20-\x7E]/g, '').trim();
    const safePdfRera = (reraNumber || '').replace(/[^\x20-\x7E]/g, '').trim();

    let displayClient = `PARTNER: ${safePdfName}`;
    if (safePdfFirm) displayClient += ` | ${safePdfFirm}`;
    if (safePdfRera) displayClient += ` | RERA: ${safePdfRera}`;
    displayClient += ` | MOB: ${safePdfPhone}`;

    const watermarkCenterText = `M3M NOIDA • ${safePdfFirm ? safePdfFirm.toUpperCase() + ' • ' : ''}${safePdfName.toUpperCase()} - ${safePdfPhone}`;

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

      page.drawText(`M3M NOIDA COLLATERAL | ${displayClient}`, {
        x: 20,
        y: height - 19,
        size: 9.0,
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
          height: 48,
          color: rgb(0.95, 0.97, 1),
          borderColor: rgb(0.15, 0.55, 0.92),
          borderWidth: 1.2
        });

        page.drawText('AUTHORIZED M3M NOIDA CHANNEL PARTNER COLLATERAL', {
          x: 55,
          y: height - 160,
          size: 8.5,
          font: helveticaBold,
          color: rgb(0.12, 0.45, 0.8)
        });

        page.drawText(`PREPARED FOR: ${safePdfName.toUpperCase()}${safePdfFirm ? ' (' + safePdfFirm.toUpperCase() + ')' : ''} | MOB: ${safePdfPhone}`, {
          x: 55,
          y: height - 178,
          size: 9.5,
          font: helveticaBold,
          color: rgb(0.08, 0.15, 0.28)
        });
      }

      // 3. Diagonal Semi-transparent Watermark across center
      const textWidth = helveticaBold.widthOfTextAtSize(watermarkCenterText, 22);
      page.drawText(watermarkCenterText, {
        x: (width - textWidth) / 2,
        y: height / 2 - 20,
        size: 22,
        font: helveticaBold,
        color: rgb(0.65, 0.7, 0.75),
        opacity: 0.25,
        rotate: degrees(30)
      });

      // 4. Bottom Footer Security Bar
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 22,
        color: rgb(0.06, 0.09, 0.16),
        opacity: 0.95
      });

      page.drawText(
        `M3M Noida Channel Partner Digital Asset • RERA Regulated • Personalized for client presentation`,
        {
          x: 20,
          y: 7,
          size: 7.5,
          font: helvetica,
          color: rgb(0.7, 0.75, 0.8)
        }
      );

      page.drawText(`Page ${pageIndex + 1} of ${pages.length}`, {
        x: width - 75,
        y: 7,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.6, 0.7)
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const watermarkService = new WatermarkService();
