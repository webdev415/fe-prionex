import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { OperatorUser } from '@/features/users/api/usersApi'

/**
 * Multi-select employee dropdown rendered to the right of the
 * "Schedule a session" CTA on the Dialogue Evaluation tab. Mirrors the
 * Figma frame — text trigger + checkbox list + apply/clear footer.
 *
 * Operator candidates come from the live project roster (`useOperators`,
 * passed down by the tab) — KAN-737.
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
        <div className="absolute right-0 z-30 mt-1 flex w-[280px] flex-col overflow-hidden rounded-lg border border-[#EBECE8] bg-white shadow-lg">
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

          <ul className="max-h-[240px] overflow-y-auto py-1">
            {candidates.map((row) => {
              const checked = value.includes(row.operatorId)
              return (
                <li key={row.operatorId}>
                  <button
                    type="button"
                    onClick={() => toggle(row.operatorId)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F7F7F7]"
                  >
                    <span
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        checked
                          ? 'border-[#204E4D] bg-[#204E4D] text-white'
                          : 'border-[#DFDFDF] bg-white'
                      }`}
                    >
                      {checked ? <Icons.Checkmark size={10} className="text-white" /> : null}
                    </span>
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
        </div>
      ) : null}
    </div>
  )
}

export default EmployeeMultiSelect
