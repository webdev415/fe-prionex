/**
 * SegmentedTabs Component
 *
 * Small segmented tab strip (pill buttons inside a card container) with
 * proper tablist/tab semantics. Visual style follows the existing
 * PeriodTabs on the Reports page.
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
  /** Accessible name for the tablist. */
  ariaLabel?: string
  className?: string
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedTabsProps<T>) {
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
