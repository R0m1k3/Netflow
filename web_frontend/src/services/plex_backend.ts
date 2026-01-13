// Backend-backed Plex service (reads only for now)
import { API_BASE_URL } from './api';
const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}/plex`;

async function backendFetch<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const base = API_BASE.replace(/\/$/, '');
  let url = `${base}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    });
    const q = qs.toString();
    if (q) url += (url.includes('?') ? '&' : '?') + q;
  }
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) {
      // Session invalid - force re-login
      window.location.href = '/login';
    }
    throw new Error(`Plex backend error ${res.status}`);
  }
  return res.json();
}

// Wrap helpers to match legacy shapes used by UI (MediaContainer.*)

export async function plexBackendLibraries() {
  const libs = await backendFetch<any[]>('/libraries');
  return { MediaContainer: { Directory: libs || [] } };
}

export async function plexBackendOnDeckGlobal() {
  const items = await backendFetch<any[]>('/ondeck');
  return { MediaContainer: { Metadata: items || [] } };
}

export async function plexBackendContinue() {
  const items = await backendFetch<any[]>('/continue');
  return { MediaContainer: { Metadata: items || [] } };
}

export async function plexBackendRecentlyAdded(libraryKey?: string) {
  const items = await backendFetch<any[]>('/recent', libraryKey ? { library: libraryKey } : undefined);
  return { MediaContainer: { Metadata: items || [] } };
}

export async function plexBackendLibraryAll(sectionKey: string, params?: Record<string, any>) {
  const mc = await backendFetch<any>(`/library/${encodeURIComponent(sectionKey)}/all`, params);
  return { MediaContainer: mc?.MediaContainer || mc };
}

export async function plexBackendMetadata(ratingKey: string) {
  const meta = await backendFetch<any>(`/metadata/${encodeURIComponent(ratingKey)}`);
  return { MediaContainer: { Metadata: [meta] } };
}

export async function plexBackendMetadataWithExtras(ratingKey: string) {
  const meta = await backendFetch<any>(`/metadata/${encodeURIComponent(ratingKey)}`, {
    includeExtras: 1,
    includeExternalMedia: 1,
    includeChildren: 1,
  });
  return { MediaContainer: { Metadata: [meta] } };
}

export async function plexBackendLibrarySecondary(sectionKey: string, directory: string) {
  const mc = await backendFetch<any>(`/library/${encodeURIComponent(sectionKey)}/${encodeURIComponent(directory)}`);
  return { MediaContainer: mc };
}

export async function plexBackendDir(path: string, params?: Record<string, any>) {
  const p = path.startsWith('/') ? path.slice(1) : path;

  // Validate ratingKey - skip requests with suspicious low ratingKeys (likely corrupted data)
  const ratingKeyMatch = path.match(/\/library\/metadata\/(\d+)/);
  if (ratingKeyMatch && parseInt(ratingKeyMatch[1], 10) < 10) {
    console.warn('[plexBackendDir] skipping request with invalid low ratingKey:', ratingKeyMatch[1]);
    return { MediaContainer: { Metadata: [], Directory: [] } } as any;
  }

  try {
    const mc = await backendFetch<any>(`/dir/${p}`, params);
    return { MediaContainer: mc };
  } catch (e: any) {
    // Graceful fallback for 404/500 so Details page does not crash
    console.warn('[plexBackendDir] request failed', { path, error: String(e?.message || e) });
    return { MediaContainer: { Metadata: [], Directory: [] } } as any;
  }
}

export async function plexBackendSearch(query: string, type?: 1 | 2) {
  const items = await backendFetch<any[]>(`/search`, type ? { query, type } : { query });
  return { MediaContainer: { Metadata: items || [] } };
}

export async function plexBackendCollections(sectionKey: string) {
  const mc = await backendFetch<any>(`/library/${encodeURIComponent(sectionKey)}/collections`);
  return { MediaContainer: mc };
}

export async function plexBackendShowOnDeck(showKey: string) {
  try {
    const mc = await backendFetch<any>(`/ondeck/${encodeURIComponent(showKey)}`);
    return { MediaContainer: mc?.MediaContainer || { Metadata: [] } };
  } catch (e: any) {
    console.warn('[plexBackendShowOnDeck] request failed', { showKey, error: String(e?.message || e) });
    return { MediaContainer: { Metadata: [] } } as any;
  }
}

export async function plexBackendFindByGuid(guid: string, type?: 1 | 2) {
  const mc = await backendFetch<any>('/findByGuid', type ? { guid, type } : { guid });
  return { MediaContainer: mc };
}

/**
 * Get streaming URL via backend (returns proxied URL)
 */
export async function plexBackendStreamUrl(ratingKey: string, options?: {
  maxVideoBitrate?: number;
  protocol?: 'dash' | 'hls';
  autoAdjustQuality?: boolean;
  directPlay?: boolean;
  directStream?: boolean;
  audioStreamID?: string;
  subtitleStreamID?: string;
}): Promise<{ url: string; ratingKey: string }> {
  const params: Record<string, any> = {};
  if (options?.maxVideoBitrate !== undefined) params.maxVideoBitrate = options.maxVideoBitrate;
  if (options?.protocol) params.protocol = options.protocol;
  if (options?.autoAdjustQuality !== undefined) params.autoAdjustQuality = options.autoAdjustQuality ? '1' : '0';
  if (options?.directPlay !== undefined) params.directPlay = options.directPlay ? '1' : '0';
  if (options?.directStream !== undefined) params.directStream = options.directStream ? '1' : '0';
  if (options?.audioStreamID) params.audioStreamID = options.audioStreamID;
  if (options?.subtitleStreamID) params.subtitleStreamID = options.subtitleStreamID;

  const result = await backendFetch<{ url: string; ratingKey: string }>(`/stream/${encodeURIComponent(ratingKey)}`, params);
  return result;
}

/**
 * Build a proxied URL through the backend for any Plex path
 * Use this when you need to access Plex media directly from the browser via backend proxy
 */
export function plexBackendProxyUrl(plexPath: string, params?: Record<string, any>): string {
  const base = API_BASE.replace(/\/$/, '');
  const p = plexPath.startsWith('/') ? plexPath.slice(1) : plexPath;
  let url = `${base}/proxy/${p}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qs.append(k, String(v));
    });
    const q = qs.toString();
    if (q) url += `?${q}`;
  }
  return url;
}

