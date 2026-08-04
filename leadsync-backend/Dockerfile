# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build essentials for native addons (prisma, bcryptjs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package metadata and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use --ignore-scripts to skip Windows PowerShell postinstall hook)
RUN npm ci --ignore-scripts

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and TS config
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npx tsc

# Stage 2: Production runner
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# node:20-slim is Debian-based and includes glibc — no extra compat layers needed
# for onnxruntime-node native binaries.

# Copy package metadata and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies and generate Prisma Client
# No --ignore-scripts: sharp, onnxruntime-node, bcryptjs need postinstall to fetch/build native binaries
RUN npm ci --omit=dev && npx prisma generate

# Rebuild all native addons for the runner's linux-x64 target
# (ensures sharp-linux-x64.node, onnxruntime_binding.node, bcryptjs bindings are present)
RUN npm rebuild

# Copy compiled Javascript bundle from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory and assign permissions to node user
RUN mkdir -p /app/logs && chown -R node:node /app

# Expose server port
EXPOSE 4000

# Run as non-root node user for container security
USER node

CMD ["node", "dist/server.js"]
