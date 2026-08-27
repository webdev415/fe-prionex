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
}

/**
 * The bar that follows the reader down the card.
 *
 * Clicking scrolls rather than navigates: every section is already on the
 * page, so replacing it with a route would throw away what has been loaded
 * and lose the reader's place on the way back.
 *
 * The strip scrolls sideways on a narrow screen. Seven tabs do not fit on a
 * phone, and a clipped tab is one nobody can reach.
 */
export function CardTabs({ tabs, activeId, ariaLabel }: CardTabsProps) {
  const goTo = useCallback((id: string) => {
    const section = document.getElementById(id)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }, [])

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="bg-background border-border sticky top-0 z-10 flex gap-1 overflow-x-auto border-b"
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
