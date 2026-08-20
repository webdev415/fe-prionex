/**
 * Fetch a profile photo through the API client and hand back a URL for <img>.
 *
 * The photo endpoint requires a token like every other endpoint. A browser
 * issuing the image request itself sends no Authorization header, so the bytes
 * are fetched here - by the same client that attaches the token - and handed to
 * the tag as an object URL.
 *
 * Results are cached by source URL because the same face appears many times on
 * a page: an employees list would otherwise fetch one person's photo once per
 * row. The cache holds the in-flight promise, so simultaneous mounts share a
 * single request rather than starting one each.
 *
 * Object URLs are deliberately never revoked. Several components can be showing
 * the same one, and there is no moment at which the last of them is known to be
 * gone; revoking early would blank an avatar still on screen. The cost is
 * bounded - one entry per distinct photo, and a replaced photo gets a new file
 * name rather than piling up under the old one.
 */

import api, { resolveAssetUrl } from '@/lib/api'

const cache = new Map<string, Promise<string>>()

export function loadAvatarObjectUrl(source: string): Promise<string> {
  const existing = cache.get(source)
  if (existing) return existing

  const pending = api
    .get<Blob>(source, { responseType: 'blob' })
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
  cache.clear()
}
