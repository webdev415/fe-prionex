/**
 * A user's photo, or their initials when there is none.
 *
 * Most users will never upload a photo, so the monogram is the normal case
 * rather than an error state. A broken or unreachable image falls back to it
 * too, so a dead link never leaves an empty disc on the page.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { monogramInitials, monogramSwatch } from '@/lib/avatarMonogram'

export interface UserAvatarProps {
  userId: number | null | undefined
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  avatarUrl?: string | null
  size?: number
  className?: string
}

export function UserAvatar({
  userId,
  firstName,
  lastName,
  fullName,
  avatarUrl,
  size = 32,
  className,
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const initials = monogramInitials(firstName, lastName, fullName)
  const swatch = monogramSwatch(userId)
  const label = fullName || [firstName, lastName].filter(Boolean).join(' ') || undefined

  const shared = cn('inline-flex shrink-0 items-center justify-center rounded-full', className)
  const dimensions = { width: size, height: size }

  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={label ?? ''}
        style={dimensions}
        className={cn(shared, 'object-cover')}
        onError={() => setFailedUrl(avatarUrl)}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        ...dimensions,
        backgroundColor: swatch.background,
        color: swatch.foreground,
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
      className={cn(shared, 'leading-none font-medium select-none')}
    >
      {initials}
    </span>
  )
}
