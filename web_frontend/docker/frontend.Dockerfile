# Frontend Dockerfile (Vite build + Nginx static server)

# 1) Build stage (Node)
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npm run build

# 2) Runtime stage (Node serve)
FROM node:20-slim AS runner
WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built static assets
COPY --from=builder /app/dist ./dist

EXPOSE 80
CMD ["serve", "-s", "dist", "-l", "80"]

