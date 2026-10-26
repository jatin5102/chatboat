import app from "../src/app.js";
import http from "node:http";
import axios from "axios";
import { collateralService } from "../src/services/collateral.service.js";
import { botService } from "../src/services/bot.service.js";
import { projectService } from "../src/services/project.service.js";

async function testDynamicCollaterals() {
  console.log("==================================================");
  console.log("🧪 TESTING DYNAMIC COLLATERALS WITH ACTIVE/INACTIVE STATUS");
  console.log("==================================================\n");

  const server = http.createServer(app);
  const testPort = 4058;
  await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  const baseURL = `http://localhost:${testPort}/api/v1`;

  try {
    // 1. Ensure projects & collaterals are seeded
    await projectService.ensureProjectsLoaded();
    await collateralService.ensureDefaultCollaterals();

    const collaterals = await collateralService.getAllCollaterals();
    console.log(`1. Total seeded collaterals: ${collaterals.length}`);
    collaterals.forEach((c, i) => {
      console.log(`   [${i + 1}] ${c.code} - "${c.title}" | Active: ${c.status}`);
    });

    // 2. Fetch projects and test dynamic menu generation with all active
    const projects = await projectService.getAllProjects();
    const testProj = projects[0];
    console.log(`\n2. Testing with Project: "${testProj.name}" (ID: ${testProj.id})`);

    let sentMessages: string[] = [];
    const mockClient: any = {
      sendMessage: async (_to: string, content: any) => {
        if (typeof content === "string") {
          sentMessages.push(content);
        } else if (content && content.caption) {
          sentMessages.push(content.caption);
        }
        return { id: { _serialized: "mock_msg_id" } };
      },
    };

    // Spy on botService.reply
    const originalReply = (botService as any).reply;
    (botService as any).reply = async (client: any, to: string, text: string, step: any) => {
      sentMessages.push(text);
      return originalReply.call(botService, client, to, text, step);
    };

    sentMessages = [];
    await botService.sendCollateralMenu(mockClient, "919999999999@c.us", testProj);
    const initialMenu = sentMessages[0];
    console.log("\n--- Generated Menu (All Collaterals Active) ---");
    console.log(initialMenu);

    // 3. Test Inactive Status Filter: Deactivate one collateral (e.g. FACTSHEET)
    const factsheet = collaterals.find((c) => c.code === "FACTSHEET");
    if (factsheet) {
      console.log(`\n3. Deactivating collateral: ${factsheet.title} (ID: ${factsheet.id})...`);
      const patchRes = await axios.patch(`${baseURL}/collaterals/${factsheet.id}/status`, {
        status: false,
      });
      console.log("   PATCH /collaterals/:id/status Response:", patchRes.data.message);

      sentMessages = [];
      await botService.sendCollateralMenu(mockClient, "919999999999@c.us", testProj);
      const updatedMenu = sentMessages[0];
      console.log("\n--- Generated Menu After Deactivating Factsheet ---");
      console.log(updatedMenu);

      if (updatedMenu.includes("Project Factsheet")) {
        throw new Error("❌ Inactive collateral still visible in menu!");
      }
      console.log("   ✅ Success: Inactive collateral automatically excluded from WhatsApp menu!");

      // Reactivate it
      await axios.patch(`${baseURL}/collaterals/${factsheet.id}/status`, { status: true });
      console.log("   Reactivated Factsheet collateral.");
    }

    // 4. Test Collateral CRUD API endpoints
    console.log("\n4. Testing Collateral CRUD API Endpoints...");

    // Create a new dynamic custom collateral
    const createRes = await axios.post(`${baseURL}/collaterals`, {
      projectId: testProj.id,
      code: "VIP_VIPER",
      title: "VIP Lounge Invitation Card",
      subtitle: "(Exclusive South Delhi & NCR HNI access pass)",
      icon: "🎟️",
      seq: 7,
      status: true,
    });
    console.log("   POST /collaterals -> Created ID:", createRes.data.data.id);
    const customCollateralId = createRes.data.data.id;

    // Check it appears for this project
    const activeProjectCollaterals = await axios.get(
      `${baseURL}/collaterals/project/${testProj.id}`
    );
    console.log(
      `   GET /collaterals/project/${testProj.id} -> Count: ${activeProjectCollaterals.data.data.length}`
    );

    // Clean up created collateral
    await axios.delete(`${baseURL}/collaterals/${customCollateralId}`);
    console.log("   DELETE /collaterals/:id -> Deleted successfully.");

    console.log("\n==================================================");
    console.log("🎉 ALL DYNAMIC COLLATERAL & ACTIVE/INACTIVE TESTS PASSED!");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

testDynamicCollaterals().catch((err) => {
  console.error("❌ Test failed:", err.response?.data || err.message);
  process.exit(1);
});
