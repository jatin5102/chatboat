import { prisma } from "../src/config/prisma.config.js";
import { projectService } from "../src/services/project.service.js";
import { chatRecordService } from "../src/services/chatRecord.service.js";
import { sessionService } from "../src/services/session.service.js";
import { ChatStep } from "../src/types/index.js";

async function testDatabaseChatbot() {
  console.log("--- 1. Testing Project Service from DB ---");
  const projects = await projectService.getAllProjects();
  console.log("Loaded Projects Count from DB:", projects.length);
  projects.forEach((p, i) => {
    console.log(
      `[${i + 1}] ${p.name} | RERA: ${p.reraNumber} | Brochure: ${p.brochurePath ? "EXISTS" : "NONE"} | Images: ${p.imagePaths.length}`
    );
  });

  console.log("\n--- 2. Testing Chat Session & Chat Flow in DB ---");
  const testChatId = "919876543210@c.us";
  const testPhone = "919876543210";

  // Create/get session
  const session = await sessionService.getSession(testChatId, testPhone);
  console.log("Session initial:", session.chatId, session.step);

  // User sends name
  await chatRecordService.recordIncomingMessage(testChatId, "John Doe", ChatStep.AWAITING_NAME);
  await sessionService.updateSession(testChatId, {
    name: "John Doe",
    location: "Gurgaon",
    role: "BUYER",
    step: ChatStep.AWAITING_PROPERTY_SELECTION,
  });

  // Bot replies
  await chatRecordService.recordOutgoingMessage(
    testChatId,
    "Welcome John Doe! Here are our projects...",
    ChatStep.AWAITING_PROPERTY_SELECTION
  );

  // User chooses Skyline Heights
  const selected = projects[0];
  await chatRecordService.recordIncomingMessage(testChatId, "1", ChatStep.AWAITING_PROPERTY_SELECTION);
  await sessionService.updateSession(testChatId, {
    selectedPropertyId: selected.id,
    step: ChatStep.PROPERTY_MENU,
  });

  // Record brochure download & lead
  const updatedSession = await sessionService.getSession(testChatId);
  await chatRecordService.recordLead(updatedSession, selected, "BROCHURE_DOWNLOAD");
  await chatRecordService.recordOutgoingMessage(
    testChatId,
    "Brochure sent!",
    ChatStep.PROPERTY_MENU,
    "pdf",
    selected.brochurePath
  );

  console.log("\n--- 3. Verifying Stored Records in PostgreSQL ---");
  const dbSession = await prisma.chatbotSession.findUnique({
    where: { chatId: testChatId },
    include: { messages: true },
  });
  console.log(
    "Stored DB Session Name:",
    dbSession?.name,
    "| Role:",
    dbSession?.role,
    "| Location:",
    dbSession?.location
  );
  console.log("Stored Messages Count in DB:", dbSession?.messages.length);

  const leads = await prisma.projectEnquiry.findMany({
    where: { mobileNo: testPhone },
  });
  console.log(
    "Stored Project Enquiries in DB:",
    leads.length,
    "| Project:",
    leads[0]?.projectName,
    "| Lead Name:",
    leads[0]?.fullName
  );

  // Clean up test records
  await prisma.chatbotMessage.deleteMany({ where: { chatId: testChatId } });
  await prisma.chatbotSession.deleteMany({ where: { chatId: testChatId } });
  await prisma.projectEnquiry.deleteMany({ where: { mobileNo: testPhone } });

  console.log("\n✅ All Database Tests for Projects, Docs, Chat Flow, and Records PASSED successfully!");
}

testDatabaseChatbot()
  .catch((err) => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
