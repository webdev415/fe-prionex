/* eslint-disable react-refresh/only-export-components -- id helpers belong
   with the component (same precedent as Button.tsx's buttonVariants) */
/**
 * SegmentedTabs Component
 *
 * Tab strip with full tablist semantics — roving tabIndex (0 on the active
 * tab, -1 elsewhere) and ArrowLeft / ArrowRight / Home / End keyboard
 * navigation (selection follows focus by default, see `activation`) — in two
 * visual variants:
 *
 * - `segmented` (default) — pill buttons inside a card container; visual
 *   style follows the existing PeriodTabs on the Reports page.
 * - `underline` — bottom-border tabs on a divider line, as used for
 *   page-level tab strips (e.g. the Reports page tabs).
 *
 * Pass `idPrefix` to link tabs with their panels: each tab gets
 * `id={segmentedTabId(idPrefix, item.id)}` and
 * `aria-controls={segmentedTabPanelId(idPrefix, item.id)}`; give the panel
 * container the matching id plus `role="tabpanel"` and
 * `aria-labelledby={segmentedTabId(idPrefix, activeId)}`:
 *
 * ```tsx
 * <SegmentedTabs idPrefix="reports" items={items} value={active} onChange={setActive} />
 * <div
 *   role="tabpanel"
 *   id={segmentedTabPanelId('reports', active)}
 *   aria-labelledby={segmentedTabId('reports', active)}
 * >
 *   …
 * </div>
 * ```
 */

import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedTabItem<T extends string> {
  id: T
  label: string
  /**
   * Native tooltip — hover recovery for a label the tab may constrain
   * visually, and harmless redundancy when it does not. Purely additive: the
   * accessible name still comes from the label content.
   */
  title?: string
  /**
   * Per-item classes, merged after the variant classes. Optional and off by
   * default, so existing strips render exactly as before.
   *
   * Width capping (`max-w-*`) ellipsizes the label in the `segmented` variant
   * only: there the button is a flex container, so the label span is a flex
   * item that `min-w-0` lets shrink below its content and `truncate` can then
   * clip. The `underline` variant's button is not a flex container — its span
   * stays inline, where `overflow: hidden` has nothing to clip against — so a
   * cap there would need the span made `inline-block` first.
   */
  className?: string
}

export interface SegmentedTabsProps<T extends string> {
  items: SegmentedTabItem<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'segmented' | 'underline'
  /**
   * How arrow keys relate to selection (ARIA APG "tabs" pattern):
   * - `automatic` (default) — selection follows focus; fine when switching is
   *   cheap (e.g. client-side filtering).
   * - `manual` — arrows / Home / End only move focus, Enter or Space selects
   *   (native button activation). Use it when a switch is expensive: it
   *   unmounts the panel, refires requests or pushes a history entry.
   */
  activation?: 'automatic' | 'manual'
  /** Accessible name for the tablist. */
  ariaLabel?: string
  /** When set, tabs get stable ids and aria-controls (see the docblock example). */
  idPrefix?: string
  className?: string
}

/** DOM id of a tab button when `idPrefix` is set. */
export function segmentedTabId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-tab-${tabId}`
}

/** DOM id the matching `role="tabpanel"` container should carry. */
export function segmentedTabPanelId(idPrefix: string, tabId: string): string {
  return `${idPrefix}-panel-${tabId}`
}

const SEGMENTED_BUTTON_CLASS =
  'flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:min-w-[120px] sm:flex-none sm:px-4 sm:text-sm'

const UNDERLINE_BUTTON_CLASS =
  'cursor-pointer border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm'

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'segmented',
  activation = 'automatic',
  ariaLabel,
  idPrefix,
  className,
}: SegmentedTabsProps<T>) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Roving tabIndex needs exactly one reachable tab. If `value` matches no
  // item (stale/unknown selection) the whole strip would otherwise fall out
  // of the tab order — the APG fallback is to make the first tab reachable.
  const activeIndex = items.findIndex((item) => item.id === value)
  const rovingIndex = activeIndex === -1 ? 0 : activeIndex

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Leave modified keystrokes to the browser (Alt+Arrow = history
    // navigation, etc.) — precedent: Radix RovingFocusGroup.
    if (event.ctrlKey || event.altKey || event.metaKey) return
    let next: number | null = null
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next === null || items.length === 0) return
    event.preventDefault()
    // Manual activation moves focus only — Enter/Space then selects through
    // the button's native activation (onClick), so no key handling is needed
    // for it here (and none that could double-fire alongside the click).
    if (activation === 'automatic') onChange(items[next].id)
    buttonRefs.current[next]?.focus()
  }

  const buttons = items.map((item, index) => {
    const isActive = item.id === value
    return (
      <button
        key={item.id}
        ref={(el) => {
          buttonRefs.current[index] = el
        }}
        type="button"
        role="tab"
        id={idPrefix ? segmentedTabId(idPrefix, item.id) : undefined}
        // Only the active tab's panel exists in the DOM (consumers render a
        // single tabpanel), so inactive tabs must not reference a missing id.
        aria-controls={idPrefix && isActive ? segmentedTabPanelId(idPrefix, item.id) : undefined}
        aria-selected={isActive}
        tabIndex={index === rovingIndex ? 0 : -1}
        title={item.title}
        onClick={() => onChange(item.id)}
        onKeyDown={(event) => handleKeyDown(event, index)}
        className={cn(
          variant === 'underline' ? UNDERLINE_BUTTON_CLASS : SEGMENTED_BUTTON_CLASS,
          variant === 'underline'
            ? isActive
              ? 'border-secondary text-foreground'
              : 'hover:border-border text-muted-foreground hover:text-foreground border-transparent'
            : isActive
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-card text-muted-foreground hover:bg-muted',
          item.className
        )}
      >
        {/* The span (not the button itself) is what `text-overflow` can
            ellipsize when a `segmented` item's className caps its width — the
            button is a flex container there, so this is a shrinkable flex item.
            Unconstrained strips render identically to the bare text node this
            replaced. */}
        <span className="min-w-0 truncate">{item.label}</span>
      </button>
    )
  })

  if (variant === 'underline') {
    return (
      <div className={cn('border-border border-b', className)}>
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="-mb-px flex flex-wrap items-center gap-1"
        >
          {buttons}
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
      {buttons}
    </div>
  )
}
