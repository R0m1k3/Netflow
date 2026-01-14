import { Router, Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../db/data-source';
import { User, UserSettings } from '../db/entities';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { encryptForUser, decryptForUser, isEncrypted } from '../utils/crypto';

const router = Router();
const logger = createLogger('settings');

// Get manual Plex configuration
router.get('/plex', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id: req.user!.id },
            select: ['plexConfig'] // Explicitly select it as it might be select: false in entity
        });

        if (!user?.plexConfig) {
            return res.json({ configured: false, config: {} });
        }

        // Decrypt token if needed (if we decide to encrypt it in plexConfig)
        // For now, assuming plexConfig stores it (we should probably encrypt it)
        // Let's assume we handle encryption on save.

        const config = { ...user.plexConfig };
        if (config.token && isEncrypted(config.token)) {
            try {
                config.token = decryptForUser(req.user!.id, config.token);
            } catch (e) {
                logger.error('Failed to decrypt plex token in settings', e);
                config.token = ''; // Clear if invalid
            }
        }

        // Check if fully configured
        const isConfigured = !!(config.host && config.port && config.token);

        res.json({
            configured: isConfigured,
            config: config // Return whatever we have
        });
    } catch (error) {
        logger.error('Failed to get plex config:', error);
        res.status(500).json({ error: 'Failed to retrieve configuration' });
    }
});

// Update manual Plex configuration
router.post('/plex', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { host, port, protocol, token, manual } = req.body;

        // Validate
        if (!host || !port || !token) {
            return res.status(400).json({ error: 'Host, port, and token are required' });
        }

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: req.user!.id } });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Encrypt token
        const encryptedToken = encryptForUser(user.id, token);

        user.plexConfig = {
            host,
            port: Number(port),
            protocol: protocol || 'http',
            token: encryptedToken,
            manual: manual !== false
        };

        // Also update the main plexToken so discovery works
        user.plexToken = encryptedToken;

        await userRepository.save(user);

        // SYNC TO USER SETTINGS so getPlexClient works
        const settingsRepository = AppDataSource.getRepository(UserSettings);
        let settings = await settingsRepository.findOne({ where: { userId: user.id } });

        if (!settings) {
            settings = settingsRepository.create({ userId: user.id });
        }

        // Create a manual server entry
        const manualServerId = 'manual-server';
        const manualServer = {
            id: manualServerId,
            name: `Manual (${host})`,
            host: host,
            port: Number(port),
            protocol: protocol || 'http',
            owned: true,
            accessToken: encryptedToken,
            publicAddress: host,
            localAddresses: [host],
            preferredUri: `${protocol || 'http'}://${host}:${port}`,
            connections: [{
                uri: `${protocol || 'http'}://${host}:${port}`,
                address: host,
                port: Number(port),
                protocol: protocol || 'http',
                local: true
            }]
        };

        // Update or add to plexServers
        const existingServers = settings.plexServers || [];
        const otherServers = existingServers.filter((s: any) => s.id !== manualServerId);
        settings.plexServers = [manualServer, ...otherServers];

        // Auto-select manual server
        settings.currentServerId = manualServerId;

        await settingsRepository.save(settings);

        logger.info(`Updated manual Plex config for user ${user.username}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to save plex config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Update generic preferences
router.post('/preferences', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { listProvider, language, theme, autoPlay, quality, subtitles } = req.body;

        const settingsRepository = AppDataSource.getRepository(UserSettings);
        let settings = await settingsRepository.findOne({ where: { userId: req.user!.id } });

        if (!settings) {
            settings = settingsRepository.create({ userId: req.user!.id });
        }

        settings.preferences = {
            ...settings.preferences,
            ...(language && { language }),
            ...(theme && { theme }),
            ...(typeof autoPlay === 'boolean' && { autoPlay }),
            ...(quality && { quality }),
            ...(typeof subtitles === 'boolean' && { subtitles }),
            ...(listProvider && { listProvider }), // Add custom fields
        } as any;

        await settingsRepository.save(settings);
        res.json({ success: true, preferences: settings.preferences });
    } catch (error) {
        logger.error('Failed to save preferences:', error);
        res.status(500).json({ error: 'Failed to save preferences' });
    }
});

// Get generic preferences
router.get('/preferences', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const settingsRepository = AppDataSource.getRepository(UserSettings);
        const settings = await settingsRepository.findOne({ where: { userId: req.user!.id } });
        res.json(settings?.preferences || {});
    } catch (error) {
        logger.error('Failed to get preferences:', error);
        res.status(500).json({ error: 'Failed to retrieve preferences' });
    }
});

// Test Plex Configuration
router.post('/test/plex', requireAuth, async (req: Request, res: Response) => {
    try {
        const { host, port, protocol, token } = req.body;
        if (!host || !port || !token) {
            logger.warn('Plex test missing parameters', { host: !!host, port: !!port, token: !!token });
            return res.status(400).json({ error: 'Missing parameters', details: `Host: ${!!host}, Port: ${!!port}, Token: ${!!token}` });
        }

        // Simple test: try to fetch identity or server info
        const url = `${protocol}://${host}:${port}/identity`;
        const response = await axios.get(url, {
            headers: { 'X-Plex-Token': token },
            timeout: 5000
        });

        res.json({ success: true, data: response.data });
    } catch (error: any) {
        logger.warn('Plex connection test failed:', error.message);
        res.status(400).json({ success: false, error: 'Connection failed', details: error.message });
    }
});

// Get Trakt Status
router.get('/trakt/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { TraktClient } = await import('../services/trakt/TraktClient');
        const client = new TraktClient(req.user!.id);

        // Try to get profile or tokens check
        try {
            const profile = await client.userProfile();
            res.json({ connected: true, username: profile.username });
        } catch (e: any) {
            // 404/401 means not connected or invalid
            const isAuthError = e?.response?.status === 401 || e?.response?.status === 403 || e?.response?.status === 404;
            if (isAuthError) {
                res.json({ connected: false });
            } else {
                throw e;
            }
        }
    } catch (error) {
        logger.error('Failed to check trakt status:', error);
        res.json({ connected: false });
    }
});

export { router as settingsRouter };
