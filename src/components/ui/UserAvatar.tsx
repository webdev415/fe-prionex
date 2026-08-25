/**
 * A user's photo, or their initials when there is none.
 *
 * Most users will never upload a photo, so the monogram is the normal case
 * rather than an error state. It takes its colours from the theme so it matches
 * the container it sits in, in light and dark alike. A photo that cannot be
 * fetched falls back to it too, so a dead link never leaves an empty disc.
 *
 * Both states wear the same bordered disc. Without it a monogram on a table row
 * is just letters floating in the cell, and a photo has no edge to mark where
 * the avatar ends - neither reads as an avatar at a glance.
 *
 * Our own photo endpoint requires a token, so the bytes cannot be fetched by
 * putting the path in src - the browser would issue that request itself and
 * send no Authorization header. They are fetched through the API client
 * instead, and the tag is given an object URL. Until that resolves the monogram
 * stands in, which is also what a photo that cannot be fetched ends up showing.
 *
 * A photo on any other host is used as src directly. Fetching it through the
 * API client would send our session token and cookies to that host, and it
 * needs none of them. That one is loaded by the browser, so it can fail after
 * we have handed it over - hence the onError, which puts the initials back
 * rather than leaving the browser's broken-image icon.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { monogramInitials } from '@/lib/avatarMonogram'
import {
  avatarSource,
  getAvatarCacheVersion,
  loadAvatarObjectUrl,
  needsAuthenticatedFetch,
  subscribeAvatarCache,
} from '@/lib/avatarImage'
import { cn } from '@/lib/utils'

export interface UserAvatarProps {
  userId?: number | null
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  avatarUrl?: string | null
  size?: number
  className?: string
}

export function UserAvatar({
  firstName,
  lastName,
  fullName,
  avatarUrl,
  size = 32,
  className,
}: UserAvatarProps) {
  // Held with the source it belongs to rather than reset when the source
  // changes: clearing it from the effect would be a synchronous set during
  // render, and a stale photo would flash under the new name until the fetch
  // came back. Deriving it means a source with nothing loaded yet shows the
  // monogram without anyone having to clear anything.
  const [loaded, setLoaded] = useState<{
    source: string
    url: string
    version: number
  } | null>(null)

  // Replacing a photo can hand back the same URL, so the source alone cannot
  // say whether what we hold is still current.
  const cacheVersion = useSyncExternalStore(
    subscribeAvatarCache,
    getAvatarCacheVersion,
    getAvatarCacheVersion
  )
  // A photo we handed to the tag and the browser could not render. Held with
  // the src it belongs to so a later photo is not tarred by an earlier failure.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)

  const source = avatarSource(avatarUrl)
  const mustFetch = source !== undefined && needsAuthenticatedFetch(source)

  useEffect(() => {
    if (!source || !mustFetch) return

    let active = true
    loadAvatarObjectUrl(source)
      .then((url) => {
        if (active) setLoaded({ source, url, version: cacheVersion })
      })
      .catch((error) => {
        if (!active) return
        // Nothing is stored for this source, so the monogram stands. Logged
        // because otherwise a failure is indistinguishable from having no
        // photo: the initials appear and nothing says why.
        console.error(`Avatar failed to load: ${source}`, error)
      })

    return () => {
      active = false
    }
  }, [source, mustFetch, cacheVersion])

  const fetched =
    loaded && loaded.source === source && loaded.version === cacheVersion ? loaded.url : null
  // A foreign photo is shown straight from its own URL; ours is shown only once
  // the fetch that carried the token has come back.
  const candidate = mustFetch ? fetched : (source ?? null)
  const displaySrc = candidate && candidate !== brokenSrc ? candidate : null

  const initials = monogramInitials(firstName, lastName, fullName)
  const label = fullName || [firstName, lastName].filter(Boolean).join(' ') || undefined
  const dimensions = { width: size, height: size }
  const container = 'border-border bg-muted inline-flex shrink-0 rounded-full border'

  if (displaySrc) {
    return (
      <img
        src={displaySrc}
        alt={label ?? ''}
        style={dimensions}
        className={cn(container, 'object-cover', className)}
        onError={() => {
          // Without this the browser draws its own broken-image icon, which is
          // worse than the initials and says nothing about why.
          console.error(`Avatar failed to render: ${displaySrc}`)
          setBrokenSrc(displaySrc)
        }}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ ...dimensions, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      className={cn(
        container,
        'text-muted-foreground items-center justify-center leading-none font-medium select-none',
        className
      )}
    >
      {initials}
    </span>
  )
}
