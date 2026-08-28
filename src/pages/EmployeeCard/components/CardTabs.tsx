import { useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface CardTab {
  id: string
  label: string
}

export interface CardTabsProps {
  tabs: CardTab[]
  activeId: string
  ariaLabel: string
  /** Told which section was asked for, so the bar can answer before the scroll arrives. */
  onSelect?: (id: string) => void
}

/**
 * The bar that follows the reader down the card.
 *
 * Clicking scrolls rather than navigates: every section is already on the
 * page, so replacing it with a route would throw away what has been loaded
 * and lose the reader's place on the way back.
 *
 * The bar marks what was clicked straight away rather than waiting to be told
 * by the scroll. The last sections can all fit on one screen, and then the
 * scroll cannot move far enough for the one that was asked for to become the
 * answer - the click would appear to do nothing.
 *
 * The strip scrolls sideways on a narrow screen. Seven tabs do not fit on a
 * phone, and a clipped tab is one nobody can reach.
 */
export function CardTabs({ tabs, activeId, ariaLabel, onSelect }: CardTabsProps) {
  const goTo = useCallback(
    (id: string) => {
      const section = document.getElementById(id)
      if (!section) return
      onSelect?.(id)
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      section.focus({ preventScroll: true })
    },
    [onSelect]
  )

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="border-border flex gap-1 overflow-x-auto border-b"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={tab.id}
            onClick={() => goTo(tab.id)}
            className={cn(
              'shrink-0 border-b-2 px-4 py-3 text-sm whitespace-nowrap transition-colors',
              isActive
                ? 'border-primary-500 text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
