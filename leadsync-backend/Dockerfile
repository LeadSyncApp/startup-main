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
ENV ONNX_DISABLE=true
ENV SKIP_ONNX_WARMUP=true

# Install build tools needed by npm rebuild to compile native addons
# (sharp, onnxruntime-node, bcryptjs need python3 + make + g++ at rebuild time)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# node:20-slim is Debian-based and includes glibc — no extra compat layers needed
# for onnxruntime-node native binaries.

# Copy package metadata and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies and generate Prisma Client
# --ignore-scripts skips the top-level postinstall (PowerShell, no-op in Linux)
RUN npm ci --omit=dev --ignore-scripts && npx prisma generate

# Copy scripts directory needed by npm rebuild lifecycle scripts
COPY scripts ./scripts/

# Rebuild native addons for the runner's linux-x64 target
# Compiles sharp, onnxruntime-node, bcryptjs native binaries that were
# downloaded as source by npm ci (skipped by --ignore-scripts above)
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
