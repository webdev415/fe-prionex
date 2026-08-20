/**
 * A user's photo, or their initials when there is none.
 *
 * Most users will never upload a photo, so the monogram is the normal case
 * rather than an error state. It takes its colours from the theme so it matches
 * the container it sits in, in light and dark alike. A photo that cannot be
 * fetched falls back to it too, so a dead link never leaves an empty disc.
 *
 * The photo endpoint requires a token, so the bytes cannot be fetched by
 * putting the path in src - the browser would issue that request itself and
 * send no Authorization header. They are fetched through the API client
 * instead, and the tag is given an object URL. Until that resolves the monogram
 * stands in, which is also what a signed-out or expired session ends up
 * showing.
 */

import { useEffect, useState } from 'react'
import { monogramInitials } from '@/lib/avatarMonogram'
import { avatarSource, loadAvatarObjectUrl } from '@/lib/avatarImage'
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
  const [loaded, setLoaded] = useState<{ source: string; url: string } | null>(null)

  const source = avatarSource(avatarUrl)

  useEffect(() => {
    if (!source) return

    let active = true
    loadAvatarObjectUrl(source)
      .then((url) => {
        if (active) setLoaded({ source, url })
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
  }, [source])

  const objectUrl = loaded && loaded.source === source ? loaded.url : null

  const initials = monogramInitials(firstName, lastName, fullName)
  const label = fullName || [firstName, lastName].filter(Boolean).join(' ') || undefined
  const dimensions = { width: size, height: size }

  if (source && objectUrl) {
    return (
      <img
        src={objectUrl}
        alt={label ?? ''}
        style={dimensions}
        className={cn('inline-flex shrink-0 rounded-full object-cover', className)}
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
        'bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center',
        'rounded-full leading-none font-medium select-none',
        className
      )}
    >
      {initials}
    </span>
  )
}
