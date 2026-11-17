import type { GameGuide } from "@bgc/schema";

/**
 * Pre-caches a guide for offline use. Cache names match the Workbox runtime caches in
 * vite.config.ts, so the service worker serves these entries when the device is offline.
 * Tied to the static adapter's URL layout (architecture C): `<base>/index.json`,
 * `<base>/<id>/guide.json`, `<base>/<id>/images/*`.
 */
export const DATA_CACHE = "bgc-game-data";
export const IMAGE_CACHE = "bgc-game-images";

export interface OfflineUrls {
  data: string[];
  images: string[];
}

export function offlineUrls(guide: GameGuide, assetUrl: (src: string) => string): OfflineUrls {
  const guideUrl = assetUrl("guide.json");
  const indexUrl = guideUrl.replace(new RegExp(`${guide.id}/guide\\.json$`), "index.json");
  const images = [...new Set(guide.scenes.map((s) => assetUrl(s.image.src)))];
  return { data: [indexUrl, guideUrl], images };
}

const cachesAvailable = () => typeof caches !== "undefined";

export async function isAvailableOffline(urls: OfflineUrls): Promise<boolean> {
  if (!cachesAvailable()) return false;
  try {
    const data = await caches.open(DATA_CACHE);
    const images = await caches.open(IMAGE_CACHE);
    const hits = await Promise.all([
      ...urls.data.map((u) => data.match(u)),
      ...urls.images.map((u) => images.match(u)),
    ]);
    return hits.every((h) => h !== undefined);
  } catch {
    return false;
  }
}

export async function downloadForOffline(urls: OfflineUrls): Promise<void> {
  if (!cachesAvailable()) throw new Error("Cache Storage is not available");
  // Ask the browser not to evict our data (iOS/Safari can otherwise clear it).
  try {
    await navigator.storage?.persist?.();
  } catch {
    // not supported: best effort
  }
  const data = await caches.open(DATA_CACHE);
  const images = await caches.open(IMAGE_CACHE);
  await Promise.all([data.addAll(urls.data), images.addAll(urls.images)]);
}

export async function removeOffline(urls: OfflineUrls): Promise<void> {
  if (!cachesAvailable()) return;
  const data = await caches.open(DATA_CACHE);
  const images = await caches.open(IMAGE_CACHE);
  // Keep index.json: other downloaded games still need it.
  await Promise.all([
    ...urls.data.slice(1).map((u) => data.delete(u)),
    ...urls.images.map((u) => images.delete(u)),
  ]);
}
