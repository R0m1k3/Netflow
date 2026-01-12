import Billboard from '@/components/Billboard';
import HomeHero from '@/components/HomeHero';
import Row from '@/components/Row';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSettings, saveSettings } from '@/state/settings';
import { apiClient, checkAuth } from '@/services/api';
import { tmdbTrending, tmdbImage, tmdbVideos, tmdbImages, tmdbDetails } from '@/services/tmdb';
import { traktTrending, isTraktAuthenticated } from '@/services/trakt';
import { plexPartUrl } from '@/services/plex';
import { plexBackendOnDeckGlobal, plexBackendContinue, plexBackendLibraries, plexBackendLibrarySecondary, plexBackendDir, plexBackendLibraryAll, plexBackendMetadataWithExtras } from '@/services/plex_backend';
import BrowseModal from '@/components/BrowseModal';
import { plexTvWatchlist } from '@/services/plextv';
import SectionBanner from '@/components/SectionBanner';
import { TraktSection } from '@/components/TraktSection';
import { useTranslation } from 'react-i18next';

type Item = {
  id: string;
  title: string;
  image?: string;
  subtitle?: string;
  badge?: string;
  tmdbId?: string;
  itemType?: 'movie' | 'show';
};

export default function Home() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<{ title: string; items: Item[]; variant?: 'default' | 'continue' }>>([]);
  const [needsPlex, setNeedsPlex] = useState(false);
  const [hero, setHero] = useState<{ title: string; overview?: string; poster?: string; backdrop?: string; rating?: string; videoUrl?: string; ytKey?: string; id?: string; year?: string; runtime?: number; genres?: string[]; logoUrl?: string } | null>(null);
  const genreRows: Array<{ label: string; type: 'movie' | 'show'; genre: string }> = [
    { label: t('home.genre_shows_children'), type: 'show', genre: 'Children' },
    { label: t('home.genre_movies_music'), type: 'movie', genre: 'Music' },
    { label: t('home.genre_movies_documentary'), type: 'movie', genre: 'Documentary' },
    { label: t('home.genre_movies_history'), type: 'movie', genre: 'History' },
    { label: t('home.genre_shows_reality'), type: 'show', genre: 'Reality' },
    { label: t('home.genre_movies_drama'), type: 'movie', genre: 'Drama' },
    { label: t('home.genre_shows_suspense'), type: 'show', genre: 'Suspense' },
    { label: t('home.genre_movies_animation'), type: 'movie', genre: 'Animation' },
  ];

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return; // prevent StrictMode double-run flicker
    didInit.current = true;

    // Check backend authentication first
    (async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        nav('/login');
        return;
      }

      // Get servers from backend
      try {
        const servers = await apiClient.getServers();
        if (servers.length > 0) {
          const server = servers[0];
          saveSettings({
            plexBaseUrl: server.baseUrl,
            plexToken: server.token,
            plexServer: {
              name: server.name,
              clientIdentifier: server.clientIdentifier,
              baseUrl: server.baseUrl,
              token: server.token
            }
          });
        }
      } catch (err) {
        console.error('Failed to get servers:', err);
      }

      // Continue with loading content
      run();
    })();

    async function run() {
      try {
        let s = loadSettings();

        // Use default TMDB API key if not configured
        if (!s.tmdbBearer) {
          const DEFAULT_TMDB_KEY = 'db55323b8d3e4154498498a75642b381';
          saveSettings({ tmdbBearer: DEFAULT_TMDB_KEY });
          s = loadSettings();
        }

        // Shared lazy-loaded libraries (for Genre rows and Plex Hero)
        const librariesPromise = (s.plexBaseUrl && s.plexToken) ? plexBackendLibraries().catch(() => null) : Promise.resolve(null);

        // 1. TMDB Rows & Hero
        const tmdbTask = async () => {
          const rows: any[] = [];
          let hero: any | null = null;
          let heroLogo: string | undefined = undefined;

          if (s.tmdbBearer) {
            try {
              const tmdb = await tmdbTrending(s.tmdbBearer, 'tv', 'week');
              const results = (tmdb as any).results || [];
              const items: Item[] = results.slice(0, 16).map((r: any) => ({
                id: `tmdb:tv:${String(r.id)}`,
                title: r.name || r.title,
                image: tmdbImage(r.backdrop_path, 'w780') || tmdbImage(r.poster_path, 'w500'),
                badge: r.vote_average ? `⭐ ${r.vote_average.toFixed(1)}` : undefined,
                tmdbId: String(r.id),
                itemType: 'show'
              }));
              rows.push({ title: t('home.popular_plex'), items: items.slice(0, 8) });
              rows.push({ title: t('home.trending_now'), items: items.slice(8, 16) });

              // TMDB Hero Logic
              if (results.length > 0) {
                const f = results[0];
                const [vids, details, imgs] = await Promise.all([
                  tmdbVideos(s.tmdbBearer!, 'tv', String(f.id)).catch(() => ({})),
                  tmdbDetails(s.tmdbBearer!, 'tv', String(f.id)).catch(() => ({})),
                  tmdbImages(s.tmdbBearer!, 'tv', String(f.id), 'en,null').catch(() => ({}))
                ]);

                const ytKey = ((vids as any).results || []).find((v: any) => v.site === 'YouTube')?.key;
                const genres = ((details as any).genres || []).map((g: any) => g.name);
                const year = ((details as any).first_air_date || '').slice(0, 4);
                const runtime = (details as any).episode_run_time?.[0];
                const logo = ((imgs as any).logos || []).find((l: any) => l.iso_639_1 === 'en') || ((imgs as any).logos || [])[0];
                if (logo?.file_path) heroLogo = tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original');

                hero = {
                  title: f.name || f.title,
                  overview: f.overview,
                  poster: tmdbImage(f.poster_path, 'w500') || undefined,
                  backdrop: tmdbImage(f.backdrop_path, 'w1280') || undefined,
                  rating: f.vote_average ? `⭐ ${f.vote_average.toFixed(1)}` : undefined,
                  ytKey,
                  id: `tmdb:tv:${String(f.id)}`,
                  genres,
                  year,
                  runtime
                };
              }
            } catch (e) { console.error('TMDB error', e); }
          } else {
            // Fallback
            const landscape = Array.from({ length: 16 }).map((_, i) => ({ id: 'ph' + i, title: `Sample ${i + 1}`, image: `https://picsum.photos/seed/land${i}/800/400` }));
            rows.push({ title: t('home.popular_plex'), items: landscape.slice(0, 8) });
            rows.push({ title: t('home.trending_now'), items: landscape.slice(8, 16) });
          }
          return { rows, hero, heroLogo };
        };

        // 2. Plex Continue Watching
        const plexContinueTask = async () => {
          if (!s.plexBaseUrl || !s.plexToken) return null;
          console.info('[Home] Using backend for Plex reads');
          try {
            const deck: any = await plexBackendContinue();
            const meta = deck?.MediaContainer?.Metadata || [];
            const items: any[] = meta.slice(0, 10).map((m: any, i: number) => {
              const p = m.thumb || m.parentThumb || m.grandparentThumb || m.art;
              const img = apiClient.getPlexImageNoToken(p || '');
              const duration = (m.duration || 0) / 1000;
              const vo = (m.viewOffset || 0) / 1000;
              const progress = duration > 0 ? Math.min(100, Math.max(1, Math.round((vo / duration) * 100))) : 0;
              return {
                id: `plex:${String(m.ratingKey || i)}`,
                title: m.title || m.grandparentTitle || 'Continue',
                image: img,
                progress,
                badge: m.rating ? `⭐ ${m.rating.toFixed(1)}` : m.contentRating
              };
            });
            return { title: t('home.continue_watching'), items: items as any, variant: 'continue' };
          } catch (e) {
            setNeedsPlex(true);
            return null;
          }
        };

        // 3. Plex Watchlist
        const plexWatchlistTask = async () => {
          try {
            // Basic condition check locally, though fetching handles empty logic
            const wl: any = await plexTvWatchlist();
            const meta = wl?.MediaContainer?.Metadata || [];
            if (!meta.length) return null;
            const wlItems: Item[] = meta.slice(0, 12).map((m: any) => ({
              id: inferIdFromGuid(m) || `${encodeURIComponent(m.tmdbGuid || '')}`,
              title: m.title || m.grandparentTitle || 'Title',
              image: m.Image?.find((img: any) => img.type === 'coverArt' || img.type === 'background')?.url,
              badge: m.rating ? `⭐ ${m.rating.toFixed(1)}` : m.contentRating
            }));
            return { title: t('home.watchlist'), items: wlItems, browseKey: '/plextv/watchlist' };
          } catch { return null; }
        };

        // 4. Plex Genre Rows
        const plexGenresTask = async (libs: any) => {
          if (!libs) return [];
          const dirs = libs?.MediaContainer?.Directory || [];
          const rows: any[] = [];

          // Process genres in parallel
          const genrePromises = genreRows.map(async (gr) => {
            const lib = dirs.find((d: any) => d.type === (gr.type === 'movie' ? 'movie' : 'show'));
            if (!lib) return null;
            try {
              const gens: any = await plexBackendLibrarySecondary(String(lib.key), 'genre');
              const gx = (gens?.MediaContainer?.Directory || []).find((g: any) => String(g.title).toLowerCase() === gr.genre.toLowerCase());
              if (!gx) return null;

              const path = `/library/sections/${lib.key}/genre/${gx.key}`;
              const data: any = await plexBackendDir(path);
              const meta = data?.MediaContainer?.Metadata || [];
              if (!meta.length) return null;

              const items: Item[] = meta.slice(0, 12).map((m: any) => {
                const p = m.thumb || m.parentThumb || m.grandparentThumb || m.art;
                return {
                  id: `plex:${m.ratingKey}`,
                  title: m.title || m.grandparentTitle || 'Title',
                  image: apiClient.getPlexImageNoToken(p || ''),
                  badge: m.rating ? `⭐ ${m.rating.toFixed(1)}` : m.contentRating
                };
              });
              return { title: gr.label, items, browseKey: path };
            } catch { return null; }
          });

          const results = await Promise.all(genrePromises);
          return results.filter(r => r !== null);
        };

        // 5. Plex Hero (Needs libs)
        const plexHeroTask = async (libs: any) => {
          if (!libs || !s.plexBaseUrl || !s.plexToken) return null;
          const dirs = libs?.MediaContainer?.Directory || [];
          const elig = dirs.filter((d: any) => d.type === 'movie' || d.type === 'show');

          // We try up to 8 times to get a hero. We stick to sequential here as we want to stop on first success 
          // and not spam the backend with 8 parallel requests for random items.
          for (let attempts = 0; attempts < 8; attempts++) {
            try {
              const lib = elig[Math.floor(Math.random() * Math.max(1, elig.length))];
              if (!lib) break;
              const t = lib.type === 'movie' ? 1 : 2;
              const res: any = await plexBackendLibraryAll(String(lib.key), { type: t, sort: 'random:desc', offset: 0, limit: 1 });
              const m = res?.MediaContainer?.Metadata?.[0];
              if (!m) continue;

              const meta: any = await plexBackendMetadataWithExtras(String(m.ratingKey));
              const mm = meta?.MediaContainer?.Metadata?.[0];
              if (!mm) continue;

              // Process Hero Metadata
              const pPoster = mm.thumb || mm.parentThumb || mm.grandparentThumb;
              const pBackdrop = mm.art || mm.parentThumb || mm.grandparentThumb || mm.thumb;
              const extra = mm?.Extras?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key as string | undefined;
              const videoUrl = extra ? plexPartUrl(s.plexBaseUrl!, s.plexToken!, extra) : undefined;

              const genres = (mm.Genre || []).map((g: any) => g.tag);
              const year = mm.year ? String(mm.year) : undefined;
              const runtime = mm.duration ? Math.round(mm.duration / 60000) : undefined;
              let heroRating = mm.rating ? `⭐ ${Number(mm.rating).toFixed(1)}` : mm.contentRating || undefined;

              // TMDB Rating Fallback
              let logoUrl: string | undefined = undefined;
              if (s.tmdbBearer) {
                const tmdbGuid = (mm.Guid || []).map((g: any) => String(g.id || ''))
                  .find((g: string) => g.includes('tmdb://') || g.includes('themoviedb://'));
                if (tmdbGuid) {
                  const tid = tmdbGuid.split('://')[1];
                  const mediaType = (mm.type === 'movie') ? 'movie' : 'tv';

                  // Parallelize TMDB details and Images
                  const [details, imgs] = await Promise.all([
                    (!heroRating) ? tmdbDetails(s.tmdbBearer!, mediaType as any, tid).catch(() => null) : Promise.resolve(null),
                    tmdbImages(s.tmdbBearer!, mediaType as any, tid, 'en,null').catch(() => null)
                  ]);

                  if (details?.vote_average) heroRating = `⭐ ${details.vote_average.toFixed(1)}`;

                  const logo = (imgs?.logos || []).find((l: any) => l.iso_639_1 === 'en') || (imgs?.logos || [])[0];
                  if (logo?.file_path) logoUrl = tmdbImage(logo.file_path, 'w500') || tmdbImage(logo.file_path, 'original');
                }
              }

              return {
                title: mm.title || mm.grandparentTitle || 'Title',
                overview: mm.summary,
                poster: apiClient.getPlexImageNoToken(pPoster || ''),
                backdrop: apiClient.getPlexImageNoToken(pBackdrop || ''),
                rating: heroRating,
                videoUrl,
                id: `plex:${String(mm.ratingKey)}`,
                genres,
                year,
                runtime,
                logoUrl
              };
            } catch { }
          }
          return null;
        };

        // EXECUTE EVERYTHING
        // 1. Start Libs fetch
        const libs = await librariesPromise; // Wait for libs as it's a dep for others

        // 2. Run all tasks in parallel
        const [tmdbRes, plexContinue, plexWatchlist, plexGenres, plexHero] = await Promise.all([
          tmdbTask(),
          plexContinueTask(),
          plexWatchlistTask(),
          plexGenresTask(libs),
          plexHeroTask(libs)
        ]);

        // Assemble
        const rowsData: any[] = [];
        if (tmdbRes.rows) rowsData.push(...tmdbRes.rows);
        if (plexContinue) rowsData.splice(1, 0, plexContinue);
        if (plexWatchlist) rowsData.push(plexWatchlist);
        if (plexGenres) rowsData.push(...plexGenres);

        setRows(rowsData);

        const finalHero = plexHero || tmdbRes.hero;
        if (!hero && finalHero) {
          // Merge logo if needed
          if (!finalHero.logoUrl && tmdbRes.heroLogo && !plexHero) finalHero.logoUrl = tmdbRes.heroLogo;
          setHero(finalHero);
          if (finalHero.logoUrl) window.dispatchEvent(new CustomEvent('home-hero-logo', { detail: { logoUrl: finalHero.logoUrl } }));
        }

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // Refresh entire app when server changes
  useEffect(() => {
    const handler = () => window.location.reload();
    // @ts-ignore - CustomEvent typing
    window.addEventListener('plex-server-changed', handler as any);
    return () => {
      // @ts-ignore - CustomEvent typing
      window.removeEventListener('plex-server-changed', handler as any);
    };
  }, []);

  return (
    <div className="pb-10">
      {/* Spacer to separate hero from transparent nav */}
      <div className="pt-24" />
      {hero ? (
        <HomeHero
          title={hero.title}
          overview={hero.overview}
          posterUrl={hero.poster}
          backdropUrl={hero.backdrop}
          rating={hero.rating}
          year={hero.year}
          runtime={hero.runtime}
          genres={hero.genres}
          logoUrl={hero.logoUrl}
          videoUrl={hero.videoUrl}
          ytKey={hero.ytKey}
          onPlay={() => { if (hero.id) nav(`/player/${encodeURIComponent(hero.id)}`); }}
          onMoreInfo={() => { if (hero.id) nav(`/details/${encodeURIComponent(hero.id)}`); }}
        />
      ) : (
        <div className="bleed" style={{ padding: '20px' }}>
          <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-neutral-900/40 h-[56vh] md:h-[64vh] xl:h-[68vh] skeleton" />
        </div>
      )}
      <div className="mt-6" />
      {needsPlex && (
        <SectionBanner title={t('home.continue_watching')} message={t('home.connect_plex_msg')} cta={t('home.open_settings')} to="/settings" />
      )}
      {!loading && rows.map((r: any) => (
        <Row key={r.title} title={r.title} items={r.items as any} variant={r.variant} browseKey={r.browseKey} onItemClick={(id) => nav(`/details/${encodeURIComponent(id)}`)} />
      ))}

      {/* Trakt Sections */}
      <div className="mt-8 space-y-8">
        <TraktSection type="trending" mediaType="movies" />
        <TraktSection type="trending" mediaType="shows" />
        {isTraktAuthenticated() && (
          <>
            <TraktSection type="watchlist" />
            <TraktSection type="history" mediaType="shows" />
            <TraktSection type="recommendations" mediaType="movies" />
          </>
        )}
        <TraktSection type="popular" mediaType="shows" />
      </div>

      <BrowseModal />
    </div>
  );
}

function inferIdFromGuid(m: any): string | undefined {
  const g = String(m.tmdbGuid || '');
  if (!g) return undefined;
  const num = (g.match(/(\d{3,})/) || [])[1];
  if (g.includes('tmdb://') && num) {
    const type = (m.type === 'movie') ? 'movie' : (m.type === 'show' ? 'tv' : 'movie');
    return `tmdb:${type}:${num}`;
  }
  return undefined;
}
