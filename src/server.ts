import "dotenv/config";
import app, { initWhatsApp } from "./app.js";
import { prisma } from "./config/prisma.config.js";
import { projectService } from "./services/project.service.js";
import logger from "./utils/logger.utils.js";

const PORT = process.env.PORT || 4002;

async function startServer() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info("✅ Database connected successfully via Prisma (PostgreSQL)");

    // Ensure projects and documents are ready in DB
    await projectService.ensureProjectsLoaded();
    const count = await prisma.projects.count();
    logger.info(`📦 Total active projects loaded in database: ${count}`);

    app.listen(PORT, async () => {
      logger.info(`🚀 API & Health Server running on http://localhost:${PORT}`);
      logger.info(`📊 Health check available at http://localhost:${PORT}/health`);
      logger.info(`📁 Projects API at http://localhost:${PORT}/api/projects`);
      logger.info(`💬 Chat Records API at http://localhost:${PORT}/api/records/sessions`);

      // Initialize WhatsApp client
      await initWhatsApp();
    });
  } catch (error) {
    logger.error("❌ Database connection or server startup failed");
    console.error(error);
    process.exit(1);
  }
}

startServer();
