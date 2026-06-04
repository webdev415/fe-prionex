/**
 * Operator Multi-Select Dropdown (KAN-572)
 *
 * Reused by the Responsible Employee and Interaction Created By filters
 * on the Client List page. Shape mirrors LastInteractionResultDropdown:
 * search box on top, checkbox list below, apply-on-toggle (no temp
 * state / no Apply button).
 *
 * Inactive operators render with the existing `(blocked)` suffix the
 * single-select Select used, so the visual indication carries over.
 */

import { useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useTranslation } from 'react-i18next'

export interface OperatorOption {
  id: number
  name: string
  isInactive: boolean
}

interface OperatorMultiSelectDropdownProps {
  options: OperatorOption[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  onOpenChange?: (open: boolean) => void
  trigger: React.ReactNode
  searchPlaceholder?: string
  emptyText?: string
  testId?: string
}

export function OperatorMultiSelectDropdown({
  options,
  selectedIds,
  onSelectionChange,
  onOpenChange,
  trigger,
  searchPlaceholder,
  emptyText,
  testId,
}: OperatorMultiSelectDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Filter by name, then pin selected to the top so a long list with a
  // few selections is easy to inspect.
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matched = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
    const selected = matched.filter((o) => selectedIds.includes(o.id))
    const rest = matched.filter((o) => !selectedIds.includes(o.id))
    return [...selected, ...rest]
  }, [options, searchQuery, selectedIds])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
    if (open) {
      setSearchQuery('')
    }
  }

  // Apply immediately on each toggle — the parent receives the new
  // array and the table refilters live.
  const handleToggle = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onSelectionChange(next)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild className="outline-none" data-testid={testId}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[280px] rounded-lg border border-gray-200 bg-white p-0 shadow-lg"
      >
        <div className="border-b border-gray-200 p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchPlaceholder ?? t('pages.clients.filters.searchPlaceholder', 'Search...')
            }
            className="text-dark-500 focus:border-primary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="max-h-[240px] overflow-y-auto p-2">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              {emptyText ?? t('pages.clients.filters.noUsersAvailable', 'No users available')}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOptions.map((opt) => (
                <label
                  key={opt.id}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedIds.includes(opt.id)}
                    onCheckedChange={() => handleToggle(opt.id)}
                  />
                  {opt.isInactive ? (
                    <span className="text-sm text-gray-400">
                      {opt.name} {t('pages.clients.filters.inactiveSuffix', '(blocked)')}
                    </span>
                  ) : (
                    <span className="text-sm">{opt.name}</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
