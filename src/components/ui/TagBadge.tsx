/**
 * TagBadge Component
 *
 * Reusable tag badge with custom color and optional remove button.
 * Similar to PriorityBadge, but with dynamic color from tag data.
 */

import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface TagBadgeProps {
  name: string
  color: string
  onRemove?: () => void
  className?: string
  /** `xs` matches compact chips (e.g. Recommenders related-contact pills). */
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** TTL expiration timestamp (ISO string) — shows countdown */
  expiresAt?: string
  /** Payload data — shows tooltip on hover */
  payload?: Record<string, unknown>
  /** System tag — shows lock icon */
  isSystem?: boolean
  /** Protected tag — shows lock icon and disables remove */
  isProtected?: boolean
  /** Expiry type: 'permanent' | 'ttl' | 'loan_closure' | 'target_action_date' */
  expiryType?: 'permanent' | 'ttl' | 'loan_closure' | 'target_action_date'
}

export const TagBadge = memo(function TagBadge({
  name,
  color,
  onRemove,
  className,
  size = 'md',
  expiresAt,
  payload,
  isSystem,
  isProtected,
  expiryType,
}: TagBadgeProps) {
  const { t } = useTranslation('common')
  const showLock = isSystem || isProtected
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] leading-3',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  const dotSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  }

  const gapSizes = {
    xs: 'gap-1',
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-2',
  }

  const iconSize = size === 'xs' || size === 'sm' ? 10 : 12

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
      {showLock && (
        <Icons.Lock
          size={iconSize}
          className="opacity-70"
          aria-label={
            isProtected
              ? t('pages.tags.tagBadge.protectedLabel', 'Protected tag — removal requires approval')
              : t('pages.tags.tagBadge.systemLabel', 'System tag')
          }
        />
      )}
      <span className={cn('rounded-full', dotSizes[size])} style={{ backgroundColor: color }} />
      <span>{name}</span>
      {expiryType === 'loan_closure' && (
        <span
          className="opacity-70"
          title={t('pages.tags.tagBadge.loanClosureTitle', 'Active until loan closure')}
        >
          <Icons.Money04 size={iconSize} />
        </span>
      )}
      {expiresAt && (
        <span
          className="opacity-70"
          title={`${t('pages.tags.tagBadge.expiresPrefix', 'Expires')}: ${new Date(expiresAt).toLocaleString()}`}
        >
          <Icons.Clock01 size={iconSize} />
        </span>
      )}
      {payload && Object.keys(payload).length > 0 && (
        <span className="opacity-70" title={JSON.stringify(payload, null, 2)}>
          <Icons.Info size={iconSize} />
        </span>
      )}
      {onRemove && !showLock && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 transition-opacity hover:opacity-70"
          aria-label={t('pages.tags.tagBadge.removeLabel', 'Remove {{name}} tag', { name })}
        >
          <Icons.Delete size={size === 'xs' || size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
        </button>
      )}
    </span>
  )
})
