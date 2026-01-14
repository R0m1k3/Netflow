import { Router, Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../db/data-source';
import { User, UserSettings } from '../db/entities';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { encryptForUser, decryptForUser, isEncrypted } from '../utils/crypto';

const router = Router();
const logger = createLogger('settings');





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
