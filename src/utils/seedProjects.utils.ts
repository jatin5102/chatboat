import { prisma } from "../config/prisma.config.js";
import path from "node:path";
import fs from "node:fs/promises";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { collateralService } from "../services/collateral.service.js";

async function ensureFileExists(
  filePath: string,
  createFn: () => Promise<void>
) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await createFn();
  }
}

async function createBrochurePdf(
  filePath: string,
  projectName: string,
  location: string,
  reraNo: string,
  highlights: string[]
) {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Header Banner
  page.drawRectangle({
    x: 30,
    y: height - 130,
    width: width - 60,
    height: 90,
    color: rgb(0.06, 0.12, 0.22),
  });

  page.drawText(projectName.toUpperCase(), {
    x: 50,
    y: height - 85,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Location: ${location} | RERA: ${reraNo}`, {
    x: 50,
    y: height - 110,
    size: 11,
    font: fontRegular,
    color: rgb(0.22, 0.74, 0.97),
  });

  // Project highlights
  page.drawText("EXECUTIVE PROJECT OVERVIEW & SPECIFICATIONS", {
    x: 35,
    y: height - 170,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  let curY = height - 205;
  highlights.forEach((h) => {
    page.drawCircle({
      x: 45,
      y: curY + 3,
      size: 3,
      color: rgb(0.2, 0.6, 0.9),
    });
    page.drawText(h, {
      x: 58,
      y: curY,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3),
    });
    curY -= 28;
  });

  // Footer box
  page.drawRectangle({
    x: 30,
    y: 40,
    width: width - 60,
    height: 45,
    color: rgb(0.93, 0.96, 0.99),
  });

  page.drawText("Official M3M Noida Channel Partner Collateral Desk", {
    x: 45,
    y: 65,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.35),
  });

  page.drawText("All collaterals are UP RERA compliant. For sales & commission enquiries contact the broker desk.", {
    x: 45,
    y: 50,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.35, 0.45, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, pdfBytes);
}

async function createProjectImage(
  filePath: string,
  title: string,
  subtitle: string,
  color1: string,
  color2: string
) {
  const width = 1200;
  const height = 800;

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
      
      <g stroke="#ffffff" stroke-width="0.8" opacity="0.15">
        <line x1="0" y1="200" x2="1200" y2="200" />
        <line x1="0" y1="400" x2="1200" y2="400" />
        <line x1="0" y1="600" x2="1200" y2="600" />
        <line x1="300" y1="0" x2="300" y2="800" />
        <line x1="600" y1="0" x2="600" y2="800" />
        <line x1="900" y1="0" x2="900" y2="800" />
      </g>

      <rect x="120" y="220" width="960" height="340" rx="20" fill="#030712" opacity="0.55" />

      <text x="600" y="330" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="bold" fill="#ffffff" text-anchor="middle">
        ${title.replace(/&/g, '&amp;')}
      </text>

      <text x="600" y="405" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#93c5fd" text-anchor="middle">
        ${subtitle.replace(/&/g, '&amp;')}
      </text>

      <text x="600" y="475" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#e2e8f0" text-anchor="middle">
        M3M Noida Official Marketing Creative &amp;#8226; 3D Architectural View
      </text>
    </svg>
  `;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(filePath);
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
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2a4768" stroke-width="0.8"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect width="100%" height="100%" fill="url(#grid)" />

      <!-- Architectural layout blueprint outlines -->
      <rect x="150" y="120" width="900" height="520" fill="none" stroke="#60a5fa" stroke-width="3" rx="10"/>
      <rect x="180" y="150" width="380" height="260" fill="#1e3a8a" fill-opacity="0.3" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4,4"/>
      <rect x="580" y="150" width="440" height="260" fill="#1e3a8a" fill-opacity="0.3" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4,4"/>
      <rect x="180" y="430" width="400" height="180" fill="#1e3a8a" fill-opacity="0.3" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4,4"/>
      <rect x="600" y="430" width="420" height="180" fill="#1e3a8a" fill-opacity="0.3" stroke="#93c5fd" stroke-width="1.5" stroke-dasharray="4,4"/>

      <!-- Blueprint text labels -->
      <text x="370" y="275" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">MASTER SUITE / ZONE A</text>
      <text x="370" y="305" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#93c5fd" text-anchor="middle">24'0" x 16'6" • Clear Heights 11.5ft</text>

      <text x="800" y="275" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">EXPANSIVE LIVING &amp; DINING / ZONE B</text>
      <text x="800" y="305" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#93c5fd" text-anchor="middle">32'0" x 20'0" • Wrap-around Balcony</text>

      <text x="380" y="525" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">MODULAR KITCHEN &amp; SERVICE DECK</text>
      <text x="810" y="525" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">GUEST SUITES &amp; POWDER ROOM</text>

      <!-- Header & Footer -->
      <rect x="0" y="0" width="1200" height="75" fill="#030712" opacity="0.8"/>
      <text x="50" y="48" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" fill="#f8fafc">
        ${projectName.toUpperCase().replace(/&/g, '&amp;')} — ${layoutTitle.toUpperCase().replace(/&/g, '&amp;')}
      </text>

      <rect x="0" y="735" width="1200" height="65" fill="#030712" opacity="0.85"/>
      <text x="50" y="773" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#38bdf8">
        OFFICIAL ARCHITECTURAL UNIT LAYOUT &amp; FLOOR PLAN SPECIFICATION
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

  // Header Banner
  page.drawRectangle({
    x: 30,
    y: height - 130,
    width: width - 60,
    height: 90,
    color: rgb(0.08, 0.15, 0.28),
  });

  page.drawText(`INVESTMENT OPPORTUNITY DOCUMENT (OPP DOC)`, {
    x: 50,
    y: height - 70,
    size: 14,
    font: fontBold,
    color: rgb(0.22, 0.74, 0.97),
  });

  page.drawText(`${projectName.toUpperCase()} - ${category.toUpperCase()}`, {
    x: 50,
    y: height - 98,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("EXECUTIVE COMMERCIAL & WEALTH OPPORTUNITY", {
    x: 40,
    y: height - 165,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.35),
  });

  let curY = height - 200;
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
    curY -= 30;
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

export async function seedProperties() {
  console.log("🌱 Seeding M3M Noida Platters, Projects, Channel Partners & FAQs...");

  // 1. Ensure Sample Files on Disk
  const cullinanBrochure = "assets/properties/m3m-cullinan/brochure.pdf";
  const cullinanElevation = "assets/properties/m3m-cullinan/elevation.jpg";
  const cullinanRetail = "assets/properties/m3m-cullinan/retail_avenue.jpg";
  const cullinanFloorPlan = "assets/properties/m3m-cullinan/floor_plan.jpg";
  const cullinanOppDoc = "assets/properties/m3m-cullinan/opp_doc.pdf";

  const lineBrochure = "assets/properties/m3m-the-line/brochure.pdf";
  const lineElevation = "assets/properties/m3m-the-line/elevation.jpg";
  const lineCommercial = "assets/properties/m3m-the-line/commercial_arcade.jpg";
  const lineFloorPlan = "assets/properties/m3m-the-line/floor_plan.jpg";
  const lineOppDoc = "assets/properties/m3m-the-line/opp_doc.pdf";

  await ensureFileExists(cullinanBrochure, () =>
    createBrochurePdf(
      cullinanBrochure,
      "M3M The Cullinan",
      "Sector 94, Noida Expressway",
      "UPRERAPRJ442214",
      [
        "12.8 Acre Ultra-Luxury Mixed-Use Landmark on Noida Expressway",
        "Iconic 3, 4 & 5 BHK Sky Residences with 1000+ sq.ft Balcony Decks",
        "Over 1,00,000 sq.ft Magnificent Clubhouse & 7 Swimming Pools",
        "Direct 0-KM connectivity to South Delhi via Kalindi Kunj",
        "Bespoke High-Street Luxury Retail & Fine Dining Promenade",
      ]
    )
  );

  await ensureFileExists(cullinanElevation, () =>
    createProjectImage(
      cullinanElevation,
      "M3M THE CULLINAN - SECTOR 94",
      "Iconic Twin Towers & Ultra-Luxury Sky Residences",
      "#0f172a",
      "#1e3a8a"
    )
  );

  await ensureFileExists(cullinanRetail, () =>
    createProjectImage(
      cullinanRetail,
      "THE CULLINAN AVENUE",
      "World-Class High-Street Retail & Open-Air Plaza",
      "#1e293b",
      "#3b82f6"
    )
  );

  await ensureFileExists(cullinanFloorPlan, () =>
    createFloorPlanImage(
      cullinanFloorPlan,
      "M3M The Cullinan",
      "4 BHK Sky Mansion Master Layout"
    )
  );

  await ensureFileExists(cullinanOppDoc, () =>
    createOppDocPdf(
      cullinanOppDoc,
      "M3M The Cullinan",
      "Residential Sky Residences",
      [
        "Prime Sector 94 Noida Expressway landmark, 0-KM from South Delhi",
        "High capital appreciation corridor with proven 18-22% annual growth",
        "Exclusive 40:60 payment scheme with high net-worth tenancy demand",
        "Private plunge pools, concierge desk and helipad access",
      ]
    )
  );

  await ensureFileExists(lineBrochure, () =>
    createBrochurePdf(
      lineBrochure,
      "M3M The Line",
      "Sector 72, Central Noida",
      "UPRERAPRJ246070",
      [
        "Prime Sector 72 Central Noida location opposite Metro Station",
        "Designer Studio Suites & Serviced Residences with high rental yield",
        "Double-Height High-Street Commercial Retail arcade on Ground & First floor",
        "Grand central atrium with experiential shopping & multiplex",
        "100% Power backup, high-speed elevators & EV charging",
      ]
    )
  );

  await ensureFileExists(lineElevation, () =>
    createProjectImage(
      lineElevation,
      "M3M THE LINE - SECTOR 72",
      "Contemporary Architectural Marvel & Mixed-Use Boulevard",
      "#14532d",
      "#064e3b"
    )
  );

  await ensureFileExists(lineCommercial, () =>
    createProjectImage(
      lineCommercial,
      "THE LINE COMMERCIAL HUB",
      "Double-Height Retail Shops & Gourmet Dining Plaza",
      "#1c1917",
      "#78350f"
    )
  );

  await ensureFileExists(lineFloorPlan, () =>
    createFloorPlanImage(
      lineFloorPlan,
      "M3M The Line",
      "High-Street Commercial Retail & Studio Layout"
    )
  );

  await ensureFileExists(lineOppDoc, () =>
    createOppDocPdf(
      lineOppDoc,
      "M3M The Line",
      "Commercial High Street & Studio Suites",
      [
        "Situated directly opposite Sector 72 Central Noida Metro Station",
        "Guaranteed footfalls from 50,000+ residential families in 2KM radius",
        "Pre-leased retail units with 8.5% initial lease guarantee yield",
        "Flexible 40:60 payment structure starting from ₹85 Lacs*",
      ]
    )
  );

  // 2. Seed Platters (Residential & Commercial)
  let residentialPlatter = await prisma.platter.findUnique({
    where: { slug: "residential-projects" },
  });
  if (!residentialPlatter) {
    residentialPlatter = await prisma.platter.create({
      data: {
        slug: "residential-projects",
        name: "Residential Projects",
        tagline: "Ultra-Luxury Sky Mansions & Designer Studio Suites in Noida",
        description:
          "Exclusive M3M residential developments featuring bespoke architecture, private plunge decks, panoramic views, and clubhouse lifestyle.",
        seq: 1,
        status: true,
      },
    });
  }

  let commercialPlatter = await prisma.platter.findUnique({
    where: { slug: "commercial-projects" },
  });
  if (!commercialPlatter) {
    commercialPlatter = await prisma.platter.create({
      data: {
        slug: "commercial-projects",
        name: "Commercial Projects",
        tagline: "High-Street Retail, Anchor Stores & Grade-A Commercial Spaces",
        description:
          "Premier commercial hubs at Noida Expressway and Central Noida with guaranteed footfalls, international dining and high capital appreciation.",
        seq: 2,
        status: true,
      },
    });
  }

  // 3. Seed Projects on Platters
  // Project 1: M3M The Cullinan (Residential)
  const cullinanSlug = "m3m-the-cullinan-residential";
  let p1 = await prisma.projects.findUnique({ where: { slug: cullinanSlug } });
  if (!p1) {
    p1 = await prisma.projects.create({
      data: {
        slug: cullinanSlug,
        projectName: "M3M The Cullinan",
        platterId: residentialPlatter.id,
        location: "Sector 94, Noida Expressway",
        shortDescription:
          "Noida's most iconic 12.8-acre ultra-luxury mixed-use development featuring 3, 4 & 5 BHK sky mansions with private elevators and 100,000 sq.ft clubhouse.",
        tagline: "3, 4 & 5 BHK Ultra-Luxury Sky Residences",
        priceRange: "₹5.75 Cr - ₹16.50 Cr",
        price: 57500000,
        brochure: cullinanBrochure,
        hasDocuments: true,
        status: true,
        seq: 1,
      },
    });

    await prisma.projectRera.create({
      data: {
        projectId: p1.id,
        reraNumber: "UPRERAPRJ442214",
        phase: "Phase 1 & 2",
      },
    });
  }

  // Project 2: M3M The Line (Residential Studio Suites)
  const lineSlug = "m3m-the-line-residential";
  let p2 = await prisma.projects.findUnique({ where: { slug: lineSlug } });
  if (!p2) {
    p2 = await prisma.projects.create({
      data: {
        slug: lineSlug,
        projectName: "M3M The Line (Residences)",
        platterId: residentialPlatter.id,
        location: "Sector 72, Central Noida",
        shortDescription:
          "Contemporary luxury studio suites and serviced apartments situated right in the heart of Sector 72 Noida with high rental returns.",
        tagline: "Luxury Studio Suites & Serviced Apartments",
        priceRange: "₹1.15 Cr - ₹2.50 Cr",
        price: 11500000,
        brochure: lineBrochure,
        hasDocuments: true,
        status: true,
        seq: 2,
      },
    });

    await prisma.projectRera.create({
      data: {
        projectId: p2.id,
        reraNumber: "UPRERAPRJ246070",
        phase: "Phase 1",
      },
    });
  }

  // Project 3: The Cullinan Avenue (Commercial)
  const cullinanCommercialSlug = "m3m-the-cullinan-avenue-commercial";
  let p3 = await prisma.projects.findUnique({ where: { slug: cullinanCommercialSlug } });
  if (!p3) {
    p3 = await prisma.projects.create({
      data: {
        slug: cullinanCommercialSlug,
        projectName: "M3M The Cullinan Avenue",
        platterId: commercialPlatter.id,
        location: "Sector 94, Noida Expressway",
        shortDescription:
          "Prime high-street luxury retail, multi-cuisine open terraces, anchor spaces and entertainment zones at Noida's grandest mixed-use avenue.",
        tagline: "High-Street Luxury Retail & Gourmet Dining Boulevard",
        priceRange: "₹1.85 Cr - ₹12.00 Cr",
        price: 18500000,
        brochure: cullinanBrochure,
        hasDocuments: true,
        status: true,
        seq: 1,
      },
    });

    await prisma.projectRera.create({
      data: {
        projectId: p3.id,
        reraNumber: "UPRERAPRJ442214",
        phase: "Commercial Arcade",
      },
    });
  }

  // Project 4: M3M The Line Commercial (Commercial)
  const lineCommercialSlug = "m3m-the-line-commercial";
  let p4 = await prisma.projects.findUnique({ where: { slug: lineCommercialSlug } });
  if (!p4) {
    p4 = await prisma.projects.create({
      data: {
        slug: lineCommercialSlug,
        projectName: "M3M The Line Commercial",
        platterId: commercialPlatter.id,
        location: "Sector 72, Central Noida",
        shortDescription:
          "Double-height high-street retail shops, multiplex, food courts, and anchor spaces with massive 360-degree frontage in Sector 72 Noida.",
        tagline: "Double-Height Retail Shops & Multiplex Hub",
        priceRange: "₹95 Lacs - ₹5.50 Cr",
        price: 9500000,
        brochure: lineBrochure,
        hasDocuments: true,
        status: true,
        seq: 2,
      },
    });

    await prisma.projectRera.create({
      data: {
        projectId: p4.id,
        reraNumber: "UPRERAPRJ246070",
        phase: "Commercial Wing",
      },
    });
  }

  // 4. Seed Channel Partners
  const cpCount = await prisma.channelPartner.count();
  if (cpCount === 0) {
    await prisma.channelPartner.createMany({
      data: [
        {
          fullName: "Rajesh Sharma",
          firmName: "Apex Noida Realty Advisors",
          reraNumber: "UPRERAAGT10482",
          mobileNo: "919876543210",
          location: "Sector 18, Noida",
          emailAddress: "rajesh@apexrealty.com",
          status: true,
        },
        {
          fullName: "Pooja Verma",
          firmName: "PropAdvisor Capital NCR",
          reraNumber: "UPRERAAGT20914",
          mobileNo: "919812345678",
          location: "Sector 62, Noida",
          emailAddress: "pooja@propadvisor.in",
          status: true,
        },
      ],
    });
  }

  // 5. Seed Dynamic FAQs for M3M Noida Bot
  const faqCount = await prisma.faq.count();
  if (faqCount === 0) {
    await prisma.faq.createMany({
      data: [
        {
          question: "What is M3M The Cullinan in Sector 94 Noida?",
          answer:
            "M3M The Cullinan is Noida's premier 12.8-acre mixed-use luxury development at Sector 94 directly on the Noida-Greater Noida Expressway (0-KM from South Delhi via Kalindi Kunj). It features ultra-luxury 3, 4 & 5 BHK sky residences, a 1,00,000 sq.ft clubhouse, and world-class retail high street.",
          category: "Residential",
          keywords: "cullinan, sector 94, expressway, 3bhk, 4bhk, 5bhk, luxury",
          seq: 1,
          status: true,
        },
        {
          question: "Where are M3M Commercial Projects located in Noida?",
          answer:
            "M3M Noida commercial projects are strategically located at Sector 94 (The Cullinan Avenue - right next to Okhla Bird Sanctuary Metro) and Sector 72 (The Line Commercial - double-height retail and food courts opposite Central Noida Metro Station).",
          category: "Commercial",
          keywords: "commercial, retail, shop, sector 72, sector 94, the line, food court",
          seq: 2,
          status: true,
        },
        {
          question: "How do Channel Partners receive personalized marketing collaterals?",
          answer:
            "Once you enter your Name, Company/Firm Name, and RERA Registration Number in this chatbot, our automated AI engine instantly renders personalized PDF brochures, high-res architectural 3D images, and factsheets watermarked with your firm details.",
          category: "Channel Partner",
          keywords: "collateral, marketing, watermark, creative, brochure, pdf, partner",
          seq: 3,
          status: true,
        },
        {
          question: "What are the RERA numbers for M3M Noida developments?",
          answer:
            "M3M The Cullinan (Sector 94) RERA Registration: UPRERAPRJ442214. M3M The Line (Sector 72) RERA Registration: UPRERAPRJ246070. All projects are 100% UP RERA approved and title-clear.",
          category: "General",
          keywords: "rera, registration, approved, uprera, legal, title",
          seq: 4,
          status: true,
        },
        {
          question: "What are the starting prices and payment plans available?",
          answer:
            "Residential: M3M The Line Studio Suites start from ₹1.15 Cr*, while The Cullinan Luxury Sky Mansions start from ₹5.75 Cr*. Commercial: Retail shops start from ₹95 Lacs* at Sector 72. Flexible construction-linked (CLP) and 30:40:30 possession-linked plans are available.",
          category: "General",
          keywords: "price, cost, payment plan, installment, clp, starting price",
          seq: 5,
          status: true,
        },
      ],
    });
  }

  // 6. Ensure Each Platter Has Its Own Collaterals (Story, EDM, Video, Brochure, Floor Plans, Opp Doc)
  const allPlatters = await prisma.platter.findMany();
  for (const plt of allPlatters) {
    await collateralService.ensurePlatterCollaterals(plt.id);
  }

  // 7. Ensure Default Project Collaterals
  const allProjects = await prisma.projects.findMany();
  for (const proj of allProjects) {
    await collateralService.ensureProjectCollaterals(proj.id);
  }

  console.log("✅ Seeded M3M Noida Platters, Collaterals, Projects, Documents, Channel Partners & FAQs successfully!");
}
