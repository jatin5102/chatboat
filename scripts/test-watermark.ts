import fs from 'node:fs/promises';
import { watermarkService } from '../src/services/watermark.service.js';

async function testWatermarking() {
  console.log('Testing image and PDF dynamic watermarking...');

  const testName = 'Rajesh Kumar';
  const testPhone = '+91 98765 43210';

  // 1. Test Image Watermarking
  const inputImage = 'assets/properties/skyline/elevation.jpg';
  const outputImage = 'assets/temp/test_watermarked_elevation.jpg';

  console.log(`Watermarking image: ${inputImage}...`);
  const imageBuffer = await watermarkService.watermarkImage(inputImage, testName, testPhone);
  await fs.writeFile(outputImage, imageBuffer);
  console.log(`✅ Watermarked image saved to: ${outputImage} (${imageBuffer.length} bytes)`);

  // 2. Test PDF Watermarking
  const inputPdf = 'assets/properties/skyline/brochure.pdf';
  const outputPdf = 'assets/temp/test_watermarked_brochure.pdf';

  console.log(`Watermarking PDF: ${inputPdf}...`);
  const pdfBuffer = await watermarkService.watermarkPdf(inputPdf, testName, testPhone);
  await fs.writeFile(outputPdf, pdfBuffer);
  console.log(`✅ Watermarked PDF saved to: ${outputPdf} (${pdfBuffer.length} bytes)`);

  console.log('🎉 Watermarking tests passed flawlessly!');
}

testWatermarking().catch((err) => {
  console.error('Watermark test failed:', err);
  process.exit(1);
});
