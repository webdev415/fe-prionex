import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface MultiCheckboxOption<V extends string> {
  value: V
  label: string
}

interface Props<V extends string> {
  /** Label rendered above the trigger. */
  label?: string
  options: readonly MultiCheckboxOption<V>[]
  selected: V[]
  onChange: (next: V[]) => void
  /** Trigger label when nothing is selected OR every option is selected. */
  allLabel: string
  /** Trigger label suffix when N > 1 are selected — interpolated with {{count}}. */
  countLabelKey?: string
  disabled?: boolean
  /** Override label shown on the trigger when disabled (e.g. scope lock). */
  disabledLabel?: string
}

/**
 * Reusable multi-select dropdown with a checkbox list. Used by the Payment
 * History filter bar for Payment method / Status / Payment type so the three
 * filters share one visual idiom (mirrors EmployeeFilterDropdown but without
 * the search input — fine for short controlled-vocabulary lists).
 *
 * The trigger collapses "all selected" and "none selected" to the same
 * "All …" label since both semantically mean "no filter applied" downstream.
 */
export function MultiCheckboxDropdown<V extends string>({
  label,
  options,
  selected,
  onChange,
  allLabel,
  countLabelKey = 'pages.training.filters.selectedCount',
  disabled = false,
  disabledLabel,
}: Props<V>) {
  const { t } = useTranslation('common')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const updateTriggerWidth = useCallback(() => {
    const trigger = wrapperRef.current?.querySelector('button')
    if (trigger) setTriggerWidth(trigger.offsetWidth)
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open) requestAnimationFrame(updateTriggerWidth)
    },
    [updateTriggerWidth]
  )

  useEffect(() => {
    if (!isOpen) return
    const onResize = () => updateTriggerWidth()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isOpen, updateTriggerWidth])

  const allValues = useMemo(() => options.map((o) => o.value), [options])
  const isAllSelected = selected.length === allValues.length && allValues.length > 0

  const toggleOne = (value: V) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value))
    else onChange([...selected, value])
  }

  const toggleAll = () => {
    if (isAllSelected) onChange([])
    else onChange([...allValues])
  }

  const triggerLabel = disabled
    ? (disabledLabel ?? allLabel)
    : selected.length === 0 || isAllSelected
      ? allLabel
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : t(countLabelKey, '{{count}} selected', { count: selected.length })

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-foreground text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
          {label}
        </span>
      )}
      <div ref={wrapperRef} className="w-full">
        <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
          <DropdownMenuTrigger asChild className="w-full outline-none" disabled={disabled}>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'text-foreground focus:border-primary-500 border-border bg-card flex h-[45px] w-full items-center justify-between rounded-lg border px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <span className="truncate text-left">{triggerLabel}</span>
              <Icons.ArrowDown
                size={16}
                className="text-muted-foreground shrink-0"
                strokeWidth={1.5}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
            className="border-border bg-card max-w-[calc(100vw-2rem)] rounded-md border p-0 shadow-lg sm:max-w-none"
          >
            <div className="flex max-h-72 flex-col overflow-y-auto py-1">
              <label className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} />
                <span className="font-medium">{allLabel}</span>
              </label>
              <div className="bg-border my-1 h-px" />
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(opt.value)}
                    onCheckedChange={() => toggleOne(opt.value)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
