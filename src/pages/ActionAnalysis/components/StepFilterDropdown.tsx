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
import type { TAChainStep } from '@/features/taChains/api/types'

interface StepFilterDropdownProps {
  steps: TAChainStep[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  label?: string
  /** Key extractor — defaults to ``s.target_action_id`` (preserves TA History
   * behavior, where steps that share a TA are intentionally toggled together).
   * Pass ``(s) => s.id`` for the Client list filter, where each chain step is
   * independent even when two steps reference the same target_action. */
  getKey?: (step: TAChainStep) => number
}

export function StepFilterDropdown({
  steps,
  selectedIds,
  onChange,
  disabled = false,
  label,
  getKey = (s) => s.target_action_id,
}: StepFilterDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const ordered = useMemo(() => [...steps].sort((a, b) => a.step_order - b.step_order), [steps])

  const filteredSteps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return ordered
    return ordered.filter((s) => {
      const name = s.target_action_name ?? ''
      const composite = `${s.step_order}. ${name}`
      return name.toLowerCase().includes(q) || composite.toLowerCase().includes(q)
    })
  }, [ordered, searchQuery])

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

  const allIds = useMemo(() => ordered.map((s) => getKey(s)), [ordered, getKey])
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

  const labelFor = (s: TAChainStep): string => {
    const name = s.target_action_name ?? t('pages.actionAnalysis.filters.chainStep', 'Step')
    return `${s.step_order}. ${name}`
  }

  const triggerLabel = disabled
    ? t('pages.actionAnalysis.filters.allChainSteps', 'All steps')
    : selectedIds.length === 0 || isAllSelected
      ? t('pages.actionAnalysis.filters.allChainSteps', 'All steps')
      : selectedIds.length === 1
        ? ordered.find((s) => getKey(s) === selectedIds[0])
          ? labelFor(ordered.find((s) => getKey(s) === selectedIds[0])!)
          : t('pages.actionAnalysis.filters.selectedStepsCount', '{{count}} selected', {
              count: 1,
            })
        : t('pages.actionAnalysis.filters.selectedStepsCount', '{{count}} selected', {
            count: selectedIds.length,
          })

  return (
    <div className="flex w-full flex-col gap-1.5">
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
                  placeholder={t(
                    'pages.actionAnalysis.filters.searchEmployeesPlaceholder',
                    'Search'
                  )}
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
              {filteredSteps.length === 0 && searchQuery ? (
                <div className="py-4 text-center text-sm text-gray-500">
                  {t('pages.actionAnalysis.filters.noOperatorsMatch', 'No matches')}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <label className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                    <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} />
                    <span className="text-sm font-medium">
                      {t('pages.actionAnalysis.filters.allChainSteps', 'All steps')}
                    </span>
                  </label>
                  {filteredSteps.map((s) => (
                    <label
                      key={s.id}
                      className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedIds.includes(getKey(s))}
                        onCheckedChange={() => toggleOne(getKey(s))}
                      />
                      <span className="text-sm">{labelFor(s)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
