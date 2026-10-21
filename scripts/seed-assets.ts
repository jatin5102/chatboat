import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

async function createSamplePdf(
  filePath: string,
  projectName: string,
  location: string,
  specs: string[]
) {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Page 1: Cover & Specs
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Header Box
  page1.drawRectangle({
    x: 40,
    y: height - 140,
    width: width - 80,
    height: 90,
    color: rgb(0.08, 0.15, 0.28)
  });

  page1.drawText(projectName.toUpperCase(), {
    x: 60,
    y: height - 90,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  page1.drawText(`Location: ${location}`, {
    x: 60,
    y: height - 118,
    size: 13,
    font: fontRegular,
    color: rgb(0.35, 0.75, 0.98)
  });

  // Body content
  page1.drawText('PROJECT OVERVIEW & SPECIFICATIONS', {
    x: 40,
    y: height - 180,
    size: 15,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  let curY = height - 215;
  specs.forEach((spec) => {
    page1.drawCircle({
      x: 50,
      y: curY + 4,
      size: 3.5,
      color: rgb(0.12, 0.53, 0.9)
    });

    page1.drawText(spec, {
      x: 65,
      y: curY,
      size: 12,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2)
    });
    curY -= 30;
  });

  // Footer info box
  page1.drawRectangle({
    x: 40,
    y: 50,
    width: width - 80,
    height: 45,
    color: rgb(0.94, 0.96, 0.98)
  });

  page1.drawText('Government RERA Approved & Bank Pre-Approved Project', {
    x: 60,
    y: 74,
    size: 11,
    font: fontBold,
    color: rgb(0.15, 0.25, 0.35)
  });

  page1.drawText('All approvals and title clearances available for verification upon request.', {
    x: 60,
    y: 58,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.5)
  });

  const pdfBytes = await pdfDoc.save();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, pdfBytes);
  console.log(`Created sample PDF: ${filePath}`);
}

async function createSampleImage(
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
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      
      <!-- Architectural blueprint grid effect -->
      <g stroke="#ffffff" stroke-width="0.75" opacity="0.12">
        <line x1="0" y1="200" x2="1200" y2="200" />
        <line x1="0" y1="400" x2="1200" y2="400" />
        <line x1="0" y1="600" x2="1200" y2="600" />
        <line x1="300" y1="0" x2="300" y2="800" />
        <line x1="600" y1="0" x2="600" y2="800" />
        <line x1="900" y1="0" x2="900" y2="800" />
      </g>

      <!-- Center Card -->
      <rect x="150" y="220" width="900" height="340" rx="20" fill="#000000" opacity="0.45" />

      <text x="600" y="340" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="bold" fill="#ffffff" text-anchor="middle">
        ${title.replace(/&/g, '&amp;')}
      </text>

      <text x="600" y="420" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#e2e8f0" text-anchor="middle">
        ${subtitle.replace(/&/g, '&amp;')}
      </text>

      <text x="600" y="480" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#93c5fd" text-anchor="middle">
        High-Resolution Architectural 3D Rendering &#8226; Official Media
      </text>
    </svg>
  `;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toFile(filePath);
  console.log(`Created sample image: ${filePath}`);
}

async function main() {
  console.log('Seeding sample brochures and images for real estate properties...');

  // Skyline
  await createSamplePdf(
    'assets/properties/skyline/brochure.pdf',
    'Skyline Heights Luxury Towers',
    'Sector 62, Golf Course Ext Road, Gurgaon',
    [
      'Ultra Luxury 3 & 4 BHK Residences with 11-foot clear ceiling height',
      'Italian Statuario Marble Flooring across Living & Dining spaces',
      'Fully equipped German Modular Kitchen with Siemens / Bosch fittings',
      'Clubhouse with Infinity Heated Pool, Squash Courts & 40-seater Cinema',
      '70% Open Landscaped Green Area certified with IGBC Platinum rating',
      'Complete 100% Power Backup with High-Speed Mitsubishi Elevators'
    ]
  );

  await createSampleImage(
    'assets/properties/skyline/elevation.jpg',
    'SKYLINE HEIGHTS',
    'Iconic Architectural Elevation & Grand Arrival Portico',
    '#1e293b',
    '#0f172a'
  );

  await createSampleImage(
    'assets/properties/skyline/living_room.jpg',
    'LUXURY LIVING SUITE',
    'Panoramic Balcony Deck & Designer Living Area',
    '#1e3a5f',
    '#0b1e36'
  );

  await createSampleImage(
    'assets/properties/skyline/master_bedroom.jpg',
    'PRESIDENTIAL MASTER SUITE',
    'Hardwood Flooring, Walk-in Wardrobe & Ensuite Bathroom',
    '#2d3748',
    '#1a202c'
  );

  // Green Valley
  await createSamplePdf(
    'assets/properties/greenvalley/brochure.pdf',
    'Green Valley Elite Forest Villas',
    'Whitefield - Sarjapur Link Road, Bangalore',
    [
      'Exclusive 4 & 5 BHK Independent Forest Villas on 3200 - 5500 sq.ft plots',
      'Private Temperature-Controlled Plunge Pool & Terrace Sky Lounge',
      'Private 2-Car Covered Portico & EV Charging Ready Station',
      'Dense 25-Acre Miyawaki Urban Forest with 2.5km Jogging & Nature Trail',
      'Rooftop Solar PV Installation generating up to 5 kW green energy',
      'Comprehensive 5-Tier Biometric & Perimeter Security System'
    ]
  );

  await createSampleImage(
    'assets/properties/greenvalley/villa_front.jpg',
    'GREEN VALLEY VILLAS',
    'Independent Biophilic Villa Front Façade & Landscaped Garden',
    '#14532d',
    '#052e16'
  );

  await createSampleImage(
    'assets/properties/greenvalley/villa_interior.jpg',
    'GRAND DOUBLE-HEIGHT VILLA INTERIOR',
    'Floor-to-Ceiling Glazing with Direct Pool Deck Access',
    '#1c4e80',
    '#0b2545'
  );

  console.log('✅ All sample properties, PDFs, and images seeded successfully!');
}

main().catch((err) => {
  console.error('Error seeding assets:', err);
  process.exit(1);
});
