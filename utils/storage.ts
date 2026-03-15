import { storage } from 'wxt/utils/storage';

export type ClipSource = 'generated-markdown' | 'site-markdown';

export interface FrontMatterFields {
  title: boolean;
  url: boolean;
  date: boolean;
  description: boolean;
  author: boolean;
}

export interface Settings {
  frontMatterEnabled: boolean;
  frontMatterFields: FrontMatterFields;
  preferSiteMarkdown: boolean;
  verboseLogging: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  frontMatterEnabled: true,
  frontMatterFields: {
    title: true,
    url: true,
    date: true,
    description: true,
    author: true,
  },
  preferSiteMarkdown: true,
  verboseLogging: false,
};

export function normalizeSettings(settings: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    frontMatterFields: {
      ...DEFAULT_SETTINGS.frontMatterFields,
      ...settings?.frontMatterFields,
    },
  };
}

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  defaultValue: DEFAULT_SETTINGS,
});

export interface CacheEntry {
  markdown: string;
  title: string;
  source: ClipSource;
  sourceUrl?: string;
  tokenCount?: number;
  hash: string;
  ts: number;
}

// Per-entry cache keys: local:clipCache:<encodeURIComponent(url:scope)>
// A small index (key -> timestamp) lets eviction stay cheap without
// reading every full entry.
export type ClipCacheIndex = Record<string, number>;

export const clipCacheIndexItem = storage.defineItem<ClipCacheIndex>('local:clipCacheIndex', {
  defaultValue: {},
});

function cacheStorageKey(cacheKey: string): `local:clipCache:${string}` {
  return `local:clipCache:${encodeURIComponent(cacheKey)}`;
}

export async function readCacheEntry(cacheKey: string): Promise<CacheEntry | null> {
  return storage.getItem<CacheEntry>(cacheStorageKey(cacheKey));
}

export async function writeCacheEntry(cacheKey: string, entry: CacheEntry): Promise<void> {
  await storage.setItem(cacheStorageKey(cacheKey), entry);

  const index = await clipCacheIndexItem.getValue();
  index[cacheKey] = entry.ts;

  const entries = Object.entries(index);
  if (entries.length > 20) {
    entries.sort(([, a], [, b]) => a - b);
    const [oldestKey] = entries[0];
    delete index[oldestKey];
    await storage.removeItem(cacheStorageKey(oldestKey));
  }

  await clipCacheIndexItem.setValue(index);
}
