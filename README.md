# Netflow

Netflow is a modern, responsive web client for Plex, built with a focus on performance and user experience. It features a React-based frontend and a robust Express backend that handles API proxying and caching.

## Features

### Frontend (`web_frontend`)
- **Modern UI**: Built with React, Vite, and Tailwind CSS.
- **Responsive Design**: Optimized for various screen sizes.
- **Media Playback**: Integrated player with `hls.js` and `react-player`.
- **Internationalization**: Full i18n support.
- **Smart Search**: Unified search across Plex libraries and TMDB.

### Backend (`backend`)
- **API Proxy**: Secure proxy for Plex and TMDB API requests.
- **Caching**: Intelligent caching layer to reduce API hits and improve speed.
- **Database**: SQLite with TypeORM for persisting local data.
- **Security**: Helmet, CORS, and rate limiting configured.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/R0m1k3/Netflow.git
   cd Netflow
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Development Server

The easiest way to start both the frontend and backend in development mode is from the `web_frontend` directory:

```bash
cd web_frontend
npm run dev:all
```

This command concurrently runs:
- Frontend at `http://localhost:5173` (typically)
- Backend server

Alternatively, you can run them separately:

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd web_frontend
npm run dev
```

## Structure

- `web_frontend/`: React application source code.
- `backend/`: Express server source code.
- `packages/`: Shared packages (monorepo structure).

## License

See [LICENSE.md](LICENSE.md) for details.
