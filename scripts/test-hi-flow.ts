import { prisma } from "../src/config/prisma.config.js";
import { botService } from "../src/services/bot.service.js";
import { sessionService } from "../src/services/session.service.js";
import { ChatStep } from "../src/types/index.js";

async function testHiFlow() {
  console.log("==================================================");
  console.log("🧪 TESTING 'HI' GREETING & ONBOARDING CONVERSATION");
  console.log("==================================================\n");

  const testChatId = "919876000001@c.us";
  const testPhone = "919876000001";

  // Clean test session
  await prisma.chatbotMessage.deleteMany({ where: { chatId: testChatId } });
  await prisma.chatbotSession.deleteMany({ where: { chatId: testChatId } });

  // Mock WhatsApp Client
  const replies: string[] = [];
  const mockClient: any = {
    sendMessage: async (to: string, content: any) => {
      const text = typeof content === 'string' ? content : (content.caption || '[Media]');
      replies.push(text);
      console.log(`🤖 Bot -> [${to}]:\n${text}\n----------------------------------`);
      return { id: { _serialized: 'mock_msg_id' } };
    },
  };

  function createMockMessage(body: string, timestamp: number = Math.floor(Date.now() / 1000)): any {
    return {
      from: testChatId,
      to: 'bot@c.us',
      body,
      timestamp,
      fromMe: false,
      isStatus: false,
      type: 'chat',
      getContact: async () => ({ number: testPhone }),
    };
  }

  // 1. User sends "hi" for the first time
  console.log(`👤 User -> "hi"`);
  await botService.handleMessage(mockClient, createMockMessage("hi"));

  let session = await sessionService.getSession(testChatId);
  console.log(`Current Session Step: ${session.step} (Expected: AWAITING_NAME)`);
  if (session.step !== ChatStep.AWAITING_NAME) {
    throw new Error(`Failed! Expected AWAITING_NAME but got ${session.step}`);
  }

  // 2. User enters full name
  console.log(`\n👤 User -> "Rohan Mehra"`);
  await botService.handleMessage(mockClient, createMockMessage("Rohan Mehra"));
  session = await sessionService.getSession(testChatId);
  console.log(`Current Session Step: ${session.step} (Expected: AWAITING_RERA)`);
  if (session.step !== ChatStep.AWAITING_RERA) {
    throw new Error(`Failed! Expected AWAITING_RERA but got ${session.step}`);
  }

  // 3. User enters RERA number
  console.log(`\n👤 User -> "UPRERAAGT33445"`);
  await botService.handleMessage(mockClient, createMockMessage("UPRERAAGT33445"));
  session = await sessionService.getSession(testChatId);
  console.log(`Current Session Step: ${session.step} (Expected: AWAITING_FIRM_NAME)`);
  if (session.step !== ChatStep.AWAITING_FIRM_NAME) {
    throw new Error(`Failed! Expected AWAITING_FIRM_NAME but got ${session.step}`);
  }

  // 4. User enters firm name
  console.log(`\n👤 User -> "Mehra Prime Advisory"`);
  await botService.handleMessage(mockClient, createMockMessage("Mehra Prime Advisory"));
  session = await sessionService.getSession(testChatId);
  console.log(`Current Session Step: ${session.step} (Expected: SELECT_PLATTER)`);
  if (session.step !== ChatStep.SELECT_PLATTER) {
    throw new Error(`Failed! Expected SELECT_PLATTER but got ${session.step}`);
  }

  // 5. User sends "hi" again as an onboarded partner
  console.log(`\n👤 User -> "hi" (returning)`);
  await botService.handleMessage(mockClient, createMockMessage("hi"));
  session = await sessionService.getSession(testChatId);
  console.log(`Current Session Step: ${session.step} (Expected: SELECT_PLATTER)`);

  // 6. User chooses "1" (Residential)
  console.log(`\n👤 User -> "1" (Select Residential Platter)`);
  await botService.handleMessage(mockClient, createMockMessage("1"));
  session = await sessionService.getSession(testChatId);
  console.log(`Current Session Step: ${session.step} (Expected: SELECT_PROJECT)`);
  if (session.step !== ChatStep.SELECT_PROJECT) {
    throw new Error(`Failed! Expected SELECT_PROJECT but got ${session.step}`);
  }

  // Clean test records
  await prisma.chatbotMessage.deleteMany({ where: { chatId: testChatId } });
  await prisma.chatbotSession.deleteMany({ where: { chatId: testChatId } });

  console.log("\n==================================================");
  console.log("✅ ALL 'HI' GREETING & CONVERSATION TESTS PASSED!");
  console.log("==================================================");
}

testHiFlow()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
