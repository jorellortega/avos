/** In-memory TTS cache for the portal session (avoids repeat ElevenLabs calls). */

type CacheEntry = {
  blob: Blob
  objectUrl: string
  createdAt: number
}

const MAX_ENTRIES = 10
const cache = new Map<string, CacheEntry>()

function cacheKey(text: string): string {
  return text.trim()
}

function evictOldest() {
  if (cache.size < MAX_ENTRIES) return
  let oldestKey: string | null = null
  let oldestAt = Infinity
  for (const [key, entry] of cache) {
    if (entry.createdAt < oldestAt) {
      oldestAt = entry.createdAt
      oldestKey = key
    }
  }
  if (oldestKey) removePortalTtsCache(oldestKey)
}

export function hasPortalTtsCache(text: string): boolean {
  return cache.has(cacheKey(text))
}

export function getPortalTtsCacheUrl(text: string): string | null {
  return cache.get(cacheKey(text))?.objectUrl ?? null
}

export function putPortalTtsCache(text: string, blob: Blob): string {
  const key = cacheKey(text)
  const existing = cache.get(key)
  if (existing) {
    return existing.objectUrl
  }
  evictOldest()
  const objectUrl = URL.createObjectURL(blob)
  cache.set(key, { blob, objectUrl, createdAt: Date.now() })
  return objectUrl
}

export function removePortalTtsCache(text: string) {
  const key = cacheKey(text)
  const entry = cache.get(key)
  if (entry) {
    URL.revokeObjectURL(entry.objectUrl)
    cache.delete(key)
  }
}

/** Drop cache when order text changes (optional cleanup from UI). */
export function clearPortalTtsCacheExcept(keepText?: string) {
  const keep = keepText ? cacheKey(keepText) : null
  for (const key of [...cache.keys()]) {
    if (key !== keep) removePortalTtsCache(key)
  }
}
