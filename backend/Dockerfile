# ============================================================
# Proyecto Centurion – Backend Dockerfile
# Multi-stage: build TypeScript → run compiled JS
# ============================================================

# ── Stage 1: builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as non-root user
RUN addgroup --system --gid 1001 centurion \
 && adduser  --system --uid 1001 centurion

WORKDIR /app

# Only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership
RUN chown -R centurion:centurion /app
USER centurion

EXPOSE 3001

# Health check (used by docker-compose depends_on condition)
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
