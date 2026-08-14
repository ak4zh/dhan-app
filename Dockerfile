# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Disable Corepack interactive download prompt & install pnpm globally
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install -g pnpm@9

# Copy package manifests (including workspace config)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source files
COPY . .

# Set dummy secrets required by better-auth and app validation during build-time
ENV BETTER_AUTH_SECRET=build_placeholder_secret_key_32bytes \
    DHAN_CLIENT_ID=build_placeholder_dhan_client_id

# Build SvelteKit standalone Node server
RUN pnpm build

# Prune dev dependencies for runtime
RUN pnpm prune --prod

# Stage 2: Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=file:/app/data/app.db

# Create persistent data directory and ensure ownership by node user
RUN mkdir -p /app/data && chown -R node:node /app

# Copy production dependencies and built assets from builder stage
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/build ./build

# Switch to non-root user for security
USER node

EXPOSE 3000

CMD ["node", "build"]
