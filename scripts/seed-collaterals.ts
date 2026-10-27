import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../src/config/prisma.config.js";
import { DEFAULT_COLLATERALS, collateralService } from "../src/services/collateral.service.js";

async function ensureFile(filePath: string, creator: () => Promise<void>) {
  try {
    await fs.access(filePath);
    console.log(`✓ Exists: ${filePath}`);
  } catch {
    console.log(`Creating: ${filePath}`);
    await creator();
    console.log(`✓ Created: ${filePath}`);
  }
}

async function createFloorPlanImage(
  filePath: string,
  projectName: string,
  layoutTitle: string
) {
  const width = 1200;
  const height = 800;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0b192c;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1e3e62;stop-opacity:1" />
        </linearGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2563eb" stroke-width="0.7" opacity="0.3"/>
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect width="100%" height="100%" fill="url(#grid)" />

      <!-- Outer Floor Plan Blueprint Box -->
      <rect x="100" y="90" width="1000" height="620" rx="14" fill="#030712" opacity="0.8" stroke="#38bdf8" stroke-width="2.5" />

      <!-- Blueprint Rooms / Partitions -->
      <g stroke="#38bdf8" stroke-width="2" fill="none" opacity="0.85">
        <!-- Living Room -->
        <rect x="150" y="140" width="380" height="260" stroke-dasharray="4 2" />
        <text x="340" y="275" font-family="Arial" font-size="20" font-weight="bold" fill="#7dd3fc" text-anchor="middle">GRAND LIVING &amp; DINING</text>
        <text x="340" y="305" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">24' 6" x 18' 0"</text>

        <!-- Master Suite -->
        <rect x="560" y="140" width="320" height="260" />
        <text x="720" y="275" font-family="Arial" font-size="19" font-weight="bold" fill="#7dd3fc" text-anchor="middle">MASTER SUITE</text>
        <text x="720" y="305" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">16' 0" x 14' 0"</text>

        <!-- Walk-in Wardrobe & Bath -->
        <rect x="900" y="140" width="160" height="260" />
        <text x="980" y="275" font-family="Arial" font-size="15" font-weight="bold" fill="#7dd3fc" text-anchor="middle">EN-SUITE</text>

        <!-- Kitchen & Utility -->
        <rect x="150" y="420" width="260" height="240" />
        <text x="280" y="545" font-family="Arial" font-size="18" font-weight="bold" fill="#7dd3fc" text-anchor="middle">MODULAR KITCHEN</text>
        <text x="280" y="575" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">14' 0" x 10' 6"</text>

        <!-- Guest Bedroom -->
        <rect x="430" y="420" width="290" height="240" />
        <text x="575" y="545" font-family="Arial" font-size="18" font-weight="bold" fill="#7dd3fc" text-anchor="middle">BEDROOM 2</text>
        <text x="575" y="575" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">13' 0" x 12' 0"</text>

        <!-- Deck / Terrace -->
        <rect x="740" y="420" width="320" height="240" stroke-dasharray="6 3" />
        <text x="900" y="545" font-family="Arial" font-size="18" font-weight="bold" fill="#facc15" text-anchor="middle">EXPANSIVE SKY DECK</text>
        <text x="900" y="575" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">Panoramic Expressway View</text>
      </g>

      <!-- Header Title Box -->
      <rect x="100" y="30" width="1000" height="50" rx="8" fill="#1e293b" opacity="0.95" />
      <text x="130" y="62" font-family="Arial" font-size="22" font-weight="bold" fill="#ffffff">
        ${projectName.toUpperCase().replace(/&/g, '&amp;')} &#8212; ${layoutTitle.toUpperCase().replace(/&/g, '&amp;')}
      </text>
      <text x="1070" y="62" font-family="Arial" font-size="15" font-weight="bold" fill="#38bdf8" text-anchor="end">
        UP RERA APPROVED ARCHITECTURAL LAYOUT
      </text>
    </svg>
  `;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(filePath);
}

async function createOppDocPdf(
  filePath: string,
  projectName: string,
  category: string,
  highlights: string[]
) {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // Header banner
  page.drawRectangle({
    x: 30,
    y: height - 120,
    width: width - 60,
    height: 90,
    color: rgb(0.08, 0.15, 0.28),
  });

  page.drawText(`INVESTMENT OPPORTUNITY DOCUMENT (OPP DOC)`, {
    x: 50,
    y: height - 60,
    size: 13,
    font: fontBold,
    color: rgb(0.22, 0.74, 0.97),
  });

  page.drawText(`${projectName.toUpperCase()} - ${category.toUpperCase()}`, {
    x: 50,
    y: height - 90,
    size: 17,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("EXECUTIVE COMMERCIAL & WEALTH OPPORTUNITY", {
    x: 40,
    y: height - 160,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.35),
  });

  let curY = height - 195;
  highlights.forEach((h) => {
    page.drawCircle({
      x: 50,
      y: curY + 3,
      size: 3.5,
      color: rgb(0.15, 0.55, 0.9),
    });
    page.drawText(h, {
      x: 65,
      y: curY,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3),
    });
    curY -= 28;
  });

  page.drawRectangle({
    x: 30,
    y: 40,
    width: width - 60,
    height: 50,
    color: rgb(0.92, 0.96, 1),
  });

  page.drawText("Exclusive Channel Partner Investment Memorandum", {
    x: 45,
    y: 70,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.35),
  });

  page.drawText("Confidential & Proprietary. Pricing, terms and inventory subject to official allotment.", {
    x: 45,
    y: 54,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.35, 0.45, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, pdfBytes);
}

async function run() {
  console.log("🚀 Ensuring all collateral assets exist on disk...");

  const cullinanFloorPlan = "assets/properties/m3m-cullinan/floor_plan.jpg";
  const cullinanOppDoc = "assets/properties/m3m-cullinan/opp_doc.pdf";
  const lineFloorPlan = "assets/properties/m3m-the-line/floor_plan.jpg";
  const lineOppDoc = "assets/properties/m3m-the-line/opp_doc.pdf";

  await ensureFile(cullinanFloorPlan, () =>
    createFloorPlanImage(cullinanFloorPlan, "M3M The Cullinan", "4 BHK Sky Mansion Master Layout")
  );

  await ensureFile(cullinanOppDoc, () =>
    createOppDocPdf(cullinanOppDoc, "M3M The Cullinan", "Residential Sky Residences", [
      "Prime Sector 94 Noida Expressway landmark, 0-KM from South Delhi",
      "High capital appreciation corridor with proven 18-22% annual growth",
      "Exclusive 40:60 payment scheme with high net-worth tenancy demand",
      "Private plunge pools, concierge desk and helipad access",
    ])
  );

  await ensureFile(lineFloorPlan, () =>
    createFloorPlanImage(lineFloorPlan, "M3M The Line", "High-Street Commercial Retail & Studio Layout")
  );

  await ensureFile(lineOppDoc, () =>
    createOppDocPdf(lineOppDoc, "M3M The Line", "Commercial High Street & Suites", [
      "Prime Sector 72 Central Noida location opposite Metro Station",
      "High footfall double-height retail shops & gourmet dining arcade",
      "Guaranteed lease-back and attractive return on investment options",
      "100% UP RERA approved with modern multi-level parking",
    ])
  );

  console.log("🔄 Updating database collaterals with fileUrl paths...");

  const platters = await prisma.platter.findMany();
  for (const platter of platters) {
    const isResidential = platter.slug.includes("residential");

    for (const item of DEFAULT_COLLATERALS) {
      const fileUrl = isResidential
        ? item.code === "STORY"
          ? "assets/properties/m3m-cullinan/elevation.jpg"
          : item.code === "EDM"
          ? "assets/properties/m3m-cullinan/elevation.jpg"
          : item.code === "BROCHURE"
          ? "assets/properties/m3m-cullinan/brochure.pdf"
          : item.code === "FLOOR_PLANS"
          ? "assets/properties/m3m-cullinan/floor_plan.jpg"
          : item.code === "OPP_DOC"
          ? "assets/properties/m3m-cullinan/opp_doc.pdf"
          : null
        : item.code === "STORY"
        ? "assets/properties/m3m-the-line/commercial_arcade.jpg"
        : item.code === "EDM"
        ? "assets/properties/m3m-the-line/commercial_arcade.jpg"
        : item.code === "BROCHURE"
        ? "assets/properties/m3m-the-line/brochure.pdf"
        : item.code === "FLOOR_PLANS"
        ? "assets/properties/m3m-the-line/floor_plan.jpg"
        : item.code === "OPP_DOC"
        ? "assets/properties/m3m-the-line/opp_doc.pdf"
        : null;

      const existing = await prisma.projectCollateral.findFirst({
        where: {
          platterId: platter.id,
          code: item.code,
        },
      });

      if (!existing) {
        await prisma.projectCollateral.create({
          data: {
            platterId: platter.id,
            code: item.code,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            fileType: item.fileType,
            fileUrl,
            seq: item.seq,
            status: true,
          },
        });
        console.log(`Created collateral ${item.code} for platter ${platter.name}`);
      } else {
        await prisma.projectCollateral.update({
          where: { id: existing.id },
          data: {
            fileUrl,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            status: true,
            seq: item.seq,
          },
        });
        console.log(`Updated collateral ${item.code} for platter ${platter.name} with fileUrl: ${fileUrl}`);
      }
    }
  }

  console.log("✨ All collaterals seeded and verified successfully!");
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
