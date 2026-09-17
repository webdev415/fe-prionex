/**
 * The operator list every assignee control on the client card shares.
 *
 * One list, one set of rules — search, name over department, a tick on the
 * current value — instead of each control growing its own. The inline popover
 * on the client card and the picker inside the assign modals differ only in
 * what they do with a click, so that is the one thing left to the caller.
 *
 * Presentational by design: it never assigns anything. The inline popover saves
 * on click, the modals stage the choice until Assign — a component that saved
 * could not serve both.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface AssigneeOption {
  id: number
  full_name: string
  department_name?: string | null
}

interface Props {
  operators: AssigneeOption[]
  isLoading?: boolean
  /** Who holds the slot today, so the row can be ticked and floated to the top. */
  selectedId: number | null
  onSelect: (id: number) => void
  /** Blocks clicks while the caller is saving; the list stays readable. */
  disabled?: boolean
  /** Focus the search box on mount — the popovers open straight into typing. */
  autoFocusSearch?: boolean
  /** Rendered below the list. The inline popover puts "Unassign" here. */
  footer?: ReactNode
}

export function AssigneeOptionList({
  operators,
  isLoading = false,
  selectedId,
  onSelect,
  disabled = false,
  autoFocusSearch = false,
  footer,
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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle
      ? operators.filter((o) => (o.full_name || '').toLowerCase().includes(needle))
      : operators.slice()
    // The assigned operator sits first, so the current value is visible without
    // scrolling a list that runs to a few hundred people.
    const assignedIndex = matched.findIndex((o) => o.id === selectedId)
    if (assignedIndex > 0) matched.unshift(matched.splice(assignedIndex, 1)[0])
    return matched
  }, [operators, query, selectedId])

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

      <div className="mt-1.5 flex max-h-54 flex-col gap-px overflow-auto">
        {isLoading ? (
          <p className="text-muted-foreground px-2 py-2.5 text-xs">
            {t('common.loading', 'Loading...')}
          </p>
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground px-2 py-2.5 text-xs">
            {t('pages.clients.assignee.noMatches', 'No matches')}
          </p>
        ) : (
          <>
            <div className="text-muted-foreground px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide uppercase">
              {t('pages.clients.assignee.allEmployees', 'All employees')}
            </div>
            {visible.map((operator) => {
              const isAssigned = operator.id === selectedId
              return (
                <button
                  key={operator.id}
                  type="button"
                  role="option"
                  aria-selected={isAssigned}
                  disabled={disabled}
                  onClick={() => onSelect(operator.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                    !disabled && 'hover:bg-muted cursor-pointer',
                    disabled && 'cursor-wait opacity-60'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate text-xs">
                      {operator.full_name}
                    </span>
                    {/* A dash, not a blank: most operators carry no department,
                        and an empty line reads as a render fault rather than as
                        missing data. */}
                    <span className="text-muted-foreground block truncate text-[10px] font-light">
                      {operator.department_name || '—'}
                    </span>
                  </span>
                  {isAssigned && <Icons.Tick01 size={12} className="text-primary-500 shrink-0" />}
                </button>
              )
            })}
          </>
        )}

        {footer}
      </div>
    </>
  )
}
