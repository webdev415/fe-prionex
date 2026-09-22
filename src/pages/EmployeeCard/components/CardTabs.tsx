import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
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

/** How much of the strip one press of an arrow moves. */
const NUDGE = 200

/** Room left either side of a tab when the bar brings it back into view. */
const MARGIN = 24

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
 * On a narrow screen the seven tabs do not fit, so the strip scrolls sideways
 * - without a scrollbar, which would sit across the tabs themselves, and with
 * an arrow at whichever end still has tabs behind it. The arrows are the only
 * thing left saying there is more, so they appear exactly when there is.
 *
 * And when scrolling the card makes a tab active, the bar brings that tab back
 * into view. Otherwise the underline moves to somewhere nobody can see, and
 * the bar reads as though it has stopped following along.
 */
export function CardTabs({ tabs, activeId, ariaLabel, onSelect }: CardTabsProps) {
  const { t } = useTranslation()
  const strip = useRef<HTMLDivElement>(null)
  const [covered, setCovered] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const element = strip.current
    if (!element) return
    const room = element.scrollWidth - element.clientWidth
    setCovered({
      left: element.scrollLeft > 1,
      right: element.scrollLeft < room - 1,
    })
  }, [])

  useEffect(() => {
    const element = strip.current
    if (!element) return

    measure()
    element.addEventListener('scroll', measure, { passive: true })

    // The strip's width follows the window, and the tabs' widths follow the
    // language, so neither can be measured once and trusted.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure())
    observer?.observe(element)
    window.addEventListener('resize', measure)

    return () => {
      element.removeEventListener('scroll', measure)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, tabs])

  /*
   * Set on the strip rather than through ``scrollIntoView``: that walks up the
   * ancestors and would scroll the card itself as well, moving the reader to a
   * different section than the one they are on.
   */
  useEffect(() => {
    const element = strip.current
    const tab = element?.querySelector<HTMLElement>(`[data-tab="${activeId}"]`)
    if (!element || !tab) return

    const start = tab.offsetLeft
    const end = start + tab.offsetWidth

    if (start < element.scrollLeft) {
      element.scrollLeft = Math.max(0, start - MARGIN)
    } else if (end > element.scrollLeft + element.clientWidth) {
      element.scrollLeft = end - element.clientWidth + MARGIN
    }
  }, [activeId])

  const nudge = (direction: -1 | 1) => {
    const element = strip.current
    if (!element) return
    element.scrollBy({ left: direction * NUDGE, behavior: 'smooth' })
  }

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

  const arrow = (side: 'left' | 'right') => (
    <button
      type="button"
      aria-label={t(`pages.employeeCard.tabs.${side === 'left' ? 'showEarlier' : 'showLater'}`)}
      onClick={() => nudge(side === 'left' ? -1 : 1)}
      className={cn(
        'from-background absolute inset-y-0 z-10 flex w-14 cursor-pointer items-center bg-gradient-to-r to-transparent',
        side === 'left'
          ? 'left-0 justify-start bg-gradient-to-r'
          : 'right-0 justify-end bg-gradient-to-l'
      )}
    >
      {side === 'left' ? (
        <Icons.ArrowLeft size={18} strokeWidth={1.8} className="text-foreground" />
      ) : (
        <Icons.ArrowRight size={18} strokeWidth={1.8} className="text-foreground" />
      )}
    </button>
  )

  return (
    <div className="relative">
      <div
        ref={strip}
        role="tablist"
        aria-label={ariaLabel}
        className="border-border flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab={tab.id}
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

      {covered.left && arrow('left')}
      {covered.right && arrow('right')}
    </div>
  )
}
