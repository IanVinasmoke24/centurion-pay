# ============================================================
# Proyecto Centurion – Frontend Dockerfile
# Multi-stage: Vite build → Nginx SPA host
# ============================================================

# ── Stage 1: builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy all source files and build
COPY . .
RUN npm run build
# Output lands in /app/dist

# ── Stage 2: Nginx runtime ───────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove default Nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build artefacts
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Nginx runs on port 3000 (non-standard, matches docker-compose)
EXPOSE 3000

# Nginx is the entrypoint; no CMD override needed
CMD ["nginx", "-g", "daemon off;"]
