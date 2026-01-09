import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const configDir = process.env.CONFIG_DIRECTORY || './config';
const secretPath = path.join(configDir, 'secret.key');

/**
 * Gets a stable session secret.
 * 1. Returns SESSION_SECRET if provided in env.
 * 2. Otherwise, returns/generates a secret key stored in the persistent config volume.
 */
export function getStableSecret(): string {
    // Priority 1: Environment variable
    if (process.env.SESSION_SECRET) {
        return process.env.SESSION_SECRET;
    }

    // Priority 2: Persistent file
    try {
        if (fs.existsSync(secretPath)) {
            const secret = fs.readFileSync(secretPath, 'utf8').trim();
            if (secret) return secret;
        }
    } catch (err) {
        console.error('[StableSecret] Failed to read secret file:', err);
    }

    // Priority 3: Generate and save new secret
    try {
        const newSecret = crypto.randomBytes(64).toString('hex');

        // Ensure directory exists
        const dir = path.dirname(secretPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(secretPath, newSecret, { mode: 0o600 });
        console.info('[StableSecret] Generated and persisted new stable secret to:', secretPath);
        return newSecret;
    } catch (err) {
        console.error('[StableSecret] Failed to persist new secret:', err);
        // Absolute fallback for this execution only (will cause disconnection on next restart)
        return 'fallback-volatile-secret-' + Date.now();
    }
}

let cachedSecret: string | null = null;

export function getSecret(): string {
    if (!cachedSecret) {
        cachedSecret = getStableSecret();
    }
    return cachedSecret;
}
