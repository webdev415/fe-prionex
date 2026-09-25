/**
 * The operator list every assignee control on the client card shares.
 *
 * One list, one set of rules — search, name over department, a tick on the
 * current value, PINNED above ALL EMPLOYEES — instead of each control growing
 * its own. The inline popover on the client card and the picker inside the
 * assign modals differ only in what they do with a click, so that is the one
 * thing left to the caller.
 *
 * Presentational by design: it never assigns and never pins. The inline popover
 * saves on click, the modals stage the choice until Assign, and pinning is the
 * caller's mutation — a component that did any of it could not serve both.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { HOTKEY_BLOCKING_ATTR } from '@/features/taHotkeys/hotkey'
import { Icons } from '@/lib/icons'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'

export interface AssigneeOption {
  id: number
  full_name: string
  department_name?: string | null
}

/**
 * Keyboard focus ring for every button in the list and its footer.
 *
 * Without it the browser draws its own black outline, which shows the moment a
 * key is pressed after a pin toggle hands focus back to the pin. Inset because
 * the rows run edge to edge inside a scrolling box that would clip an outer ring.
 */
export const ASSIGNEE_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500'

/** Shared empty set, so an unpinned caller does not allocate one per render. */
const NO_PINS: ReadonlySet<number> = new Set()

/**
 * Move the assigned operator to the front of the rows given, in place.
 *
 * Applied per section rather than once over the whole list: an assigned
 * operator who is also pinned belongs first among the pinned, not lifted out of
 * that section to the top of everything.
 */
function floatAssignedFirst(rows: AssigneeOption[], selectedId: number | null): void {
  const index = rows.findIndex((operator) => operator.id === selectedId)
  if (index > 0) rows.unshift(rows.splice(index, 1)[0])
}

interface Props {
  operators: AssigneeOption[]
  isLoading?: boolean
  /** Who holds the slot today, so the row can be ticked and floated to the top. */
  selectedId: number | null
  onSelect: (id: number) => void
  /** Blocks assign clicks while the caller is saving; the list stays readable. */
  disabled?: boolean
  /** Focus the search box on mount — the popovers open straight into typing. */
  autoFocusSearch?: boolean
  /** Rendered below the list. The inline popover puts "Unassign" here. */
  footer?: ReactNode
  /**
   * Accessible name for the option list itself.
   *
   * Lives here because the `role="listbox"` it names is here too — see the
   * comment on that element for why it cannot sit on the caller's panel.
   */
  listLabel?: string
  /** Operators this user pinned. Omitted means the list renders unsectioned. */
  pinnedIds?: ReadonlySet<number>
  /**
   * Toggle a pin. Omitting it hides the pin buttons entirely, which is what
   * makes the pin affordance opt-in rather than something every caller inherits.
   */
  onTogglePin?: (operatorId: number, nextPinned: boolean) => void
}

export function AssigneeOptionList({
  operators,
  isLoading = false,
  selectedId,
  onSelect,
  disabled = false,
  autoFocusSearch = false,
  footer,
  listLabel,
  pinnedIds,
  onTogglePin,
}: Props) {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)

  // Focused through a ref rather than the `autoFocus` attribute, which
  // jsx-a11y forbids: on a page it steals focus from wherever the reader was.
  // Here the list only ever mounts because somebody opened the picker, so
  // landing in the search box is what they asked for.
  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus()
  }, [autoFocusSearch])

  const { pinnedRows, otherRows } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? operators.filter((o) => (o.full_name || '').toLowerCase().includes(needle))
      : operators.slice()

    const pins = pinnedIds ?? NO_PINS
    const pinned: AssigneeOption[] = []
    const others: AssigneeOption[] = []
    for (const operator of matched) {
      if (pins.has(operator.id)) pinned.push(operator)
      else others.push(operator)
    }

    // Each section floats its own assigned row, so the current value is visible
    // without scrolling a list that runs to a few hundred people.
    floatAssignedFirst(pinned, selectedId)
    floatAssignedFirst(others, selectedId)
    return { pinnedRows: pinned, otherRows: others }
  }, [operators, query, selectedId, pinnedIds])

  const isEmpty = pinnedRows.length === 0 && otherRows.length === 0

  // A pin toggle moves its row into the other section, which remounts it, so
  // the pin button that held focus is gone and focus falls to <body>. Put it
  // back on the same operator's pin once the move has rendered — the keyboard
  // user keeps their place. Keyed on `pinnedIds` because the move lands when
  // the pin set changes, which is after the click (the cache update is async).
  const listRef = useRef<HTMLDivElement | null>(null)
  const refocusPinFor = useRef<number | null>(null)
  useEffect(() => {
    const operatorId = refocusPinFor.current
    if (operatorId === null) return
    const pin = listRef.current?.querySelector<HTMLButtonElement>(`[data-pin-for="${operatorId}"]`)
    if (pin && pin !== document.activeElement) {
      pin.focus()
      refocusPinFor.current = null
    }
  }, [pinnedIds])

  const renderRow = (operator: AssigneeOption) => {
    const isAssigned = operator.id === selectedId
    const isPinned = (pinnedIds ?? NO_PINS).has(operator.id)
    const pinLabel = isPinned
      ? t('pages.clients.assignee.unpin', 'Unpin')
      : t('pages.clients.assignee.pin', 'Pin')

    return (
      // `role="presentation"` keeps this wrapper out of the accessibility tree,
      // so the option below is exposed as a direct child of its section rather
      // than buried under a plain div.
      <div key={operator.id} role="presentation" className="flex w-full items-center gap-0.5">
        <button
          type="button"
          role="option"
          aria-selected={isAssigned}
          disabled={disabled}
          onClick={() => onSelect(operator.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left',
            ASSIGNEE_FOCUS_RING,
            !disabled && 'hover:bg-muted cursor-pointer',
            disabled && 'cursor-wait opacity-60'
          )}
        >
          {/* Operator names are personal data: masked in session recordings.
              Marked here rather than on the panel because the inline popover
              renders through a portal, which markup on an ancestor cannot reach. */}
          <span className="min-w-0 flex-1" {...piiProps}>
            <span className="text-foreground block truncate text-xs">{operator.full_name}</span>
            {/* A dash, not a blank: most operators carry no department, and an
                empty line reads as a render fault rather than as missing data. */}
            <span className="text-muted-foreground block truncate text-[10px] font-light">
              {operator.department_name || '—'}
            </span>
          </span>
          {isAssigned && <Icons.Tick01 size={12} className="text-primary-500 shrink-0" />}
        </button>

        {onTogglePin && (
          // A sibling of the option, never nested inside it. Nesting would be
          // invalid HTML and would make one click mean two things; as siblings,
          // a press here simply never reaches the assign handler, so pinning
          // cannot assign and cannot close the popover.
          <button
            type="button"
            aria-label={pinLabel}
            title={pinLabel}
            aria-pressed={isPinned}
            data-pin-for={operator.id}
            onClick={() => {
              refocusPinFor.current = operator.id
              onTogglePin(operator.id, !isPinned)
            }}
            className={cn(
              'hover:bg-muted shrink-0 cursor-pointer rounded-md p-1.5',
              ASSIGNEE_FOCUS_RING,
              isPinned ? 'text-primary-500' : 'text-muted-foreground'
            )}
          >
            <Icons.Pin size={13} />
          </button>
        )}
      </div>
    )
  }

  const renderSection = (rows: AssigneeOption[], label: string) =>
    rows.length === 0 ? null : (
      <div role="group" aria-label={label} className="flex flex-col gap-px">
        {/* Hidden from assistive tech because the group already carries the
            same name; on screen it is what separates the two sections. */}
        <div
          aria-hidden="true"
          className="text-muted-foreground px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide uppercase"
        >
          {label}
        </div>
        {rows.map(renderRow)}
      </div>
    )

  return (
    <>
      <div className="relative">
        <Icons.Search
          size={13}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
        />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          placeholder={t('pages.clients.assignee.searchPlaceholder', 'Search employee')}
          aria-label={t('pages.clients.assignee.searchPlaceholder', 'Search employee')}
          className="border-border text-foreground h-8 w-full rounded-lg border pr-2 pl-7 text-xs font-light outline-none"
        />
      </div>

      {/* Mounted only while a picker is open, so this marker is what silences
          TA quick-launch for exactly that long — see HOTKEY_BLOCKING_ATTR. */}
      <div
        {...{ [HOTKEY_BLOCKING_ATTR]: '' }}
        className="mt-1.5 flex max-h-54 flex-col gap-px overflow-auto"
      >
        {isLoading ? (
          <p className="text-muted-foreground px-2 py-2.5 text-xs">
            {t('common.loading', 'Loading...')}
          </p>
        ) : isEmpty ? (
          <p className="text-muted-foreground px-2 py-2.5 text-xs">
            {t('pages.clients.assignee.noMatches', 'No matches')}
          </p>
        ) : null}

        {/* The listbox wraps the options and nothing else.

            It cannot sit on the caller's panel, which is where it used to be:
            that panel also holds the search field and the section headings, and
            a listbox may only contain options and groups. It cannot simply be
            dropped either — the TA hotkey guard suppresses quick-launch keys for
            any keypress inside `[role="listbox"], [role="option"], …`, so
            removing the role would let hotkeys fire under an open popover with
            no test to notice. Narrowing it to the options satisfies both. */}
        <div ref={listRef} role="listbox" aria-label={listLabel} className="flex flex-col gap-px">
          {!isLoading && (
            <>
              {renderSection(pinnedRows, t('pages.clients.assignee.pinned', 'Pinned'))}
              {renderSection(otherRows, t('pages.clients.assignee.allEmployees', 'All employees'))}
            </>
          )}

          {footer}
        </div>
      </div>
    </>
  )
}
