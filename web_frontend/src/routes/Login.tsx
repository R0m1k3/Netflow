import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/api'; // Removed checkAuth import
import { useAuth } from '@/services/auth'; // Added useAuth import
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { t } = useTranslation();
  const nav = useNavigate();
  // Use global auth state to ensure App.tsx and Login.tsx are in sync
  const { isAuthenticated, checkAuth } = useAuth();

  const [status, setStatus] = useState('Initializing...');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [pinId, setPinId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      nav('/');
    } else {
      // If we landed here but might be valid, check (e.g. refresh)
      // But App.tsx already checks on mount.
      // Just set status to ready.
      setStatus('Ready to sign in');
    }
  }, [isAuthenticated, nav]);

  async function startPlexAuth() {
    try {
      // Open a placeholder window immediately to satisfy mobile popup blockers
      const placeholder = window.open('about:blank', '_blank');

      setIsAuthenticating(true);
      setStatus('Creating authentication request...');

      // Create PIN with backend
      const pinData = await apiClient.createPlexPin();
      setPinId(pinData.id);
      setClientId(pinData.clientId);
      setAuthUrl(pinData.authUrl);

      // Navigate placeholder to Plex auth if available
      if (placeholder) {
        setStatus('Opening Plex sign-in window...');
        try {
          placeholder.location.href = pinData.authUrl;
        } catch {
          try { placeholder.close(); } catch { }
          setStatus('Popup blocked. Tap “Open Plex sign‑in”.');
        }
      } else {
        setStatus('Popup blocked. Tap “Open Plex sign‑in”.');
      }

      // Start polling for authentication
      setStatus('Waiting for Plex authorization...');
      const pollInterval = setInterval(async () => {
        try {
          const result = await apiClient.checkPlexPin(pinData.id, pinData.clientId);

          if (result.authenticated) {
            clearInterval(pollInterval);
            setStatus('Authentication successful! Syncing session...');

            // CRITICAL: Update global auth store before redirecting
            await checkAuth();

            // Redirect will happen automatically via useEffect when isAuthenticated becomes true
            // status update just for visual feedback until redirect happens
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isAuthenticating) {
          setStatus('Authentication timed out. Please try again.');
          setIsAuthenticating(false);
        }
      }, 120000);

    } catch (err) {
      console.error('Failed to start Plex auth:', err);
      setStatus('Failed to start authentication. Please try again.');
      setIsAuthenticating(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Branded background */}
      <div className="app-bg-fixed bg-home-gradient" />

      <div className="w-full max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
        {/* Brand panel */}
        <div className="hidden md:block">
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-white/10 to-white/0 blur-2xl" />
            <div className="relative z-10">
              <div className="inline-flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-extrabold tracking-tight text-brand">NETFLOW</span>
                <span className="text-sm px-2 py-1 rounded bg-white/10 text-white/80 align-middle">web</span>
              </div>
              <h2 className="text-2xl md:text-3xl text-white/90 font-semibold leading-tight mb-4">A Netflix‑quality Plex client</h2>
              <p className="text-neutral-300/90 text-sm leading-6 max-w-md">
                Sign in with Plex to access your libraries, resume playback, and sync your watch activity. Secure OAuth via your Plex account.
              </p>
            </div>
          </div>
        </div>

        {/* Auth card */}
        <div className="max-w-md w-full md:ml-auto">
          <div className="bg-neutral-900/50 rounded-2xl ring-1 ring-white/10 backdrop-blur-md p-8 shadow-2xl">
            {/* Logo/Title */}
            <div className="text-left mb-8 md:mb-10">
              <div className="md:hidden mb-3">
                <span className="text-4xl font-extrabold tracking-tight text-brand">NETFLOW</span>
              </div>
              <h1 className="text-2xl font-semibold text-white">{t('auth.sign_in')}</h1>
              <p className="text-sm text-neutral-400">{t('auth.use_plex_account')}</p>
            </div>

            {/* Status Message */}
            <div className="mb-6">
              <p className="text-xs text-neutral-300/90">{status}</p>
            </div>

            {/* Sign In Button */}
            {!isAuthenticating ? (
              <button
                onClick={startPlexAuth}
                className="w-full btn-primary h-11 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-md"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 2C2.9 2 2 2.9 2 4V20C2 21.1 2.9 22 4 22H20C21.1 22 22 21.1 22 20V4C22 2.9 21.1 2 20 2H4M8 8L16 12L8 16V8Z" />
                </svg>
                {t('auth.login_plex')}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                </div>
                {authUrl && (
                  <div className="text-center">
                    <a
                      href={authUrl}
                      target="_blank"
                      rel="noopener"
                      onClick={(e) => { e.preventDefault(); try { window.open(authUrl, '_blank'); } catch { } }}
                      className="inline-flex items-center justify-center text-sm text-brand hover:text-brand-400 underline"
                    >
                      {t('auth.open_plex_sign_in')}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Help Text */}
            <div className="mt-8 text-center text-xs text-neutral-500">
              <p>{t('auth.no_account')}</p>
              <a
                href="https://www.plex.tv/sign-up"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:text-brand-600 underline"
              >
                {t('auth.create_account')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
