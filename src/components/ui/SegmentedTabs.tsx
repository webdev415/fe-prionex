/**
 * SegmentedTabs Component
 *
 * Small tab strip with proper tablist/tab semantics, in two visual variants:
 *
 * - `segmented` (default) — pill buttons inside a card container; visual
 *   style follows the existing PeriodTabs on the Reports page.
 * - `underline` — bottom-border tabs on a divider line, as used for
 *   page-level tab strips (e.g. the Reports page tabs).
 */

import { cn } from '@/lib/utils'

export interface SegmentedTabItem<T extends string> {
  id: T
  label: string
}

export interface SegmentedTabsProps<T extends string> {
  items: SegmentedTabItem<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'segmented' | 'underline'
  /** Accessible name for the tablist. */
  ariaLabel?: string
  className?: string
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'segmented',
  ariaLabel,
  className,
}: SegmentedTabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={cn('border-border border-b', className)}>
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="-mb-px flex flex-wrap items-center gap-1"
        >
          {items.map((item) => {
            const isActive = item.id === value
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(item.id)}
                className={cn(
                  'cursor-pointer border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm',
                  isActive
                    ? 'border-secondary text-foreground'
                    : 'hover:border-border text-muted-foreground hover:text-foreground border-transparent'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'bg-card flex w-full items-center gap-1 rounded-lg p-1 shadow-sm sm:w-fit',
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:min-w-[120px] sm:flex-none sm:px-4 sm:text-sm',
              isActive
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedTabs
