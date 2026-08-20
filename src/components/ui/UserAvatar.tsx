/**
 * A user's photo, or their initials when there is none.
 *
 * Most users will never upload a photo, so the monogram is the normal case
 * rather than an error state. It takes its colours from the theme so it matches
 * the container it sits in, in light and dark alike. A broken or unreachable
 * image falls back to it too, so a dead link never leaves an empty disc.
 *
 * The stored path is server-relative, so it is resolved against the API host
 * before it reaches the browser - see resolveAssetUrl.
 */

import { useState } from 'react'
import { monogramInitials } from '@/lib/avatarMonogram'
import { resolveAssetUrl } from '@/lib/api'
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const src = resolveAssetUrl(avatarUrl)
  const initials = monogramInitials(firstName, lastName, fullName)
  const label = fullName || [firstName, lastName].filter(Boolean).join(' ') || undefined
  const dimensions = { width: size, height: size }

  if (src && failedUrl !== src) {
    return (
      <img
        src={src}
        alt={label ?? ''}
        style={dimensions}
        className={cn('inline-flex shrink-0 rounded-full object-cover', className)}
        onError={() => setFailedUrl(src)}
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
