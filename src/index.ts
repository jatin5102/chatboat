import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { botService } from './services/bot.service.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('=====================================================');
console.log('🚀 Initializing WhatsApp Real Estate Bot...');
console.log('📌 Node.js ESM + TypeScript with WhatsApp-Web.js');
console.log('=====================================================');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// Event: QR Code generation for WhatsApp Web scan
client.on('qr', (qr: string) => {
  console.log('\n📲 QR Code received! Please scan with your WhatsApp:');
  qrcode.generate(qr, { small: true });
  console.log('Waiting for authentication...\n');
});

// Event: Successfully authenticated
client.on('authenticated', () => {
  console.log('✅ Authenticated successfully! Session saved in .wwebjs_auth.');
});

// Event: Authentication failure
client.on('auth_failure', (msg: string) => {
  console.error('❌ Authentication failed:', msg);
});

// Event: Client is ready to receive & send messages
client.on('ready', () => {
  console.log('🎉 WhatsApp Bot is ONLINE and ready to handle incoming leads!');
});

// Event: Incoming message
client.on('message', async (message) => {
  try {
    await botService.handleMessage(client, message);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down WhatsApp client gracefully...');
  await client.destroy();
  process.exit(0);
});

client.initialize();
