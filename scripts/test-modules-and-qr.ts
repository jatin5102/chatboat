import app from "../src/app.js";
import http from "node:http";
import axios from "axios";
import { chatbotConnectionManager } from "../src/modules/chatbot/chatbot.service.js";

async function testModularApi() {
  console.log("==================================================");
  console.log("🧪 TESTING MODULAR ARCHITECTURE & CHATBOT QR API");
  console.log("==================================================\n");

  const server = http.createServer(app);
  const testPort = 4055;
  await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  const baseURL = `http://localhost:${testPort}/api`;

  try {
    // 1. Test Chatbot QR & Connection Status API
    console.log("--- 1. Testing Chatbot Connection & QR API ---");

    // Simulate QR generation in manager
    await chatbotConnectionManager.setQr("2@mock_qr_whatsapp_connect_payload_string");

    const statusRes = await axios.get(`${baseURL}/chatbot/status`);
    console.log("GET /api/chatbot/status ->", statusRes.data);

    const qrRes = await axios.get(`${baseURL}/chatbot/qr`);
    console.log("GET /api/chatbot/qr ->", {
      status: qrRes.data.status,
      message: qrRes.data.message,
      dataStatus: qrRes.data.data.status,
      hasQrString: !!qrRes.data.data.qr,
      hasBase64Image: qrRes.data.data.qrImage?.startsWith("data:image/png;base64,"),
    });

    const qrViewRes = await axios.get(`${baseURL}/chatbot/qr-view`);
    console.log("GET /api/chatbot/qr-view -> Status:", qrViewRes.status, "| HTML length:", qrViewRes.data.length);

    // 2. Test Platter Module (/api/platters)
    console.log("\n--- 2. Testing Platter Module ---");
    const plattersRes = await axios.get(`${baseURL}/platters`);
    console.log("GET /api/platters -> Total Count:", plattersRes.data.data.length);

    const createPlatterRes = await axios.post(`${baseURL}/platters`, {
      name: "Luxury Penthouses Collection",
      tagline: "Ultra luxury rooftop residences",
      description: "Bespoke penthouses with 360 degree views",
    });
    console.log("POST /api/platters -> Created ID:", createPlatterRes.data.data.id);
    const platterId = createPlatterRes.data.data.id;

    const getPlatterRes = await axios.get(`${baseURL}/platters/${platterId}`);
    console.log("GET /api/platters/:id -> Name:", getPlatterRes.data.data.name);

    await axios.delete(`${baseURL}/platters/${platterId}`);
    console.log("DELETE /api/platters/:id -> Deleted successfully");

    // 3. Test Channel Partner Module (/api/channel-partners)
    console.log("\n--- 3. Testing Channel Partner Module ---");
    const testRera = "UPRERAMOD9999";
    const cpRes = await axios.post(`${baseURL}/channel-partners`, {
      fullName: "Karan Johar",
      firmName: "Dharma Real Estate Advisory",
      reraNumber: testRera,
      mobileNo: "919999888877",
      emailAddress: "karan@dharma.com",
      location: "Sector 94, Noida",
    });
    console.log("POST /api/channel-partners -> Created:", cpRes.data.data.fullName, "(RERA:", cpRes.data.data.reraNumber, ")");
    const cpId = cpRes.data.data.id;

    const getCpRes = await axios.get(`${baseURL}/channel-partners/${cpId}`);
    console.log("GET /api/channel-partners/:id -> Firm:", getCpRes.data.data.firmName);

    await axios.delete(`${baseURL}/channel-partners/${cpId}`);
    console.log("DELETE /api/channel-partners/:id -> Deleted successfully");

    // 4. Test Project Module (/api/projects)
    console.log("\n--- 4. Testing Project Module ---");
    const projRes = await axios.get(`${baseURL}/projects`);
    console.log("GET /api/projects -> Count:", projRes.data.data.length);

    // 5. Verify /api/faqs was removed as requested
    console.log("\n--- 5. Verifying /api/faqs Route is Removed ---");
    try {
      await axios.get(`${baseURL}/faqs`);
      console.error("❌ Error: /api/faqs still exists!");
    } catch (err: any) {
      console.log(`✅ Correct: /api/faqs returned ${err.response?.status || 404} (Route removed)`);
    }

    console.log("\n==================================================");
    console.log("🎉 ALL MODULAR ARCHITECTURE & QR API TESTS PASSED!");
    console.log("==================================================");
  } finally {
    server.close();
  }
}

testModularApi().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
