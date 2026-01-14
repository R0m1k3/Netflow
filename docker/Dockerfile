# Unified Dockerfile: Frontend + Backend in one container

# ========================================
# Stage 1: Build Frontend
# ========================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/web_frontend

# Copy frontend package files
COPY web_frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy frontend source and build
COPY web_frontend/ ./
RUN npm run build

# ========================================
# Stage 2: Build Backend
# ========================================
FROM node:20-slim AS backend-builder
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy backend source and build
COPY backend/ ./
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# ========================================
# Stage 3: Runtime (Single Container)
# ========================================
FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create directories for DB and caches
RUN mkdir -p /app/backend/data && mkdir -p /app/cache/images

# Copy backend artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package*.json ./backend/

# Copy frontend build (served by backend)
COPY --from=frontend-builder /app/web_frontend/dist ./web_frontend/dist

WORKDIR /app/backend

EXPOSE 3001

ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["node", "dist/server.js"]
