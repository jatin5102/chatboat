import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

export class WatermarkService {
    /**
     * Generates a high-converting, luxury 9:16 vertical festive flyer / story creative
     * matching the M3M promotional format (Reference design),
     * dynamically customized according to Residential vs Commercial platter,
     * showing ONLY the partner's name and phone number at the bottom.
     */
    public async generatePersonalizedFlyer(
        platterSlugOrType: string,
        userName: string,
        userPhone: string,
    ): Promise<Buffer> {
        const isResidential = (platterSlugOrType || "").toLowerCase().includes("residential");

        const safeName = this.escapeXml(userName || "M3M Partner");
        const safePhone = this.escapeXml(userPhone || "");

        // Platter-specific configuration
        const config = isResidential
            ? {
                  brandProject: "THE CULLINAN",
                  projectType: "ULTRA-LUXURY SKY RESIDENCES & SKY MANSIONS",
                  locationRera: "SECTOR 94, NOIDA EXPRESSWAY | UP RERA: UPRERAPRJ442214",
                  paymentPlan: "40:60",
                  priceStarting: "Starting from ₹5.75 Cr*",
                  features:
                      "3, 4 & 5 BHK Sky Mansions • 1,00,000 sq.ft Clubhouse • 0-KM from South Delhi",
                  imagePath: "assets/properties/m3m-cullinan/elevation.jpg",
              }
            : {
                  brandProject: "THE LINE",
                  projectType: "PENTSUITES & LUXURY HIGH-STREET RETAIL",
                  locationRera: "SECTOR 72, CENTRAL NOIDA | UP RERA: UPRERAPRJ246070",
                  paymentPlan: "30:70",
                  priceStarting: "Starting from ₹85 Lacs*",
                  features:
                      "High-Street Retail • Food Court • Multiplex • Directly Opposite Metro Station",
                  imagePath: "assets/properties/m3m-the-line/commercial_arcade.jpg",
              };

        // Load and base64-encode building render
        let base64Image = "";
        try {
            let resolved = path.resolve(process.cwd(), config.imagePath);
            let buf = await fs.readFile(resolved).catch(async () => {
                // Fallback image search
                const fallback = isResidential
                    ? "assets/properties/m3m-cullinan/living_room.jpg"
                    : "assets/properties/m3m-the-line/elevation.jpg";
                return fs.readFile(path.resolve(process.cwd(), fallback));
            });

            const resized = await sharp(buf)
                .resize(940, 660, { fit: "cover", position: "center" })
                .jpeg({ quality: 88 })
                .toBuffer();

            base64Image = resized.toString("base64");
        } catch {
            base64Image = "";
        }

        const safeBrandProject = this.escapeXml(config.brandProject);
        const safeProjectType = this.escapeXml(config.projectType);
        const safeLocationRera = this.escapeXml(config.locationRera);
        const safePaymentPlan = this.escapeXml(config.paymentPlan);
        const safePriceStarting = this.escapeXml(config.priceStarting);
        const safeFeatures = this.escapeXml(config.features);

        // High-resolution 9:16 vertical SVG Canvas (1080 x 1920)
        const svg = `
      <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#140205" />
            <stop offset="25%" stop-color="#30070e" />
            <stop offset="60%" stop-color="#180307" />
            <stop offset="85%" stop-color="#0a0103" />
            <stop offset="100%" stop-color="#050102" />
          </linearGradient>

          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a" />
            <stop offset="35%" stop-color="#f59e0b" />
            <stop offset="70%" stop-color="#d97706" />
            <stop offset="100%" stop-color="#b45309" />
          </linearGradient>

          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#030712" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
          </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="1080" height="1920" fill="url(#bgGrad)" />

        <!-- Luxury Ornate Gold Border Frame -->
        <rect x="35" y="35" width="1010" height="1850" rx="40" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" opacity="0.85" />
        <rect x="47" y="47" width="986" height="1826" rx="32" fill="none" stroke="#d4af37" stroke-width="1" opacity="0.35" />

        <!-- Corner Flourish Accents -->
        <circle cx="50" cy="50" r="4" fill="#fbbf24" />
        <circle cx="1030" cy="50" r="4" fill="#fbbf24" />
        <circle cx="50" cy="1870" r="4" fill="#fbbf24" />
        <circle cx="1030" cy="1870" r="4" fill="#fbbf24" />

        <!-- Top Header: M3M Logo & UP RERA -->
        <g transform="translate(70, 75)">
          <text x="0" y="38" font-family="'Times New Roman', serif, Arial" font-size="44" font-weight="900" fill="url(#goldGrad)" letter-spacing="2">M3M</text>
          <text x="0" y="60" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#fde68a" letter-spacing="1">Our Expertise. Your Joy.</text>
        </g>

        <g transform="translate(1010, 80)">
          <text x="0" y="18" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#cbd5e1" text-anchor="end">${safeLocationRera}</text>
          <text x="0" y="36" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="#94a3b8" text-anchor="end">GOVT. APPROVED TITLE • UP RERA CERTIFIED</text>
        </g>

        <!-- Catchphrase -->
        <text x="540" y="240" font-family="'Times New Roman', serif" font-size="34" fill="#fde68a" text-anchor="middle" letter-spacing="1">
          This Festive Season
        </text>
        <text x="540" y="295" font-family="'Times New Roman', serif" font-size="46" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">
          Invest In A Finer Opportunity
        </text>

        <!-- Project Branding Logo -->
        <text x="540" y="380" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#f59e0b" text-anchor="middle" letter-spacing="6">
          &#8212; M3M &#8212;
        </text>
        <text x="540" y="440" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">
          ${safeBrandProject}
        </text>
        <text x="540" y="475" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#fde68a" text-anchor="middle" letter-spacing="4">
          ${safeProjectType}
        </text>

        <!-- Hero 3D Building Render Frame -->
        ${
            base64Image
                ? `
          <g>
            <rect x="70" y="520" width="940" height="660" rx="24" fill="#000000" />
            <image href="data:image/jpeg;base64,${base64Image}" x="70" y="520" width="940" height="660" rx="24" preserveAspectRatio="xMidYMid slice" />
            <rect x="70" y="520" width="940" height="660" rx="24" fill="none" stroke="url(#goldGrad)" stroke-width="2.5" opacity="0.8" />
          </g>
        `
                : `
          <rect x="70" y="520" width="940" height="660" rx="24" fill="#1e1b4b" opacity="0.8" stroke="url(#goldGrad)" stroke-width="2" />
          <text x="540" y="860" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="#fde68a" text-anchor="middle">
            ICONIC 3D ARCHITECTURAL VIEW
          </text>
        `
        }

        <!-- Promotional Festive Fortune Callout -->
        <g transform="translate(540, 1260)">
          <text x="0" y="0" font-family="'Times New Roman', serif" font-size="30" font-weight="bold" fill="#f59e0b" text-anchor="middle" letter-spacing="3">M3M</text>
          <text x="0" y="46" font-family="'Times New Roman', serif" font-size="52" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">FESTIVE FORTUNE</text>
          <text x="0" y="80" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#fde68a" text-anchor="middle" letter-spacing="1">&#10022; EXCLUSIVE LIMITED PERIOD BENEFIT &#10022;</text>
        </g>

        <!-- Payment Plan Section -->
        <line x1="220" y1="1390" x2="860" y2="1390" stroke="url(#goldGrad)" stroke-width="1.5" opacity="0.7" />

        <text x="540" y="1440" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="4">
          PAYMENT PLAN*
        </text>

        <text x="540" y="1540" font-family="Arial, Helvetica, sans-serif" font-size="94" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">
          ${safePaymentPlan}
        </text>

        <text x="540" y="1605" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#fbbf24" text-anchor="middle" letter-spacing="1">
          ${safePriceStarting}
        </text>

        <text x="540" y="1650" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#e2e8f0" text-anchor="middle" opacity="0.9">
          ${safeFeatures}
        </text>

        <line x1="220" y1="1685" x2="860" y2="1685" stroke="url(#goldGrad)" stroke-width="1.5" opacity="0.7" />

        <!-- Bottom Call-To-Action (User Request: ONLY show name and phone number) -->
        <rect x="70" y="1740" width="940" height="96" rx="20" fill="#030102" opacity="0.95" stroke="url(#goldGrad)" stroke-width="2" />
        
        <text x="540" y="1800" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">
          To know more, call <tspan fill="#f59e0b">${safeName}</tspan>: <tspan fill="#38bdf8">${safePhone}</tspan>
        </text>
      </svg>
    `;

        return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
    }

    /**
     * Watermarks a landscape / standard image (e.g. Floor Plans, Project Elevations)
     * showing ONLY the partner's name and phone number at the bottom.
     */
    public async watermarkImage(
        imagePath: string,
        userName: string,
        userPhone: string,
        firmName: string = "",
        reraNumber: string = "",
    ): Promise<Buffer> {
        const imageBuffer = await fs.readFile(imagePath);
        const metadata = await sharp(imageBuffer).metadata();
        const width = metadata.width || 1200;
        const height = metadata.height || 800;

        const bannerHeight = Math.max(70, Math.round(height * 0.11));
        const fontSizeTitle = Math.max(16, Math.round(bannerHeight * 0.36));

        const isGeneric =
            !userName ||
            userName.trim().toLowerCase() === "partner" ||
            userName.trim().toLowerCase() === "channel partner";
        const safeName = isGeneric ? "" : this.escapeXml(userName.trim());
        const safePhone = this.escapeXml(userPhone || "");

        const callText = safeName
            ? `To know more, call <tspan fill="#f59e0b">${safeName}</tspan>: <tspan fill="#38bdf8">${safePhone}</tspan>`
            : `To know more, call: <tspan fill="#38bdf8">${safePhone}</tspan>`;

        // SVG banner overlay: ONLY User Name and Mobile Number, no extra branding
        const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Bottom personalization banner: ONLY Name and Phone Number -->
        <g>
          <rect x="0" y="${height - bannerHeight}" width="${width}" height="${bannerHeight}" fill="#080204" opacity="0.94"/>
          <line x1="0" y1="${height - bannerHeight}" x2="${width}" y2="${height - bannerHeight}" stroke="#f59e0b" stroke-width="3" opacity="0.95"/>
          
          <text x="${width / 2}" y="${height - bannerHeight + Math.round(bannerHeight * 0.62)}" 
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${fontSizeTitle}" 
                font-weight="bold" 
                fill="#ffffff" 
                text-anchor="middle">
            ${callText}
          </text>
        </g>
      </svg>
    `;

        return sharp(imageBuffer)
            .composite([
                {
                    input: Buffer.from(svgOverlay),
                    top: 0,
                    left: 0,
                },
            ])
            .jpeg({ quality: 90 })
            .toBuffer();
    }

    /**
     * Injects personalized watermark header, footer and diagonal watermark on each page of a PDF,
     * cleanly featuring the partner name and phone number.
     */
    public async watermarkPdf(
        pdfPath: string,
        userName: string,
        userPhone: string,
        firmName: string = "",
        reraNumber: string = "",
    ): Promise<Buffer> {
        const existingPdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pages = pdfDoc.getPages();
        const dateStr = new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });

        const isGenericPdf =
            !userName ||
            userName.trim().toLowerCase() === "partner" ||
            userName.trim().toLowerCase() === "channel partner";
        const safePdfName = isGenericPdf ? "" : userName.replace(/[^\x20-\x7E]/g, "").trim();
        const safePdfPhone = (userPhone || "").replace(/[^\x20-\x7E]/g, "").trim();

        const displayClient = safePdfName
            ? `To know more, call ${safePdfName}: ${safePdfPhone}`
            : `To know more, call: ${safePdfPhone}`;
        const watermarkCenterText = safePdfName
            ? `${safePdfName.toUpperCase()} - ${safePdfPhone}`
            : safePdfPhone;

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
                opacity: 0.95,
            });

            page.drawText(`${displayClient}`, {
                x: 20,
                y: height - 19,
                size: 9.0,
                font: helveticaBold,
                color: rgb(0.22, 0.74, 0.97),
            });

            page.drawText(`DATE: ${dateStr}`, {
                x: width - 110,
                y: height - 19,
                size: 8.5,
                font: helvetica,
                color: rgb(1, 1, 1),
            });

            // 2. Prominent Client Allocation Box on Cover Page
            if (pageIndex === 0) {
                page.drawRectangle({
                    x: 40,
                    y: height - 180,
                    width: width - 80,
                    height: 44,
                    color: rgb(0.95, 0.97, 1),
                    borderColor: rgb(0.15, 0.55, 0.92),
                    borderWidth: 1.2,
                });

                page.drawText("OFFICIAL MARKETING COLLATERAL", {
                    x: 55,
                    y: height - 152,
                    size: 8.5,
                    font: helveticaBold,
                    color: rgb(0.12, 0.45, 0.8),
                });

                page.drawText(displayClient, {
                    x: 55,
                    y: height - 170,
                    size: 9.5,
                    font: helveticaBold,
                    color: rgb(0.08, 0.15, 0.28),
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
                opacity: 0.22,
                rotate: degrees(30),
            });

            // 4. Bottom Footer Security Bar
            page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: 22,
                color: rgb(0.06, 0.09, 0.16),
                opacity: 0.95,
            });

            page.drawText(
                `To know more, call ${safePdfName}: ${safePdfPhone} • Authorized M3M Noida Channel Partner`,
                {
                    x: 20,
                    y: 7,
                    size: 8.0,
                    font: helveticaBold,
                    color: rgb(0.9, 0.7, 0.2),
                },
            );

            page.drawText(`Page ${pageIndex + 1} of ${pages.length}`, {
                x: width - 75,
                y: 7,
                size: 8,
                font: helvetica,
                color: rgb(0.5, 0.6, 0.7),
            });
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return Buffer.from(modifiedPdfBytes);
    }

    private escapeXml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}

export const watermarkService = new WatermarkService();
