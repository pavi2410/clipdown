import { storage } from 'wxt/utils/storage';
import { fnv1a } from './hash';
import { shouldCompress, compressString, decompressString } from './compress';
import type { ClipSource } from './settings';

export interface CacheEntry {
  markdown: string;
  title: string;
  source: ClipSource;
  sourceUrl?: string;
  url: string;
  tokenCount?: number;
  compressed?: boolean;
  hash: string;
  ts: number;
}

export type ClipCacheIndex = Record<string, number>;

export const clipCacheIndexItem = storage.defineItem<ClipCacheIndex>('local:clipCacheIndex', {
  defaultValue: {},
});

function cacheStorageKey(cacheKey: string): `local:clipCache:${string}` {
  return `local:clipCache:${fnv1a(cacheKey)}`;
}

export async function readCacheEntry(cacheKey: string): Promise<CacheEntry | null> {
  const entry = await storage.getItem<CacheEntry>(cacheStorageKey(cacheKey));
  if (!entry) return null;
  if (entry.compressed) {
    entry.markdown = await decompressString(entry.markdown);
    entry.compressed = false;
  }
  return entry;
}

export async function writeCacheEntry(cacheKey: string, entry: CacheEntry): Promise<void> {
  const toStore = { ...entry };
  if (shouldCompress(toStore.markdown)) {
    toStore.markdown = await compressString(toStore.markdown);
    toStore.compressed = true;
  }
  await storage.setItem(cacheStorageKey(cacheKey), toStore);

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
