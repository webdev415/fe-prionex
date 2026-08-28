import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { OperatorUser } from '@/features/users/api/usersApi'

/**
 * Multi-select employee filter on the Dialogue Evaluation tab: text trigger +
 * checkbox list, with an optional pinned shortcut row on top.
 *
 * Operator candidates come from the live project roster (`useOperators`,
 * passed down by the tab).
 */
export interface EmployeeMultiSelectProps {
  value: number[]
  onChange: (next: number[]) => void
  operators: OperatorUser[]
  /** Pinned shortcut at the top of the list (e.g. "My employees"). Selecting it
   *  replaces the current selection with ``ids``; selecting it again clears. */
  quickSelect?: {
    label: string
    ids: number[]
    disabled?: boolean
    hint?: string
  }
}

const AVATAR_PALETTE = [
  '#E0F2EC',
  '#FEF3C7',
  '#FEE4E2',
  '#E0E7FF',
  '#FCE7F3',
  '#DBEAFE',
  '#FFEDD5',
  '#D1FAE5',
] as const

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

/** The minimal operator shape the search list needs — dialogs pass anything
 *  from the full `OperatorUser` down to `{ id, full_name }` literals. */
export interface EmployeeOption {
  id: number
  full_name: string | null
}

export interface EmployeeSearchListProps {
  operators: EmployeeOption[]
  /** Checked ids — rows render a checkbox when provided (multi-select mode).
   *  Omit for single-pick mode (plain rows, `onSelect` picks). */
  selectedIds?: number[]
  /** Row click: toggles the id in multi mode, picks it in single mode. */
  onSelect: (id: number) => void
  /** Operators to hide entirely (e.g. already taken by another slot). */
  excludeIds?: number[]
  /** Height cap for the scrolling list (defaults to `max-h-[240px]`). */
  listClassName?: string
}

/**
 * The one searchable employee roster («Навчання» п.1/2/5): a name filter on
 * top of a checkbox (multi) or click-to-pick (single) list. Reused by the
 * EmployeeMultiSelect dropdown below and inline inside the assign dialogs —
 * build new employee pickers on top of this instead of another search impl.
 */
export function EmployeeSearchList({
  operators,
  selectedIds,
  onSelect,
  excludeIds,
  listClassName,
}: EmployeeSearchListProps) {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const excluded = excludeIds && excludeIds.length > 0 ? new Set(excludeIds) : null
    const q = query.trim().toLowerCase()
    return operators
      .map((op, i) => {
        const name = op.full_name ?? `#${op.id}`
        return {
          id: op.id,
          name,
          initials: initialsFor(name),
          avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
        }
      })
      .filter((row) => !excluded?.has(row.id))
      .filter((row) => !q || row.name.toLowerCase().includes(q))
  }, [operators, excludeIds, query])

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative border-b border-[#EBECE8] p-2">
        <Icons.Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#9CA3AF]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('pages.training.dialogue.employee.searchPlaceholder', 'Search by name…')}
          aria-label={t('pages.training.dialogue.employee.searchPlaceholder', 'Search by name…')}
          className="h-8 w-full rounded-md border border-[#EBECE8] bg-white pr-2 pl-8 text-xs text-[#05040D] placeholder:text-[#9CA3AF] focus:outline-none"
        />
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-center text-[11px] text-[#9CA3AF]">
          {t('pages.training.dialogue.employee.noMatches', 'No employees found')}
        </p>
      ) : (
        <ul className={`overflow-y-auto py-1 ${listClassName ?? 'max-h-[240px]'}`}>
          {rows.map((row) => {
            const checked = selectedIds?.includes(row.id) ?? false
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F7F7F7]"
                >
                  {selectedIds ? (
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'border-[#204E4D] bg-[#204E4D] text-white'
                          : 'border-[#DFDFDF] bg-white'
                      }`}
                    >
                      {checked ? <Icons.Checkmark size={10} className="text-white" /> : null}
                    </span>
                  ) : null}
                  <div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-[#05040D]"
                    style={{ backgroundColor: row.avatarColor }}
                  >
                    {row.initials}
                  </div>
                  <span className="truncate text-xs text-[#05040D]">{row.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function EmployeeMultiSelect({
  value,
  onChange,
  operators,
  quickSelect,
}: EmployeeMultiSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const candidates = useMemo(
    () =>
      operators.map((op, i) => {
        const name = op.full_name ?? `#${op.id}`
        return {
          operatorId: op.id,
          name,
          initials: initialsFor(name),
          avatarColor: AVATAR_PALETTE[i % AVATAR_PALETTE.length],
        }
      }),
    [operators]
  )

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const toggle = (operatorId: number) => {
    if (value.includes(operatorId)) {
      onChange(value.filter((id) => id !== operatorId))
    } else {
      onChange([...value, operatorId])
    }
  }

  const clearAll = () => onChange([])
  const selectAll = () => onChange(candidates.map((r) => r.operatorId))

  // The shortcut reads as "on" only when the selection is exactly its set.
  const quickActive =
    quickSelect != null &&
    quickSelect.ids.length > 0 &&
    value.length === quickSelect.ids.length &&
    quickSelect.ids.every((id) => value.includes(id))

  const toggleQuickSelect = () => {
    if (!quickSelect || quickSelect.disabled) return
    onChange(quickActive ? [] : quickSelect.ids)
  }

  const triggerLabel = quickActive
    ? (quickSelect?.label ?? '')
    : value.length === 0
      ? t('pages.training.dialogue.employee.all', 'All employees')
      : value.length === 1
        ? (candidates.find((r) => r.operatorId === value[0])?.name ?? '')
        : t('pages.training.dialogue.employee.selected', '{{count}} selected', {
            count: value.length,
          })

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-[#EBECE8] bg-white px-3 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#F7F7F7]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icons.UserMultiple02 size={14} className="text-[#676767]" />
        <span className="truncate">{triggerLabel}</span>
        {value.length > 0 ? (
          <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#BBFB5B] px-1.5 text-[10px] font-semibold text-[#05040D]">
            {value.length}
          </span>
        ) : null}
        <Icons.ArrowDown size={12} className="text-[#676767]" />
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-1 flex w-[280px] flex-col overflow-hidden rounded-lg border border-[#EBECE8] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#EBECE8] px-3 py-2 text-[11px] text-[#676767]">
            <span>
              {t('pages.training.dialogue.employee.label', 'Employee')}{' '}
              <span className="text-[#05040D]">({candidates.length})</span>
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={selectAll} className="text-[#204E4D] hover:underline">
                {t('pages.training.dialogue.employee.selectAll', 'Select all')}
              </button>
              <span aria-hidden>·</span>
              <button type="button" onClick={clearAll} className="text-[#204E4D] hover:underline">
                {t('pages.training.dialogue.employee.clear', 'Clear')}
              </button>
            </div>
          </div>
          {quickSelect ? (
            <button
              type="button"
              onClick={toggleQuickSelect}
              disabled={quickSelect.disabled}
              title={quickSelect.hint}
              className={`flex w-full items-center gap-2 border-b border-[#EBECE8] px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                quickActive ? 'bg-[#F7FFE5] text-[#204E4D]' : 'text-[#05040D] hover:bg-[#F7F7F7]'
              }`}
            >
              <span
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  quickActive
                    ? 'border-[#204E4D] bg-[#204E4D] text-white'
                    : 'border-[#DFDFDF] bg-white'
                }`}
              >
                {quickActive ? <Icons.Checkmark size={10} className="text-white" /> : null}
              </span>
              <span className="truncate">{quickSelect.label}</span>
              <span className="ml-auto text-[10px] text-[#676767]">({quickSelect.ids.length})</span>
            </button>
          ) : null}

          <EmployeeSearchList operators={operators} selectedIds={value} onSelect={toggle} />
        </div>
      ) : null}
    </div>
  )
}

export default EmployeeMultiSelect
