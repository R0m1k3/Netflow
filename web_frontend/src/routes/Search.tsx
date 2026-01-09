import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadSettings } from '@/state/settings';
import { plexSearch } from '@/services/plex';
import { apiClient } from '@/services/api';
import { plexBackendLibraries, plexBackendSearch, plexBackendCollections } from '@/services/plex_backend';
import { tmdbSearchMulti, tmdbTrending, tmdbImage, tmdbPopular } from '@/services/tmdb';
import SearchInput from '@/components/SearchInput';
import SearchResults from '@/components/SearchResults';
import PopularSearches from '@/components/PopularSearches';
import TrendingSearches from '@/components/TrendingSearches';
import SearchCollections from '@/components/SearchCollections';

type SearchResult = {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'person' | 'collection';
  image?: string;
  year?: string;
  overview?: string;
  available?: boolean;
};

export default function Search() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [popularItems, setPopularItems] = useState<SearchResult[]>([]);
  const [trendingItems, setTrendingItems] = useState<SearchResult[]>([]);
  const [collections, setCollections] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'idle' | 'searching' | 'results'>('idle');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSearchIdRef = useRef(0);

  // Load initial content on mount
  useEffect(() => {
    loadInitialContent();
  }, []);

  // Handle query changes
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query });
      setSearchMode('searching');
      // performSearch is debounced, so we don't need to call it immediately here if we trust the debounce.
      // However, the original code called it immediately AND had a debounce.
      // This causes double calls. The SearchInput often debounces its onChange, or user typing triggers many changes.
      // We should rely on the debounce in handleSearch.
      // BUT, checking line 46, previously it called performSearch(query) immediately.
      // If we remove it, the URL sync happens but search might not start until debounce fires?
      // Actually, handleSearch calls setQuery, which triggers this useEffect.
      // AND handleSearch sets a timeout to call performSearch.
      // So we have TWO calls. 
      // The fix is to remove performSearch(query) from this useEffect, OR remove the timeout from handleSearch.
      // Since handleSearch is the input handler, it's better to manage debounce there.
      // BUT if the user navigates directly to /search?q=foo, we need to search.
      // So we should keep performSearch here, but only if it's not being handled by handleSearch?
      // No, simpler: Rely on this useEffect for ALL searches. 
      // But we need to debounce the *Query State Update*? No, we update query state instantly for UI.
      // We need to debounce the *Search Execution*.
      // So let's use a debounced effect?
      // Current architecture: handleSearch sets timeout to call performSearch. useEffect calls performSearch.
      // If we remove the timeout in handleSearch, and just setQuery. Then useEffect runs immediately? That's not debounced.
      // If we remove useEffect call, then URL params q update only triggers... wait.
      // Best approach:
      // 1. handleSearch sets Query state only. (And clears any previous timeout if it was doing that).
      // 2. useEffect on [query] sets a timeout to perform search? That's debouncing within useEffect.

      // Let's stick to the current plan: Use lastSearchId to ignore stale.
      // But we should also avoid double calling.
      // The easiest way to avoid double calling is to `cancel` the previous one if possible, but identifying it is hard.
      // If I remove `performSearch(query)` from here, initial load from URL works?
      // Initial load uses `useState(searchParams.get('q'))`. So `query` has value. `useEffect` runs on mount. Search happens.
      // When user types, `handleSearch` runs, sets `query`. `useEffect` runs. Search happens instantly (no debounce).
      // AND `handleSearch` sets timeout. Search happens again later.
      // So the "debounce" in handleSearch is useless because useEffect triggers instantly.

      // I will remove the immediate call in useEffect IF the change came from user typing (which implies handleSearch).
      // But we can't know that easily.

      // Let's make useEffect debounce.
      const timer = setTimeout(() => {
        performSearch(query);
      }, 300);
      return () => clearTimeout(timer);

      // But handleSearch ALSO had logic.
      // I'll fix handleSearch to NOT call performSearch, just setQuery.
      // And I will replace this useEffect body to use debounce.
    } else {
      setSearchParams({});
      setSearchMode('idle');
      setResults([]);
    }
  }, [query]);

  async function loadInitialContent() {
    const s = loadSettings();

    // Load popular items from TMDB
    if (s.tmdbBearer) {
      try {
        const [popularMovies, popularShows] = await Promise.all([
          tmdbPopular(s.tmdbBearer, 'movie'),
          tmdbPopular(s.tmdbBearer, 'tv')
        ]);

        const popular: SearchResult[] = [];

        // Add popular movies (prefer backdrops for landscape rails)
        (popularMovies as any).results?.slice(0, 6).forEach((item: any) => {
          popular.push({
            id: `tmdb:movie:${item.id}`,
            title: item.title,
            type: 'movie',
            image: tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500'),
            year: item.release_date?.slice(0, 4)
          });
        });

        // Add popular TV shows
        (popularShows as any).results?.slice(0, 6).forEach((item: any) => {
          popular.push({
            id: `tmdb:tv:${item.id}`,
            title: item.name,
            type: 'tv',
            image: tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500'),
            year: item.first_air_date?.slice(0, 4)
          });
        });

        setPopularItems(popular.slice(0, 10));

        // Load trending items
        const trending = await tmdbTrending(s.tmdbBearer, 'all', 'week');
        const trendingList: SearchResult[] = (trending as any).results?.slice(0, 12).map((item: any) => ({
          id: `tmdb:${item.media_type}:${item.id}`,
          title: item.title || item.name,
          type: item.media_type as 'movie' | 'tv',
          image: tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500'),
          year: (item.release_date || item.first_air_date)?.slice(0, 4)
        })) || [];

        setTrendingItems(trendingList);
      } catch (err) {
        console.error('Failed to load popular/trending content:', err);
      }
    }

    // Load Plex collections
    if (s.plexBaseUrl && s.plexToken) {
      try {
        const libs: any = await plexBackendLibraries();
        const directories = libs?.MediaContainer?.Directory || [];
        const collectionsList: SearchResult[] = [];

        // Get collections from each library
        for (const lib of directories.slice(0, 2)) {
          try {
            const cols: any = await plexBackendCollections(lib.key);
            const items = cols?.MediaContainer?.Metadata || [];

            items.slice(0, 3).forEach((col: any) => {
              const p = col.thumb || col.art;
              collectionsList.push({
                id: `plex:collection:${col.ratingKey}`,
                title: col.title,
                type: 'collection',
                image: apiClient.getPlexImageNoToken(p || ''),
                overview: col.summary
              });
            });
          } catch { }
        }

        setCollections(collectionsList);
      } catch (err) {
        console.error('Failed to load Plex collections:', err);
      }
    }
  }

  const performSearch = useCallback(async (searchQuery: string) => {
    // Increment search ID to identify the latest request
    const searchId = ++lastSearchIdRef.current;

    if (!searchQuery.trim()) {
      if (searchId === lastSearchIdRef.current) {
        setResults([]);
        setSearchMode('idle');
      }
      return;
    }

    setLoading(true);
    const s = loadSettings();
    const searchResults: SearchResult[] = [];
    const seenIds = new Set<string>();

    try {
      // Search Plex first
      if (s.plexBaseUrl && s.plexToken) {
        try {
          // Search movies
          const plexMovies: any = await plexBackendSearch(searchQuery, 1);
          // Check if this is still the latest search
          if (searchId !== lastSearchIdRef.current) return;

          const movieResults = plexMovies?.MediaContainer?.Metadata || [];

          movieResults.slice(0, 10).forEach((item: any) => {
            // Deduplicate by ratingKey
            const uniqueId = `plex:${item.ratingKey}`;
            if (seenIds.has(uniqueId)) return;
            seenIds.add(uniqueId);

            searchResults.push({
              id: uniqueId,
              title: item.title,
              type: 'movie',
              image: apiClient.getPlexImageNoToken((item.art || item.thumb || item.parentThumb || item.grandparentThumb) || ''),
              year: item.year ? String(item.year) : undefined,
              overview: item.summary,
              available: true
            });
          });

          // Search TV shows
          const plexShows: any = await plexBackendSearch(searchQuery, 2);
          // Check if this is still the latest search
          if (searchId !== lastSearchIdRef.current) return;

          const showResults = plexShows?.MediaContainer?.Metadata || [];

          showResults.slice(0, 10).forEach((item: any) => {
            const uniqueId = `plex:${item.ratingKey}`;
            if (seenIds.has(uniqueId)) return;
            seenIds.add(uniqueId);

            searchResults.push({
              id: uniqueId,
              title: item.title,
              type: 'tv',
              image: apiClient.getPlexImageNoToken((item.art || item.thumb || item.parentThumb || item.grandparentThumb) || ''),
              year: item.year ? String(item.year) : undefined,
              overview: item.summary,
              available: true
            });
          });
        } catch (err) {
          console.error('Plex search failed:', err);
        }
      }

      // Search TMDB as fallback
      if (s.tmdbBearer) {
        try {
          const tmdbResults: any = await tmdbSearchMulti(s.tmdbBearer, searchQuery);
          // Check if this is still the latest search
          if (searchId !== lastSearchIdRef.current) return;

          const tmdbItems = tmdbResults?.results || [];

          tmdbItems.slice(0, 20).forEach((item: any) => {
            // Deduplicate logic
            // 1. Check if ID already seen
            const uniqueId = `tmdb:${item.media_type}:${item.id}`;
            if (seenIds.has(uniqueId)) return;

            // 2. Check by title (fuzzy match against existing Plex results)
            // This prevents "Batman" (Plex) and "Batman" (TMDB) from showing up as separate if they are the same.
            // But we should only skip if we are SURE it's the same. 
            // The existing code used a simple title match. Let's keep it but make it smarter?
            // User compliant: "same movie or series", so better to filter out TMDB ones if Plex has it.
            const plexMatch = searchResults.find(r =>
              r.available && r.title.toLowerCase() === (item.title || item.name || '').toLowerCase() &&
              // Maybe check year too?
              (!item.release_date || !r.year || item.release_date.startsWith(r.year))
            );

            if (!plexMatch && item.media_type !== 'person') {
              seenIds.add(uniqueId);
              searchResults.push({
                id: uniqueId,
                title: item.title || item.name,
                type: item.media_type as 'movie' | 'tv',
                image: tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500'),
                year: (item.release_date || item.first_air_date)?.slice(0, 4),
                overview: item.overview,
                available: false
              });
            }
          });
        } catch (err) {
          console.error('TMDB search failed:', err);
        }
      }

      if (searchId === lastSearchIdRef.current) {
        setResults(searchResults);
        setSearchMode('results');
      }
    } finally {
      if (searchId === lastSearchIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    // Debounce is now handled by useEffect on query change
  }, []);

  const handleItemClick = (item: SearchResult) => {
    if (item.type === 'collection') {
      // Handle collection click - maybe show collection contents
      nav(`/library?collection=${encodeURIComponent(item.id)}`);
    } else {
      nav(`/details/${encodeURIComponent(item.id)}`);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="page-gutter-left">
        {/* Search Input */}
        <div className="mb-8">
          <SearchInput
            value={query}
            onChange={handleSearch}
            autoFocus
          />
        </div>

        {/* Search Results */}
        {searchMode === 'results' && (
          <div className="mb-12">
            {loading ? (
              <div className="text-center py-20">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="mt-4 text-gray-400">Searching...</p>
              </div>
            ) : results.length > 0 ? (
              <SearchResults
                results={results}
                onItemClick={handleItemClick}
              />
            ) : (
              <div className="text-center py-20">
                <p className="text-xl text-gray-400">No results found for "{query}"</p>
                <p className="mt-2 text-sm text-gray-500">Try searching with different keywords</p>
              </div>
            )}
          </div>
        )}

        {/* Idle State - Show Popular, Trending, Collections */}
        {searchMode === 'idle' && (
          <>
            {/* Popular Searches rail */}
            {popularItems.length > 0 && (
              <div className="mb-4">
                <PopularSearches
                  items={popularItems}
                  onItemClick={handleItemClick}
                />
              </div>
            )}

            {/* Trending Searches rail */}
            {trendingItems.length > 0 && (
              <div className="mb-4">
                <TrendingSearches
                  items={trendingItems}
                  onItemClick={handleItemClick}
                />
              </div>
            )}

            {/* Collections */}
            {collections.length > 0 && (
              <div className="mt-6 mb-12">
                <SearchCollections
                  collections={collections as any}
                  onItemClick={handleItemClick}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
