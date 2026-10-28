import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { botService } from './services/bot.service.js';
import { projectService } from './services/project.service.js';
import { prisma } from './config/prisma.config.js';
import dotenv from 'dotenv';

import modulesRouter from './modules/index.js';
import { chatbotConnectionManager } from './modules/chatbot/chatbot.service.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static uploaded files from root uploads/ directory
app.use('/uploads', express.static(path.resolve('uploads')));

// Modular API Routes (/api/v1/platters, /api/platters, etc.)
app.use('/api/v1', modulesRouter);
app.use('/api', modulesRouter);

// WhatsApp Web Client state & factory
export let client: any = null;
let isWhatsAppReady = false;
let isRestarting = false;

function setupWhatsAppClient(): any {
  const newClient = new Client({
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

  // Event: QR Code generation
  newClient.on('qr', async (qr: string) => {
    await chatbotConnectionManager.setQr(qr);
    console.log('\n📲 QR Code received! Scan in terminal or visit http://localhost:' + (process.env.PORT || 4002) + '/api/v1/chatbot/qr-view');
    qrcode.generate(qr, { small: true });
    console.log('Waiting for authentication...\n');
  });

  // Event: Authenticated
  newClient.on('authenticated', () => {
    isWhatsAppReady = true;
    chatbotConnectionManager.setAuthenticated();
    chatbotConnectionManager.setReady();
    console.log('✅ WhatsApp authenticated successfully! Session saved in .wwebjs_auth.');
    console.log('🎉 WhatsApp Bot is ONLINE and ready to handle incoming leads!');
  });

  // Event: Auth failure
  newClient.on('auth_failure', (msg: string) => {
    chatbotConnectionManager.setAuthFailure(msg);
    console.error('❌ WhatsApp authentication failed:', msg);
  });

  // Event: Ready
  newClient.on('ready', () => {
    isWhatsAppReady = true;
    chatbotConnectionManager.setReady();
    console.log('🎉 WhatsApp Bot ready confirmed!');
  });

  // Event: Disconnected
  newClient.on('disconnected', (reason: any) => {
    isWhatsAppReady = false;
    chatbotConnectionManager.setDisconnected();
    console.log('⚠️ WhatsApp Bot disconnected:', reason);
  });

  // Event: Incoming message handler (processes both message & message_create with deduplication)
  const processedMessageIds = new Set<string>();

  const handleIncomingMessage = async (message: any) => {
    try {
      // 1. Ignore messages sent from the bot's own WhatsApp account
      if (message.fromMe) {
        return;
      }

      // 2. Ignore group chats, status updates, or broadcasts
      if (message.from && (message.from.endsWith('@g.us') || message.isStatus || message.from === 'status@broadcast')) {
        return;
      }

      // 3. Deduplicate events
      const msgId = message.id?._serialized || message.id?.id;
      if (msgId) {
        if (processedMessageIds.has(msgId)) return;
        processedMessageIds.add(msgId);
        setTimeout(() => processedMessageIds.delete(msgId), 30000);
      }

      // 4. Ignore old historical backlog messages (older than 10 minutes)
      const nowSec = Math.floor(Date.now() / 1000);
      if (message.timestamp && (nowSec - message.timestamp > 600)) {
        return;
      }

      console.log(`[Bot] 📩 Incoming message from ${message.from}: "${message.body || ''}"`);
      await botService.handleMessage(newClient, message);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  newClient.on('message', handleIncomingMessage);
  newClient.on('message_create', handleIncomingMessage);

  return newClient;
}

export function getWhatsAppClient(): any {
  return client;
}

/**
 * REST API Routes for Database Records & Projects
 */

// Health & Status
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const platterCount = await prisma.platter.count();
    const projectCount = await prisma.projects.count();
    const channelPartnerCount = await prisma.channelPartner.count();
    const faqCount = await prisma.faq.count();
    const sessionCount = await prisma.chatbotSession.count();
    const messageCount = await prisma.chatbotMessage.count();

    res.json({
      status: 'UP',
      database: 'CONNECTED',
      whatsapp: isWhatsAppReady ? 'ONLINE' : 'INITIALIZING_OR_WAITING_SCAN',
      stats: {
        platters: platterCount,
        projects: projectCount,
        channelPartners: channelPartnerCount,
        faqs: faqCount,
        chatSessions: sessionCount,
        chatMessages: messageCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

// Chat Sessions stored in Database
app.get('/api/records/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.chatbotSession.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } }
      }
    });
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full Chat Flow History for a given Chat ID
app.get('/api/records/messages/:chatId', async (req: Request, res: Response) => {
  try {
    const chatId = String(req.params.chatId);
    const messages = await prisma.chatbotMessage.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, count: messages.length, data: messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Captured Enquiries / Leads
app.get('/api/records/enquiries', async (_req: Request, res: Response) => {
  try {
    const buyerEnquiries = await prisma.projectEnquiry.findMany({
      orderBy: { dateAt: 'desc' },
      take: 50
    });
    const partnerEnquiries = await prisma.channelPartnerEnquiry.findMany({
      orderBy: { dateAt: 'desc' },
      take: 50
    });
    res.json({
      success: true,
      buyers: buyerEnquiries,
      channelPartners: partnerEnquiries
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function cleanStaleLockfile(): void {
  try {
    const lockPath = path.resolve('./.wwebjs_auth/session/lockfile');
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
        console.log('🧹 Cleaned up stale lockfile from .wwebjs_auth/session/lockfile');
      } catch (err: any) {
        console.warn('⚠️ Could not remove lockfile (may be locked by process):', err.message);
      }
    }
  } catch {}
}

export async function initWhatsApp(): Promise<void> {
  if (isRestarting) {
    console.log('⏳ WhatsApp initialization already in progress.');
    return;
  }
  isRestarting = true;
  chatbotConnectionManager.setInitializing();
  isWhatsAppReady = false;

  try {
    console.log('=====================================================');
    console.log('🚀 Initializing WhatsApp Real Estate Bot with Database...');
    console.log('📌 Node.js ESM + TypeScript + Prisma Postgres + WhatsApp-Web.js');
    console.log('=====================================================');

    if (client) {
      try {
        await client.destroy();
      } catch (err: any) {
        console.warn('⚠️ Warning destroying existing client:', err.message);
      }
      client = null;
    }

    cleanStaleLockfile();

    client = setupWhatsAppClient();
    await client.initialize();
  } catch (err: any) {
    console.error('❌ Failed to initialize WhatsApp client:', err);
    chatbotConnectionManager.setDisconnected();
  } finally {
    isRestarting = false;
  }
}

export async function restartWhatsApp(): Promise<void> {
  if (isRestarting) {
    console.log('⚠️ WhatsApp restart already in progress. Skipping duplicate call.');
    return;
  }
  isRestarting = true;
  chatbotConnectionManager.setInitializing();
  isWhatsAppReady = false;

  try {
    console.log('\n🔄 Restarting WhatsApp Web client...');
    if (client) {
      try {
        await client.destroy();
      } catch (err: any) {
        console.warn('⚠️ Warning destroying previous client on restart:', err.message);
      }
      client = null;
    }

    // Give Puppeteer & Chrome 1 second to cleanly release files and lock handles
    await new Promise((resolve) => setTimeout(resolve, 1000));
    cleanStaleLockfile();

    client = setupWhatsAppClient();
    // Launch initialization asynchronously without blocking caller indefinitely
    client.initialize().catch((err: any) => {
      console.error('❌ Error during WhatsApp restart initialization:', err);
      chatbotConnectionManager.setDisconnected();
    });
  } catch (err: any) {
    console.error('❌ Error in restartWhatsApp:', err);
    chatbotConnectionManager.setDisconnected();
    throw err;
  } finally {
    isRestarting = false;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down WhatsApp client gracefully...');
  try {
    if (client) {
      await client.destroy();
    }
  } catch {}
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(0);
});

export default app;
