import { Router, Response } from 'express';
import { AppDataSource } from '../db/data-source';
import { User } from '../db/entities';
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
            return res.json({ configured: false });
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

        res.json({
            configured: true,
            config
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
            manual: manual !== false // Default to true if not specified
        };

        // Also update plexToken column for backward compatibility if needed, 
        // but we generally rely on plexConfig for manual mode.
        // user.plexToken = encryptedToken; 

        await userRepository.save(user);

        logger.info(`Updated manual Plex config for user ${user.username}`);

        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to save plex config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

export { router as settingsRouter };
