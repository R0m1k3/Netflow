# Netflow

Netflow is a modern, high-performance web client for Plex. It provides a sleek, responsive interface for your media library, powered by a lightweight React frontend and a robust Express backend proxy.

![Netflow Banner](https://raw.githubusercontent.com/R0m1k3/Netflow/main/docs/banner.png)

## ✨ Features

- **🚀 High Performance**: Built with Vite and optimized for speed.
- **📱 Responsive**: Fully responsive design that works great on desktop, tablet, and mobile.
- **🔍 Unified Search**: Search across all your Plex libraries and TMDB simultaneously.
- **⏯️ Modern Player**: Integrated HLS player with support for subtitles and audio tracks.
- **🎨 Modern UI**: Beautiful dark interface with smooth animations (Tailwind CSS).
- **🌍 Internationalization**: Native support for multiple languages.
- **🔒 Backend Proxy**: Hides your Plex tokens and provides intelligent caching.

## 🐳 Docker Installation (Recommended)

The easiest way to run Netflow is using Docker. We provide a production-ready image that bundles both the frontend (served via Nginx) and the backend.

### Quick Start with Docker Compose

1. Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  netflow:
    image: ghcr.io/r0m1k3/netflow:main
    container_name: netflow
    environment:
      - NODE_ENV=production
      - SESSION_SECRET=your_secure_random_string_here
    ports:
      - "8080:80"
    volumes:
      - netflow-config:/app/config
      - netflow-cache:/app/cache
    restart: unless-stopped

volumes:
  netflow-config:
  netflow-cache:
```

2. Start the container:
   ```bash
   docker-compose up -d
   ```

3. Access Netflow at `http://localhost:8080`.

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SESSION_SECRET` | Secret key for session encryption. Leave empty to auto-generate a persistent secret in `/app/config/secret.key`. | No | Auto-generated |
| `PORT` | Internal port for the backend. | No | 3001 |
| `NODE_ENV` | Environment mode (`production` or `development`). | No | production |

### Volumes

- **/app/config**: Stores persistent configuration (like device ID).
- **/app/cache**: Stores API response caches to reduce load on your Plex server.

## 🛠️ Manual Installation (Development)

If you want to contribute or modify the code, you can run it locally or use the development Docker setup.

### Prerequisites
- Node.js v18+
- npm

### Option A: Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/R0m1k3/Netflow.git
   cd Netflow
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode:**
   This usually runs the frontend and backend concurrently.
   ```bash
   cd web_frontend
   npm run dev:all
   ```
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`

### Option B: Docker for Development

To run the frontend and backend as separate containers (useful for dev):

```bash
docker-compose -f docker-compose.yml up --build
```

This uses the local source code and generic `Dockerfile`s to spin up a dev environment.

## 🏗️ Architecture

Netflow consists of two main parts:

1.  **Frontend (`web_frontend`)**: A Single Page Application (SPA) built with React, TypeScript, and Vite. It communicates *only* with the Netflow Backend, never directly with Plex (except for streaming media content in some cases).
2.  **Backend (`backend`)**: An Express.js server that acts as a proxy/BFF (Backend for Frontend). It handles:
    -   Plex Authentication (hiding tokens from the client storage where possible).
    -   API Caching (using caching middleware to speed up library browsing).
    -   Data transformation.

## 📄 License

This project is licensed under the MIT License - see the `LICENSE` file for details.
