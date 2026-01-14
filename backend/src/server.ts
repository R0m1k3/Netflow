import 'reflect-metadata';
import express, { Express } from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { TypeormStore } from 'connect-typeorm';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { AppDataSource, initializeDatabase } from './db/data-source';
import { Session } from './db/entities';
import { cacheManager } from './services/cache/CacheManager';
import logger from './utils/logger';
import { getSecret } from './utils/secret'; // Original path
import { authRouter } from './api/auth';
import cacheRoutes from './api/cache';
import imageProxyRoutes from './api/image-proxy';
import tmdbRoutes from './api/tmdb';
import plexRoutes from './api/plex';
import traktRoutes from './api/trakt';
import plextvRoutes from './api/plextv';
import { settingsRouter } from './api/settings';
import { errorHandler } from './middleware/errorHandler';
// Import dependencies for seeding
import bcrypt from 'bcrypt';
import { User, UserSettings } from './db/entities';
import { requestLogger } from './middleware/requestLogger';

const serverLogger = logger.child({ component: 'server' });

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Create Express app
    const app: Express = express();
    const PORT = parseInt(process.env.PORT || '3001', 10);
    const HOST = process.env.HOST || '0.0.0.0';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const frontendUrlObj = new URL(FRONTEND_URL);
    const isHttpsFrontend = frontendUrlObj.protocol === 'https:';
    const cookieSameSiteEnv = (process.env.SESSION_SAMESITE || '').toLowerCase();
    const cookieSameSite = (cookieSameSiteEnv === 'lax' || cookieSameSiteEnv === 'strict' || cookieSameSiteEnv === 'none')
      ? cookieSameSiteEnv
      : (isHttpsFrontend ? 'none' : 'lax');
    const cookieSecureEnv = (process.env.SESSION_SECURE || '').toLowerCase();
    const cookieSecure = cookieSecureEnv === 'true' ? true : cookieSecureEnv === 'false' ? false : isHttpsFrontend;

    // Trust proxy (for secure cookies behind reverse proxy)
    app.set('trust proxy', 1);

    // Basic middleware
    app.use(compression());
    app.use(helmet({
      contentSecurityPolicy: false, // We'll handle CSP separately
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images/media to be embedded from this server
    }));

    // CORS configuration
    app.use(cors({
      origin: FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        // Allow legacy Trakt headers if the browser sends them in preflight
        'trakt-api-key',
        'trakt-api-version',
      ],
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Request logging
    app.use(requestLogger);

    // Session configuration
    const sessionRepository = AppDataSource.getRepository(Session);
    app.use(session({
      secret: getSecret(),
      resave: false,
      saveUninitialized: false,
      store: new TypeormStore({
        cleanupLimit: 2,
        limitSubquery: false,
        ttl: 86400, // 1 day in seconds
      }).connect(sessionRepository),
      cookie: {
        secure: cookieSecure,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: cookieSameSite as any,
      },
      name: 'plex.sid',
    }));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        database: AppDataSource.isInitialized ? 'connected' : 'disconnected',
      });
    });

    // API routes
    app.use('/api/auth', authRouter);
    app.use('/api/cache', cacheRoutes);
    app.use('/api/image', imageProxyRoutes);
    app.use('/api/tmdb', tmdbRoutes);
    app.use('/api/plex', plexRoutes);
    app.use('/api/trakt', traktRoutes);
    app.use('/api/plextv', plextvRoutes);
    app.use('/api/settings', settingsRouter);

    // 404 handler
    // Serve static files from frontend
    const frontendDist = path.join(__dirname, '../../web_frontend/dist');
    app.use(express.static(frontendDist));

    // Handle client-side routing by serving index.html for all other routes
    app.get('*', (req: express.Request, res: express.Response) => {
      // Don't serve index.html for API requests that weren't caught
      if (req.path.startsWith('/api')) {
        res.status(404).json({
          error: 'Not Found',
          message: `Cannot ${req.method} ${req.path}`,
        });
        return;
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });

    // Seed default admin user
    try {
      if (AppDataSource.isInitialized) {
        const userRepository = AppDataSource.getRepository(User);
        const count = await userRepository.count();
        if (count === 0) {
          const hashedPassword = await bcrypt.hash('admin', 10);
          const admin = userRepository.create({
            username: 'admin',
            email: 'admin@local.host',
            password: hashedPassword,
            hasPassword: true,
            // Create empty settings
            settings: new UserSettings()
          });
          await userRepository.save(admin);

          // Initialize settings
          const settingsRepository = AppDataSource.getRepository(UserSettings);
          const settings = settingsRepository.create({
            userId: admin.id,
            preferences: {
              language: 'en',
              autoPlay: true,
              quality: 'auto',
              subtitles: false,
              theme: 'dark',
            },
          });
          await settingsRepository.save(settings);

          serverLogger.info('Default admin user created (admin/admin)');
        }
      }
    } catch (err) {
      serverLogger.error('Failed to seed default user', err);
    }

    // Start server
    app.listen(PORT, HOST, () => {
      serverLogger.info(`🚀 Server running at http://${HOST}:${PORT}`);
      serverLogger.info(`📝 Environment: ${process.env.NODE_ENV}`);
      serverLogger.info(`🗄️  Database: ${process.env.DATABASE_PATH}`);
      serverLogger.info(`🔐 Session store: TypeORM/SQLite`);
    });

    // Error handling middleware (must be last)
    app.use(errorHandler);



    // Graceful shutdown
    process.on('SIGTERM', async () => {
      serverLogger.info('SIGTERM signal received: closing server');
      await AppDataSource.destroy();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      serverLogger.info('SIGINT signal received: closing server');
      await AppDataSource.destroy();
      process.exit(0);
    });

  } catch (error) {
    serverLogger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
