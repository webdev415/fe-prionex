/**
 * Step-picker dropdown for the Client list filter bar.
 *
 * Self-contained — does NOT import from `pages/ActionAnalysis/`. The TA
 * History tab has its own picker (`StepFilterDropdown`); this one is
 * tailored for the Client dashboard's needs:
 *
 *   - Selection is keyed by ``ta_chain_steps.id`` (not target_action_id),
 *     so a chain with two steps that reference the same target_action
 *     (e.g. Contact → Credit → Credit) keeps each step independently
 *     toggleable.
 *   - Root container is ``w-full`` so it stretches inside the flex
 *     ``items-start`` columns used by ClientFiltersBar without shrinking
 *     to its trigger label.
 */
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

interface ClientStepFilterDropdownProps {
  steps: TAChainStep[]
  /** Selected ``ta_chain_steps.id`` values. */
  selectedIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}

export function ClientStepFilterDropdown({
  steps,
  selectedIds,
  onChange,
  disabled = false,
}: ClientStepFilterDropdownProps) {
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

  const allIds = useMemo(() => ordered.map((s) => s.id), [ordered])
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
    const name = s.target_action_name ?? t('pages.clients.filters.chainStep', 'Step')
    return `${s.step_order}. ${name}`
  }

  const triggerLabel = (() => {
    if (disabled || selectedIds.length === 0 || isAllSelected) {
      return t('pages.clients.filters.allChainSteps', 'All steps')
    }
    if (selectedIds.length === 1) {
      const picked = ordered.find((s) => s.id === selectedIds[0])
      if (picked) return labelFor(picked)
    }
    return t('pages.clients.filters.selectedStepsCount', '{{count}} selected', {
      count: selectedIds.length,
    })
  })()

  return (
    <div ref={wrapperRef} className="w-full">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuTrigger asChild className="w-full outline-none" disabled={disabled}>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'text-dark-500 flex h-[45px] w-full items-center justify-between rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light outline-none disabled:cursor-not-allowed disabled:opacity-50'
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
                placeholder={t('pages.clients.filters.searchPlaceholder', 'Search')}
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
                {t('pages.clients.filters.noMatches', 'No matches')}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                <label className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                  <Checkbox checked={isAllSelected} onCheckedChange={toggleAll} />
                  <span className="text-sm font-medium">
                    {t('pages.clients.filters.allChainSteps', 'All steps')}
                  </span>
                </label>
                {filteredSteps.map((s) => (
                  <label
                    key={s.id}
                    className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={selectedIds.includes(s.id)}
                      onCheckedChange={() => toggleOne(s.id)}
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
  )
}
