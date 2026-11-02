# Base image with Node 22 to satisfy engine requirements
FROM node:22-slim

# Install Chromium and system dependencies needed for Puppeteer in headless mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Point Puppeteer to the system Chromium binary and skip redundant browser downloads
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy scripts directory (required for npm postinstall patch-wwebjs hook)
COPY scripts ./scripts

# Copy prisma schema
COPY prisma ./prisma

# Install dependencies (will run postinstall script successfully)
RUN npm install

# Copy full source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build project
RUN npm run build

# Expose port
EXPOSE 4002

# Run migrations and start application
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
