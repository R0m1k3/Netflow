import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import TopNav from '@/components/TopNav';
import GlobalToast from '@/components/GlobalToast';
import { useAuth } from '@/services/auth';
import api from '@/services/api';
import { saveSettings } from '@/state/settings';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlayerRoute = location.pathname.includes('/player/');
  const isDetailsRoute = location.pathname.includes('/details/');
  const isHome = location.pathname === '/';
  const isAuthRoute = location.pathname.startsWith('/login');
  const isSetupRoute = location.pathname.startsWith('/setup');

  const { isAuthenticated, isLoading, checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, []);

  // Pre-load settings when authenticated to ensure localStorage is populated
  useEffect(() => {
    if (isAuthenticated) {
      api.get('/settings/plex').then(res => {
        // Handle both response formats seen in SettingsPage
        const data = res.value || res; // Handle Promise.allSettled style or direct
        const cfg = data.config || (data.configured ? data.config : null);

        if (cfg) {
          console.log('[App] Pre-loaded Plex settings', cfg);
          saveSettings({
            plexBaseUrl: `${cfg.protocol}://${cfg.host}:${cfg.port}`,
            plexToken: cfg.token,
            plexServer: {
              name: 'Manual',
              clientIdentifier: 'manual',
              baseUrl: `${cfg.protocol}://${cfg.host}:${cfg.port}`,
              token: cfg.token
            }
          });
          // Dispatch event to update listeners
          window.dispatchEvent(new Event('plex-server-changed'));
        }
      }).catch(e => console.error('[App] Failed to pre-load settings', e));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthRoute) {
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [isLoading, isAuthenticated, isAuthRoute, navigate, location]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/search');
      }
      // ESC to go back from search
      if (e.key === 'Escape' && location.pathname === '/search') {
        e.preventDefault();
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location]);

  if (isLoading) {
    return <div className="min-h-screen app-bg-fixed bg-black flex items-center justify-center text-zinc-500">Chargement...</div>;
  }

  // Prevent rendering protected routes while redirecting
  if (!isAuthenticated && !isAuthRoute) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Global fixed background layer */}
      <div className="app-bg-fixed bg-home-gradient" />
      <GlobalToast />
      {!isPlayerRoute && !isAuthRoute && <TopNav />}
      <main className={`flex-1 ${!isPlayerRoute && !isHome && !isDetailsRoute && !isAuthRoute ? 'pt-16' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
