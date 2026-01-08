import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetflowCore } from '@netflow/core';
import { MobileStorage } from './MobileStorage';
import { MobileSecureStorage } from './MobileSecureStorage';
import { MobileCache } from './MobileCache';
import { loadAppSettings } from './SettingsData';

// Default API Keys - can be overridden by user in settings
const DEFAULT_TMDB_API_KEY = 'db55323b8d3e4154498498a75642b381';
const TRAKT_CLIENT_ID = '4ab0ead6d5510bf39180a5e1dd7b452f5ad700b7794564befdd6bca56e0f7ce4';
const TRAKT_CLIENT_SECRET = ''; // Add your Trakt client secret

// Generate or retrieve a persistent client ID
const CLIENT_ID_KEY = 'netflow_client_id';

async function getOrCreateClientId(): Promise<string> {
  let clientId = await AsyncStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    // Generate a UUID-like client identifier
    clientId =
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    await AsyncStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

// Singleton instance
let netflowCoreInstance: NetflowCore | null = null;

/**
 * Initialize and get the NetflowCore instance
 */
export async function initializeNetflowCore(): Promise<NetflowCore> {
  if (netflowCoreInstance) {
    return netflowCoreInstance;
  }

  const clientId = await getOrCreateClientId();

  // Load settings to get custom TMDB API key if set
  const settings = await loadAppSettings();
  const tmdbApiKey = settings.tmdbApiKey || DEFAULT_TMDB_API_KEY;
  const tmdbLanguage = settings.tmdbLanguagePreference
    ? settings.tmdbLanguagePreference.includes('-')
      ? settings.tmdbLanguagePreference
      : `${settings.tmdbLanguagePreference}-US`
    : 'en-US';

  const storage = new MobileStorage();
  const secureStorage = new MobileSecureStorage(AsyncStorage);
  const cache = new MobileCache();

  netflowCoreInstance = new NetflowCore({
    storage,
    secureStorage,
    cache,
    clientId,
    productName: 'Netflow',
    productVersion: '1.0.0',
    platform: 'iOS', // or detect dynamically
    deviceName: 'Netflow Mobile',
    tmdbApiKey: tmdbApiKey,
    traktClientId: TRAKT_CLIENT_ID,
    traktClientSecret: TRAKT_CLIENT_SECRET,
    language: tmdbLanguage,
  });

  // Initialize (restore sessions)
  await netflowCoreInstance.initialize();

  return netflowCoreInstance;
}

/**
 * Reinitialize NetflowCore with updated settings (e.g., new TMDB API key)
 * This clears the existing instance and creates a new one
 */
export async function reinitializeNetflowCore(): Promise<NetflowCore> {
  netflowCoreInstance = null;
  return initializeNetflowCore();
}

/**
 * Get the NetflowCore instance (must be initialized first)
 */
export function getNetflowCore(): NetflowCore {
  if (!netflowCoreInstance) {
    throw new Error('NetflowCore not initialized. Call initializeNetflowCore first.');
  }
  return netflowCoreInstance;
}

// Re-export for convenience
export { MobileStorage } from './MobileStorage';
export { MobileSecureStorage } from './MobileSecureStorage';
export { MobileCache } from './MobileCache';

// High-level mobile API
export {
  NetflowMobile,
  initializeNetflowMobile,
  getNetflowMobile,
  type MobileHomeData,
  type LibraryItemsResult,
} from './NetflowMobile';

// React Context and Hooks
// React Context and Hooks
export { NetflowProvider, useNetflow, useRequireNetflow } from './NetflowContext';
