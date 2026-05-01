import { nanoid } from "nanoid";

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface CacheEntry {
  data: Buffer;
  contentType: string;
  expiresAt: number;
}

const fileCache = new Map<string, CacheEntry>();

function cleanExpired() {
  const now = Date.now();
  Array.from(fileCache.entries()).forEach(([key, entry]) => {
    if (entry.expiresAt < now) fileCache.delete(key);
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = nanoid(8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  cleanExpired();
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer =
    typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(data as Uint8Array);

  fileCache.set(key, { data: buffer, contentType, expiresAt: Date.now() + TTL_MS });
  return { key, url: `/api/files/${encodeURIComponent(key)}` };
}

export function getStoredFile(key: string): { data: Buffer; contentType: string } | null {
  cleanExpired();
  const entry = fileCache.get(key);
  if (!entry) return null;
  return { data: entry.data, contentType: entry.contentType };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/files/${encodeURIComponent(key)}` };
}
