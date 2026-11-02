import express, { Request, Response } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { botService } from "./services/bot.service.js";
import { prisma } from "./config/prisma.config.js";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { authenticate, authorize } from "./middlewares/auth.middleware.js";
import passport from "./config/passport.config.js";

import modulesRouter from "./modules/index.js";
import { chatbotConnectionManager } from "./modules/chatbot/chatbot.service.js";
import { authLimiter, apiLimiter } from "./middlewares/rateLimiter.middleware.js";
import { notFound } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(helmet());

const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://chatbot.websitedesigningcompany.co.in",
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true,
    }),
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.options("*", cors({ origin: allowedOrigins, credentials: true }));

// Serve static assets & uploaded files
app.use("/uploads/assets", express.static(path.join(process.cwd(), "assets")));
app.use("/assets", express.static(path.join(process.cwd(), "assets")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (_req: Request, res: Response) => {
    res.json({
        success: true,
        message: "Chatbot Backend API is online",
        whatsapp: isWhatsAppReady ? "ONLINE" : "INITIALIZING",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/v1/admin/auth", authLimiter);
app.use("/api/v1", apiLimiter);

app.use("/api/v1", modulesRouter);

// WhatsApp Web Client state & factory
export let client: any = null;
let isWhatsAppReady = false;
let isRestarting = false;

function setupWhatsAppClient(): any {
    const newClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: "./.wwebjs_auth",
        }),
        puppeteer: {
            headless: true,
            ...(process.env.PUPPETEER_EXECUTABLE_PATH
                ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
                : {}),
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-software-rasterizer",
            ],
        },
    });

    // Event: QR Code generation
    newClient.on("qr", async (qr: string) => {
        await chatbotConnectionManager.setQr(qr);
        console.log(
            "\n📲 QR Code received! Scan in terminal or visit http://localhost:" +
                (process.env.PORT || 4002) +
                "/api/v1/chatbot/qr-view",
        );
        qrcode.generate(qr, { small: true });
        console.log("Waiting for authentication...\n");
    });

    // Event: Authenticated
    newClient.on("authenticated", () => {
        isWhatsAppReady = true;
        chatbotConnectionManager.setAuthenticated();
        chatbotConnectionManager.setReady();
        console.log("✅ WhatsApp authenticated successfully! Session saved in .wwebjs_auth.");
        console.log("🎉 WhatsApp Bot is ONLINE and ready to handle incoming leads!");
    });

    // Event: Auth failure
    newClient.on("auth_failure", (msg: string) => {
        chatbotConnectionManager.setAuthFailure(msg);
        console.error("❌ WhatsApp authentication failed:", msg);
    });

    // Event: Ready
    newClient.on("ready", () => {
        isWhatsAppReady = true;
        chatbotConnectionManager.setReady();
        console.log("🎉 WhatsApp Bot ready confirmed!");
    });

    // Event: Disconnected
    newClient.on("disconnected", (reason: any) => {
        isWhatsAppReady = false;
        chatbotConnectionManager.setDisconnected();
        console.log("⚠️ WhatsApp Bot disconnected:", reason);
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
            if (
                message.from &&
                (message.from.endsWith("@g.us") ||
                    message.isStatus ||
                    message.from === "status@broadcast")
            ) {
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
            if (message.timestamp && nowSec - message.timestamp > 600) {
                return;
            }

            console.log(`[Bot] 📩 Incoming message from ${message.from}: "${message.body || ""}"`);
            await botService.handleMessage(newClient, message);
        } catch (error) {
            console.error("Error handling message:", error);
        }
    };

    newClient.on("message", handleIncomingMessage);
    newClient.on("message_create", handleIncomingMessage);

    return newClient;
}

export function getWhatsAppClient(): any {
    return client;
}

// Health & Status
app.get("/health", async (_req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        const platterCount = await prisma.platter.count();
        const projectCount = await prisma.projects.count();
        const channelPartnerCount = await prisma.channelPartner.count();
        const faqCount = await prisma.faq.count();
        const sessionCount = await prisma.chatbotSession.count();
        const messageCount = await prisma.chatbotMessage.count();

        res.json({
            status: "UP",
            database: "CONNECTED",
            whatsapp: isWhatsAppReady ? "ONLINE" : "INITIALIZING_OR_WAITING_SCAN",
            stats: {
                platters: platterCount,
                projects: projectCount,
                channelPartners: channelPartnerCount,
                faqs: faqCount,
                chatSessions: sessionCount,
                chatMessages: messageCount,
            },
        });
    } catch (err: any) {
        res.status(500).json({ status: "ERROR", error: err.message });
    }
});

function cleanStaleLockfile(): void {
    const authDir = path.resolve("./.wwebjs_auth");
    if (!fs.existsSync(authDir)) return;

    const lockNames = new Set([
        "lockfile",
        "SingletonLock",
        "SingletonCookie",
        "SingletonSocket",
        "DevToolsActivePort",
    ]);

    function purgeLocks(currentDir: string): void {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (lockNames.has(entry.name) || entry.name.startsWith("Singleton")) {
                    try {
                        fs.unlinkSync(fullPath);
                        console.log(`🧹 Cleaned up stale Chromium lock file: ${fullPath}`);
                    } catch {
                        try {
                            fs.rmSync(fullPath, { force: true });
                        } catch {}
                    }
                } else if (entry.isDirectory()) {
                    purgeLocks(fullPath);
                }
            }
        } catch {
            // Ignore access errors
        }
    }

    purgeLocks(authDir);
}

export async function initWhatsApp(): Promise<void> {
    if (isRestarting) {
        console.log("⏳ WhatsApp initialization already in progress.");
        return;
    }
    isRestarting = true;
    chatbotConnectionManager.setInitializing();
    isWhatsAppReady = false;

    try {
        console.log("=====================================================");
        console.log("🚀 Initializing WhatsApp Real Estate Bot with Database...");
        console.log("📌 Node.js ESM + TypeScript + Prisma Postgres + WhatsApp-Web.js");
        console.log("=====================================================");

        if (client) {
            try {
                await client.destroy();
            } catch (err: any) {
                console.warn("⚠️ Warning destroying existing client:", err.message);
            }
            client = null;
        }

        cleanStaleLockfile();

        client = setupWhatsAppClient();
        try {
            await client.initialize();
        } catch (initErr: any) {
            const msg = String(initErr?.message || "");
            // Detect Chromium ProcessSingleton lock failure (exit code 21)
            if (msg.includes("Code: 21") || msg.includes("process_singleton") || msg.includes("profile appears to be in use")) {
                console.warn("⚠️ Stale Chromium profile lock detected (Code 21). Purging locks and retrying initialization...");
                cleanStaleLockfile();
                await new Promise((resolve) => setTimeout(resolve, 1500));
                client = setupWhatsAppClient();
                await client.initialize();
            } else {
                throw initErr;
            }
        }
    } catch (err: any) {
        console.error("❌ Failed to initialize WhatsApp client:", err);
        chatbotConnectionManager.setDisconnected();
    } finally {
        isRestarting = false;
    }
}

export async function restartWhatsApp(): Promise<void> {
    if (isRestarting) {
        console.log("⚠️ WhatsApp restart already in progress. Skipping duplicate call.");
        return;
    }
    isRestarting = true;
    chatbotConnectionManager.setInitializing();
    isWhatsAppReady = false;

    try {
        console.log("\n🔄 Restarting WhatsApp Web client...");
        if (client) {
            try {
                await client.destroy();
            } catch (err: any) {
                console.warn("⚠️ Warning destroying previous client on restart:", err.message);
            }
            client = null;
        }

        // Give Puppeteer & Chrome 1.5 seconds to cleanly release files and lock handles
        await new Promise((resolve) => setTimeout(resolve, 1500));
        cleanStaleLockfile();

        client = setupWhatsAppClient();
        // Launch initialization asynchronously without blocking caller indefinitely
        client.initialize().catch(async (err: any) => {
            const msg = String(err?.message || "");
            if (msg.includes("Code: 21") || msg.includes("process_singleton") || msg.includes("profile appears to be in use")) {
                console.warn("⚠️ Stale Chromium profile lock detected on restart. Purging and retrying...");
                cleanStaleLockfile();
                await new Promise((resolve) => setTimeout(resolve, 1500));
                try {
                    client = setupWhatsAppClient();
                    await client.initialize();
                    return;
                } catch (retryErr) {
                    console.error("❌ Retry failed after Code 21:", retryErr);
                }
            } else {
                console.error("❌ Error during WhatsApp restart initialization:", err);
            }
            chatbotConnectionManager.setDisconnected();
        });
    } catch (err: any) {
        console.error("❌ Error in restartWhatsApp:", err);
        chatbotConnectionManager.setDisconnected();
        throw err;
    } finally {
        isRestarting = false;
    }
}

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down WhatsApp client gracefully...");
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

app.use(notFound);
app.use(errorHandler);

export default app;
