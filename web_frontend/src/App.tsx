import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import TopNav from '@/components/TopNav';
import GlobalToast from '@/components/GlobalToast';
import { useAuth } from '@/services/auth';

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
