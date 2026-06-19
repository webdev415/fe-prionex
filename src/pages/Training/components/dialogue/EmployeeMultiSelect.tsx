import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_INBOX_ROWS } from '../../mocks/trainerWorkplaceMocks'

/**
 * Multi-select employee dropdown rendered to the right of the
 * "Schedule a session" CTA on the Dialogue Evaluation tab. Mirrors the
 * Figma frame — text trigger + checkbox list + apply/clear footer.
 *
 * Pulls operator candidates from `MOCK_INBOX_ROWS` so the mock data stays
 * consistent across tabs.
 */
export interface EmployeeMultiSelectProps {
  value: number[]
  onChange: (next: number[]) => void
}

export function EmployeeMultiSelect({ value, onChange }: EmployeeMultiSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

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
  const selectAll = () => onChange(MOCK_INBOX_ROWS.map((r) => r.operatorId))

  const triggerLabel =
    value.length === 0
      ? t('pages.training.dialogue.employee.all', 'All employees')
      : value.length === 1
        ? (MOCK_INBOX_ROWS.find((r) => r.operatorId === value[0])?.name ?? '')
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
              <span className="text-[#05040D]">({MOCK_INBOX_ROWS.length})</span>
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
          <ul className="max-h-[240px] overflow-y-auto py-1">
            {MOCK_INBOX_ROWS.map((row) => {
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
