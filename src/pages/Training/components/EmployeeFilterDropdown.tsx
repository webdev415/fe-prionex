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
import type { OperatorUser } from '@/features/users/api/usersApi'
import { piiProps } from '@/lib/openreplay/pii'

interface EmployeeFilterDropdownProps {
  operators: OperatorUser[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  /** Override label shown on the trigger when the picker is disabled (e.g. department selected). */
  disabledLabel?: string
  /** Label rendered above the trigger. */
  label?: string
}

export function EmployeeFilterDropdown({
  operators,
  selectedIds,
  onChange,
  disabled = false,
  disabledLabel,
  label,
}: EmployeeFilterDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return operators
    return operators.filter((o) => o.full_name.toLowerCase().includes(q))
  }, [operators, searchQuery])

  const updateTriggerWidth = useCallback(() => {
    const trigger = wrapperRef.current?.querySelector('button')
    if (trigger) setTriggerWidth(trigger.offsetWidth)
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        setSearchQuery('')
      } else {
        requestAnimationFrame(updateTriggerWidth)
      }
    },
    [updateTriggerWidth]
  )

  useEffect(() => {
    if (!isOpen) return
    const onResize = () => updateTriggerWidth()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isOpen, updateTriggerWidth])

  const allIds = useMemo(() => operators.map((o) => o.id), [operators])
  const isAllSelected = selectedIds.length === allIds.length && allIds.length > 0

  const toggleOne = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const toggleAll = () => {
    if (isAllSelected) onChange([])
    else onChange([...allIds])
  }

  // "All" is shown when nothing is selected OR everything is selected — both
  // states semantically mean "no operator filter applied". Matches the UX of
  // other multi-select dropdowns in the app (e.g. the Audit Logs entity-type
  // picker), which treats fully-selected as "All".
  const triggerLabel = disabled
    ? (disabledLabel ?? t('pages.training.filters.allEmployees', 'All employees'))
    : selectedIds.length === 0 || isAllSelected
      ? t('pages.training.filters.allEmployees', 'All employees')
      : selectedIds.length === 1
        ? (operators.find((o) => o.id === selectedIds[0])?.full_name ??
          t('pages.training.filters.employeesCount', '{{count}} selected', { count: 1 }))
        : t('pages.training.filters.employeesCount', '{{count}} selected', {
            count: selectedIds.length,
          })

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
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
                'text-dark-500 focus:border-primary-500 flex h-[45px] w-full items-center justify-between rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              <span className="truncate text-left">{triggerLabel}</span>
              <Icons.ArrowDown size={16} className="shrink-0 text-gray-400" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
            className="max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-0 shadow-lg sm:max-w-none"
          >
            <div className="border-b border-gray-200 p-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('pages.training.filters.searchEmployeesPlaceholder', 'Search')}
                  className="text-dark-500 focus:border-primary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm outline-none placeholder:text-gray-400"
                />
                <Icons.Search
                  size={16}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="max-h-[200px] overflow-y-auto sm:max-h-[300px]">
              {filteredOperators.length === 0 && searchQuery ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  {t('pages.training.filters.noOperatorsMatch', 'No matches')}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <label className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                    <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} />
                    <span className="text-sm font-medium">
                      {t('pages.training.filters.allEmployees', 'All employees')}
                    </span>
                  </label>
                  {filteredOperators.map((op) => {
                    const isInactive = op.status !== 'active'
                    return (
                      <label
                        key={op.id}
                        className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                      >
                        <Checkbox
                          checked={selectedIds.includes(op.id)}
                          onCheckedChange={() => toggleOne(op.id)}
                        />
                        <span
                          className={cn('text-sm', isInactive && 'text-gray-400')}
                          {...piiProps}
                        >
                          {op.full_name}
                          {isInactive && (
                            <span className="ml-1 text-xs text-gray-400">
                              {t('pages.training.filters.blockedSuffix', '(blocked)')}
                            </span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
