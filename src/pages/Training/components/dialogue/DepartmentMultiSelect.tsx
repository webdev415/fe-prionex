import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

/**
 * Multi-select department filter on the Dialogue Evaluation tab: text trigger
 * + checkbox list, modelled on the neighbouring EmployeeMultiSelect.
 *
 * An EMPTY selection means «all departments» — the same semantics the backend
 * gives an omitted `department_ids`, so the trigger label and the request stay
 * in step.
 */
export interface DepartmentOption {
  id: number
  name: string
}

export interface DepartmentMultiSelectProps {
  value: number[]
  onChange: (next: number[]) => void
  options: DepartmentOption[]
  /** Locked by the page scope (e.g. scope=department pins the department). */
  disabled?: boolean
  /** Tooltip explaining why the picker is locked. */
  disabledHint?: string
}

export function DepartmentMultiSelect({
  value,
  onChange,
  options,
  disabled = false,
  disabledHint,
}: DepartmentMultiSelectProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const allLabel = t('pages.training.dialogue.dialogs.allDepartments', 'All departments')
  const triggerLabel =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (options.find((d) => d.id === value[0])?.name ?? `#${value[0]}`)
        : t('pages.training.dialogue.department.selected', '{{count}} departments', {
            count: value.length,
          })

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('pages.training.dialogue.department.label', 'Department')}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] transition-colors hover:bg-[#F7F7F7] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{triggerLabel}</span>
        {value.length > 0 ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#BBFB5B] px-1.5 text-[10px] font-semibold text-[#05040D]">
            {value.length}
          </span>
        ) : null}
        <Icons.ArrowDown size={12} className="text-[#676767]" />
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 z-30 mt-1 flex w-[260px] flex-col overflow-hidden rounded-lg border border-[#EBECE8] bg-white shadow-lg">
          <ul className="max-h-[240px] overflow-y-auto py-1">
            <li>
              {/* «All» is the empty selection, not a value of its own. */}
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F7F7F7]"
              >
                <CheckBox checked={value.length === 0} />
                <span className="truncate text-xs font-medium text-[#05040D]">{allLabel}</span>
              </button>
            </li>
            {options.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => toggle(d.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F7F7F7]"
                >
                  <CheckBox checked={value.includes(d.id)} />
                  <span className="truncate text-xs text-[#05040D]">{d.name}</span>
                </button>
              </li>
            ))}
            {options.length === 0 ? (
              <li className="px-3 py-2 text-[11px] text-[#6B7280]">
                {t('pages.training.dialogue.department.empty', 'No departments available')}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
        checked ? 'border-[#204E4D] bg-[#204E4D] text-white' : 'border-[#DFDFDF] bg-white'
      }`}
    >
      {checked ? <Icons.Checkmark size={10} className="text-white" /> : null}
    </span>
  )
}

export default DepartmentMultiSelect
