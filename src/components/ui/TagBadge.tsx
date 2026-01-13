/**
 * TagBadge Component
 *
 * Reusable tag badge with custom color and optional remove button.
 * Similar to PriorityBadge, but with dynamic color from tag data.
 */

import { memo } from 'react'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  name: string
  color: string
  onRemove?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export const TagBadge = memo(function TagBadge({
  name,
  color,
  onRemove,
  className,
  size = 'md',
}: TagBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }

  const gapSizes = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-2',
  }

  // Use tag color directly for text (matching data table style)
  const textColor = color
  const backgroundColor = color + '20' // 20% opacity

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        sizeClasses[size],
        gapSizes[size],
        className
      )}
      style={{
        backgroundColor,
        borderColor: color,
        color: textColor,
      }}
    >
      <span className={cn('rounded-full', dotSizes[size])} style={{ backgroundColor: color }} />
      <span>{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 transition-opacity hover:opacity-70"
          aria-label={`Remove ${name} tag`}
        >
          <Icons.Delete size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
        </button>
      )}
    </span>
  )
})
