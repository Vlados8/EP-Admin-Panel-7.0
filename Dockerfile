# Use Node.js 22 as base
FROM node:22-bookworm-slim

# Install system dependencies for Puppeteer (Chromium binary to run inside container)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    libglib2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    wget gnupg ca-certificates \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set Working Directory
WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies (ignoring scripts to prevent premature builds)
RUN npm install
RUN npm install --prefix backend
RUN npm install --prefix frontend

# Copy all source files
COPY . .

# Build frontend
RUN npm run build --prefix frontend

# Expose default backend port
EXPOSE 3001

# Set precise environment variables for Puppeteer stability
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
