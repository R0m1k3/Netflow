import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Row from '@/components/Row';
import { loadSettings } from '@/state/settings';
import { traktTrending, traktPopular, isTraktAuthenticated, ensureValidToken, traktGetWatchlist, traktGetRecommendations, traktGetHistory } from '@/services/trakt';
import { tmdbBestBackdropUrl } from '@/services/tmdb';
import { plexFindByGuid, plexImage } from '@/services/plex';
import { apiClient } from '@/services/api';
import SkeletonRow from '@/components/SkeletonRow';
import { useTranslation } from 'react-i18next';

interface TraktSectionProps {
  type?: 'trending' | 'popular' | 'watchlist' | 'recommendations' | 'history';
  mediaType?: 'movies' | 'shows';
  title?: string;
}

export function TraktSection({ type = 'trending', mediaType, title }: TraktSectionProps) {
  const [items, setItems] = useState<Array<{ id: string; title: string; image: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const nav = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    loadContent();

    // Listen for auth changes
    const handleAuthChange = () => {
      loadContent();
    };
    window.addEventListener('trakt-auth-changed', handleAuthChange);
    return () => window.removeEventListener('trakt-auth-changed', handleAuthChange);
  }, [type, mediaType]);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);

      const authenticated = isTraktAuthenticated();
      setIsAuthenticated(authenticated);

      let data: any[] = [];
      const safeMediaType = mediaType || 'movies';

      if (type === 'trending') {
        data = await traktTrending(safeMediaType, 20);
      } else if (type === 'popular') {
        data = await traktPopular(safeMediaType, 20);
      } else if (authenticated) {
        const token = await ensureValidToken();
        if (!token) {
          setError(t('trakt_section.not_auth'));
          return;
        }

        if (type === 'watchlist') {
          // If mediaType is undefined, fetch mixed watchlist
          data = await traktGetWatchlist(token, mediaType);
        } else if (type === 'recommendations') {
          data = await traktGetRecommendations(token, safeMediaType, 20);
        } else if (type === 'history') {
          data = await traktGetHistory(token, mediaType, 20);
        }
      }

      // Map Trakt results to unified Row items (Plex/TMDB IDs + landscape art)
      const mapped = await mapTraktToRowItems(data, mediaType);
      setItems(mapped);
    } catch (err: any) {
      console.error('Failed to load Trakt content:', err);
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const getSectionTitle = () => {
    if (title) return title;
    const safeMediaType = mediaType || 'movies';

    switch (type) {
      case 'trending':
        return safeMediaType === 'movies' ? t('trakt_section.trending_movies') : t('trakt_section.trending_shows');
      case 'popular':
        return safeMediaType === 'movies' ? t('trakt_section.popular_movies') : t('trakt_section.popular_shows');
      case 'watchlist':
        return t('trakt_section.watchlist');
      case 'recommendations':
        return t('trakt_section.recommendations');
      case 'history':
        return t('trakt_section.history');
      default:
        return safeMediaType === 'movies' ? t('trakt_section.default_movies') : t('trakt_section.default_shows');
    }
  };

  // Convert Trakt payloads to Row items with best-effort ID mapping
  async function mapTraktToRowItems(list: any[], enforcedType?: 'movies' | 'shows') {
    const s = loadSettings();
    const out: Array<{ id: string; title: string; image: string }> = [];

    // Helper: best-effort Plex GUID lookup by TMDB id
    async function plexByTmdb(tmdbId: number, mTypeNum: 1 | 2) {
      if (!s.plexBaseUrl || !s.plexToken) return undefined;
      try {
        // Try both common GUID prefixes
        const a: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `tmdb://${tmdbId}`, mTypeNum);
        let hits: any[] = (a?.MediaContainer?.Metadata || []);
        if (!hits.length) {
          const b: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `themoviedb://${tmdbId}`, mTypeNum);
          hits = (b?.MediaContainer?.Metadata || []);
        }
        return hits[0];
      } catch {
        return undefined;
      }
    }

    // Map each item
    for (const it of list) {
      const media = it.movie || it.show || it; // normalize
      // Determine type from item if not enforced
      const isMovie = it.movie ? true : (it.show ? false : (enforcedType === 'movies'));
      const typeNum = isMovie ? 1 : 2;
      const mediaKey = isMovie ? 'movie' : 'tv';

      const ids = media?.ids || {};
      const title = media?.title || '';
      const tmdbId: number | undefined = ids?.tmdb;

      // Prefer Plex mapping when server available and TMDB id present
      if (tmdbId) {
        const hit = await plexByTmdb(tmdbId, typeNum);
        if (hit) {
          const rk = String(hit.ratingKey);
          const p = hit.art || hit.thumb || hit.parentThumb || hit.grandparentThumb;
          const img = p ? apiClient.getPlexImageNoToken(p) : placeholderImg();
          out.push({ id: `plex:${rk}`, title, image: img });
          continue;
        }
      }

      // Fallback to TMDB-native IDs with landscape backdrop
      if (tmdbId && s.tmdbBearer) {
        let img = '';
        try { img = (await tmdbBestBackdropUrl(s.tmdbBearer!, mediaKey as any, tmdbId, 'en')) || ''; } catch { }
        out.push({ id: `tmdb:${mediaKey}:${tmdbId}`, title, image: img || placeholderImg() });
        continue;
      }

      // Try Plex mapping via other external IDs (IMDb/TVDB)
      if (s.plexBaseUrl && s.plexToken) {
        const imdb = ids?.imdb as (string | undefined);
        const tvdb = ids?.tvdb as (number | undefined);
        if (imdb) {
          try {
            const byImdb: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `imdb://${imdb}`, typeNum);
            const hit = (byImdb?.MediaContainer?.Metadata || [])[0];
            if (hit) {
              const rk = String(hit.ratingKey);
              const p = hit.art || hit.thumb || hit.parentThumb || hit.grandparentThumb;
              const img = p ? apiClient.getPlexImageNoToken(p) : placeholderImg();
              out.push({ id: `plex:${rk}`, title, image: img });
              continue;
            }
          } catch { }
        }
        if (tvdb) {
          try {
            const byTvdb: any = await plexFindByGuid({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, `tvdb://${tvdb}`, typeNum);
            const hit = (byTvdb?.MediaContainer?.Metadata || [])[0];
            if (hit) {
              const rk = String(hit.ratingKey);
              const img = (hit.art || hit.thumb || hit.parentThumb || hit.grandparentThumb) ? apiClient.getPlexImageNoToken(hit.art || hit.thumb || hit.parentThumb || hit.grandparentThumb) : placeholderImg();
              out.push({ id: `plex:${rk}`, title, image: img });
              continue;
            }
          } catch { }
        }
      }

      // If we can't map to Plex or TMDB, skip to keep row interactions consistent
      // (Trakt items without TMDB IDs are rare)
      continue;
    }

    // Keep rows concise like the rest of Home
    return out.slice(0, 12);
  }

  function mediaKeyFromTrakt(it: any): 'movie' | 'tv' {
    return it?.movie ? 'movie' : 'tv';
  }

  function placeholderImg(): string {
    // Subtle neutral gradient SVG as data URI (2:1 aspect friendly)
    const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#111"/><stop offset="1" stop-color="#1e1e1e"/></linearGradient></defs><rect width="800" height="400" fill="url(#g)"/></svg>');
    return `data:image/svg+xml,${svg}`;
  }

  if (!isAuthenticated && (type === 'watchlist' || type === 'recommendations' || type === 'history')) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">{t('trakt_section.connect_msg')}</p>
          <button
            onClick={() => window.location.href = '/settings'}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            {t('trakt_section.connect_btn')}
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <SkeletonRow title={getSectionTitle()} count={8} />;

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">{t('trakt_section.failed')}: {error}</p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">{t('trakt_section.no_items')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <Row
        title={getSectionTitle()}
        items={items}
        onItemClick={(id) => nav(`/details/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}
