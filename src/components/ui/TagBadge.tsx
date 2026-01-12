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

/**
 * Calculate contrast color for text readability
 * Returns white for dark colors, black for light colors
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '')

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Return white for dark colors, dark for light colors
  return luminance > 0.5 ? '#05040D' : '#FFFFFF'
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

  const textColor = getContrastColor(color)
  const backgroundColor = color + '20' // 20% opacity

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-medium',
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor,
        borderColor: color,
        color: textColor,
      }}
    >
      <div className={cn('rounded-full', dotSizes[size])} style={{ backgroundColor: color }} />
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
    </div>
  )
})
