/**
 * Small badge pill used everywhere a document type is displayed.
 *
 * Mirrors the ``TagBadge`` styling (colored dot + light-tinted
 * background + solid border + solid text in the type's admin-picked
 * HEX). Keeps display in sync with whatever the admin picked without
 * needing a Tailwind rebuild.
 */

import { cn } from '@/lib/utils'

interface DocumentTypePillProps {
  name: string
  hex: string
  className?: string
  isHidden?: boolean
}

export function DocumentTypePill({ name, hex, className, isHidden }: DocumentTypePillProps) {
  // ``+ '20'`` = ~12.5% alpha tint on the background so the text +
  // border color stay comfortably readable on top. Same trick as
  // TagBadge.
  const background = `${hex}20`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        isHidden && 'italic opacity-70',
        className
      )}
      style={{
        backgroundColor: background,
        borderColor: hex,
        color: hex,
      }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: hex }} />
      <span>{name}</span>
    </span>
  )
}
