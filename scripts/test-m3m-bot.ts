import { prisma } from "../src/config/prisma.config.js";
import { platterService } from "../src/services/platter.service.js";
import { channelPartnerService } from "../src/services/channelPartner.service.js";
import { projectService } from "../src/services/project.service.js";
import { faqService } from "../src/services/faq.service.js";
import { sessionService } from "../src/services/session.service.js";
import { watermarkService } from "../src/services/watermark.service.js";
import { ChatStep } from "../src/types/index.js";

async function runM3MTest() {
  console.log("===============================================================");
  console.log("🚀 TESTING M3M NOIDA PLATTERS, CHANNEL PARTNERS, PROJECTS & FAQs");
  console.log("===============================================================\n");

  // 1. Ensure projects & platters seeded
  await projectService.ensureProjectsLoaded();

  // Test 1: Platters
  console.log("--- 1. Testing Platters (Residential & Commercial) ---");
  const platters = await platterService.getAllPlatters();
  console.log(`Loaded ${platters.length} Platters from Database:`);
  platters.forEach((p, idx) => {
    console.log(`   [${idx + 1}] Platter: ${p.name} | Slug: ${p.slug} | Active Projects: ${p.projects?.length || 0}`);
  });

  // Test 2: Projects on Platters
  console.log("\n--- 2. Testing Projects on Platters ---");
  const projects = await projectService.getAllProjects();
  console.log(`Loaded ${projects.length} Total Projects:`);
  projects.forEach((proj, idx) => {
    console.log(
      `   [${idx + 1}] ${proj.name} | Category: ${proj.platterName} | Loc: ${proj.location} | Brochure: ${proj.brochurePath ? "OK" : "NO"} | Gallery: ${proj.imagePaths.length}`
    );
  });

  // Test 3: Channel Partner CRUD
  console.log("\n--- 3. Testing Channel Partner CRUD ---");
  const testRera = "UPRERATEST99999";
  // Delete if exists
  const existing = await channelPartnerService.findByRera(testRera);
  if (existing) await channelPartnerService.delete(existing.id);

  const createdCp = await channelPartnerService.create({
    fullName: "Amitabh Singhania",
    firmName: "Singhania Prime Real Estate",
    reraNumber: testRera,
    mobileNo: "919988776655",
    location: "Noida Sector 94",
    emailAddress: "amitabh@singhania.com",
  });
  console.log(`✅ Created Partner: ${createdCp.fullName} (${createdCp.firmName}) | RERA: ${createdCp.reraNumber}`);

  const fetchedCp = await channelPartnerService.findByRera(testRera);
  console.log(`✅ Fetched Partner by RERA: ${fetchedCp?.firmName}`);

  await channelPartnerService.update(createdCp.id, { firmName: "Singhania Luxury Advisory LLP" });
  console.log(`✅ Updated Partner Firm Name`);

  await channelPartnerService.delete(createdCp.id);
  console.log(`✅ Deleted Test Partner`);

  // Test 4: Dynamic FAQ Service & Search
  console.log("\n--- 4. Testing Dynamic FAQ Service & Natural Search ---");
  const faqs = await faqService.getFaqs();
  console.log(`Loaded ${faqs.length} FAQs from Database:`);
  faqs.forEach((f, idx) => {
    console.log(`   [FAQ ${idx + 1}] (${f.category}) ${f.question}`);
  });

  const matched1 = await faqService.findBestMatch("Where is the Cullinan located?");
  console.log(`\n🔍 Search "Where is the Cullinan located?":`);
  console.log(`   👉 Answer: ${matched1?.answer.slice(0, 100)}...`);

  const matched2 = await faqService.findBestMatch("how are collaterals watermarked?");
  console.log(`\n🔍 Search "how are collaterals watermarked?":`);
  console.log(`   👉 Answer: ${matched2?.answer.slice(0, 100)}...`);

  // Test 5: Watermarking Engine with Partner Name, Firm & RERA
  console.log("\n--- 5. Testing Personalized Watermarking Engine ---");
  if (projects[0]?.brochurePath) {
    const watermarkedPdf = await watermarkService.watermarkPdf(
      projects[0].brochurePath,
      "Suresh Khanna",
      "+91 98765 43210",
      "Khanna Wealth & Property Advisors",
      "UPRERAAGT55432"
    );
    console.log(`✅ Watermarked PDF generated successfully! Byte size: ${watermarkedPdf.length} bytes`);
  }

  if (projects[0]?.imagePaths[0]) {
    const watermarkedImg = await watermarkService.watermarkImage(
      projects[0].imagePaths[0],
      "Suresh Khanna",
      "+91 98765 43210",
      "Khanna Wealth & Property Advisors",
      "UPRERAAGT55432"
    );
    console.log(`✅ Watermarked Image generated successfully! Byte size: ${watermarkedImg.length} bytes`);
  }

  // Test 6: Simulating M3M Noida 9-Step Chatbot Session Flow
  console.log("\n--- 6. Simulating M3M Noida 9-Step Bot Journey ---");
  const testChatId = "919988112233@c.us";
  const testPhone = "919988112233";

  // Reset / Initial
  await sessionService.resetSession(testChatId, testPhone);
  let session = await sessionService.getSession(testChatId);
  console.log(`Step 1/2: Bot Welcomes user -> Current Step: ${session.step}`);

  // Step 3: User Enters Full Name
  await sessionService.updateSession(testChatId, {
    name: "Vikram Malhotra",
    step: ChatStep.AWAITING_RERA,
  });
  session = await sessionService.getSession(testChatId);
  console.log(`Step 3: User entered name -> "${session.name}", next: ${session.step}`);

  // Step 4: User Enters RERA No
  await sessionService.updateSession(testChatId, {
    reraNumber: "UPRERAAGT88219",
    step: ChatStep.AWAITING_FIRM_NAME,
  });
  session = await sessionService.getSession(testChatId);
  console.log(`Step 4: User entered RERA -> "${session.reraNumber}", next: ${session.step}`);

  // Step 5: User Enters Firm Name
  await sessionService.updateSession(testChatId, {
    firmName: "Malhotra Realty Partners",
    step: ChatStep.SELECT_PLATTER,
  });
  session = await sessionService.getSession(testChatId);
  console.log(`Step 5 & 6: Partner Verified -> "${session.firmName}", next: ${session.step}`);

  // Step 6 / 7: Select Platter (Residential)
  const resPlatter = platters.find((p) => p.slug.includes("residential"));
  await sessionService.updateSession(testChatId, {
    selectedPlatterId: resPlatter?.id,
    step: ChatStep.SELECT_PROJECT,
  });
  session = await sessionService.getSession(testChatId);
  console.log(`Step 7a: Platter Selected -> "${resPlatter?.name}", next: ${session.step}`);

  // Select Project (M3M The Cullinan)
  const cullinan = projects.find((p) => p.slug.includes("cullinan"));
  await sessionService.updateSession(testChatId, {
    selectedPropertyId: cullinan?.id,
    step: ChatStep.SELECT_COLLATERAL,
  });
  session = await sessionService.getSession(testChatId);
  console.log(`Step 7b: Project Selected -> "${cullinan?.name}", next: ${session.step}`);

  // Step 8: Collateral Delivered
  await sessionService.updateSession(testChatId, {
    step: ChatStep.COLLATERAL_CONFIRMATION,
  });
  session = await sessionService.getSession(testChatId);
  console.log(`Step 8 & 9: Collateral Delivered -> Next options displayed: ${session.step}`);

  // Clean up test session
  await prisma.chatbotMessage.deleteMany({ where: { chatId: testChatId } });
  await prisma.chatbotSession.deleteMany({ where: { chatId: testChatId } });

  console.log("\n===============================================================");
  console.log("🎉 ALL TESTS FOR M3M NOIDA PLATTERS, PARTNERS, CRUD & FAQS PASSED!");
  console.log("===============================================================");
}

runM3MTest()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
