/**
 * Fetch a profile photo so it carries the token its endpoint requires.
 *
 * The photo route is authenticated like every other endpoint. A browser
 * issuing the image request itself sends no Authorization header, so for a
 * photo served by our own API the bytes are fetched here - by the client that
 * attaches the token - and handed to the tag as an object URL.
 *
 * That only ever applies to our own API. `resolveAssetUrl` passes an absolute
 * URL through untouched, so an avatar_url naming another host is a supported
 * input, and the API client attaches the session token and cookies to whatever
 * host it is pointed at. Such a URL is therefore never fetched here at all -
 * the caller renders it directly, which is what a foreign image needs anyway
 * and sends nothing of ours with it.
 *
 * Results are cached by source URL because the same face appears many times on
 * a page: an employees list would otherwise fetch one person's photo once per
 * row. The cache holds the in-flight promise, so simultaneous mounts share a
 * single request rather than starting one each.
 *
 * An entry is dropped only when the photo it holds is replaced or removed, via
 * forgetAvatar. Doing that needs two halves: the entry goes and its object URL
 * is revoked, and subscribers are told so a component showing the old bytes
 * fetches again. Without the second half a photo whose URL did not change would
 * keep rendering a revoked object URL - a broken image - which is the very case
 * the invalidation exists for.
 *
 * Nothing else evicts. Several components can be showing the same object URL
 * and there is no moment at which the last of them is known to be gone, so
 * revoking on unmount would blank an avatar still on screen.
 */

import api, { API_BASE_URL, resolveAssetUrl } from '@/lib/api'

const cache = new Map<string, Promise<string>>()

// Bumped whenever an entry is dropped. Components read it so that invalidating
// a photo re-fetches it even when its URL is unchanged.
let cacheVersion = 0
const listeners = new Set<() => void>()

export function subscribeAvatarCache(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAvatarCacheVersion(): number {
  return cacheVersion
}

function invalidate(sources: string[]): void {
  for (const source of sources) {
    const pending = cache.get(source)
    cache.delete(source)
    // The bytes are ours to release once nothing will be handed this entry
    // again. Swallowed because a rejected fetch has nothing to revoke.
    pending?.then((url) => URL.revokeObjectURL(url)).catch(() => {})
  }
  cacheVersion += 1
  for (const listener of listeners) listener()
}

/**
 * Drop a photo so the next render fetches it again.
 *
 * Called after an upload or a removal. The photo being replaced is the one to
 * forget: whether the new one arrives under a new name or the same one, the old
 * bytes must not be served from here again.
 */
export function forgetAvatar(source: string | null | undefined): void {
  if (!source) return
  invalidate([source])
}

/**
 * Whether this photo has to be fetched with our credentials.
 *
 * True only for our own API. Anything else - another host, a data: URL - is
 * rendered directly, so no token and no cookies travel to it.
 */
export function needsAuthenticatedFetch(source: string): boolean {
  try {
    // The base is resolved against the page first. In the same-origin
    // deployment VITE_API_BASE_URL is "/", and a WHATWG base must be absolute -
    // `new URL(path, '/')` throws, which would send every one of our own
    // avatars down the foreign path and straight into a 401.
    const pageOrigin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const base = new URL(API_BASE_URL || '/', pageOrigin)
    return new URL(source, base).origin === base.origin
  } catch {
    // An unparseable source is not somewhere to send credentials.
    return false
  }
}

export function loadAvatarObjectUrl(source: string): Promise<string> {
  if (!needsAuthenticatedFetch(source)) {
    return Promise.reject(new Error(`Refusing to send credentials to a foreign host for ${source}`))
  }

  const existing = cache.get(source)
  if (existing) return existing

  const pending = api
    .get<Blob>(source, {
      responseType: 'blob',
      // One photo failing is not the session failing. Without this a 401 here
      // would clear the token and navigate to /login, so a single missing photo
      // would sign the user out. A blocked or unreachable photo is likewise not
      // worth three attempts with backoff.
      _skipAuthRedirect: true,
      _noTransientRetry: true,
    } as Parameters<typeof api.get>[1])
    .then((response) => URL.createObjectURL(response.data))
    .catch((error) => {
      // Not kept: a photo that failed because the token had just expired should
      // be retried on the next render, not remembered as broken for the session.
      cache.delete(source)
      throw error
    })

  cache.set(source, pending)
  return pending
}

/** The URL to fetch for a stored path, or undefined when there is no photo. */
export function avatarSource(avatarUrl: string | null | undefined): string | undefined {
  return resolveAssetUrl(avatarUrl)
}

/** Testing seam: drop everything cached so far. */
export function clearAvatarCache(): void {
  invalidate([...cache.keys()])
}
