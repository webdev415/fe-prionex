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
import { Icons } from '@/lib/icons'
import { useTranslation } from 'react-i18next'

export interface OperatorOption {
  id: number
  name: string
  isInactive: boolean
}

// KAN-607: negative sentinel ids carried inside the responsibleEmployeeIds /
// interactionUserIds arrays to represent the special "null" filter options.
// Real operator ids are always positive, so these never collide. The backend
// (`clients.py`) interprets them as "IS NULL" / "zero interactions".
export const NO_RESPONSIBLE_ID = -1
export const NO_INTERACTIONS_ID = -1

/** A static "null" option pinned below the select-all row: always visible
 * (never hidden by the search) and excluded from the select-all toggle. */
export interface SpecialOption {
  id: number
  label: string
}

interface OperatorMultiSelectDropdownProps {
  options: OperatorOption[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  onOpenChange?: (open: boolean) => void
  trigger: React.ReactNode
  searchPlaceholder?: string
  emptyText?: string
  /** Label for the "select all / clear all" toggle row at the top of the
   * list. Translated by the caller; defaults to a generic "Select all". */
  selectAllLabel?: string
  /** Optional pinned "null" option (KAN-607). */
  specialOption?: SpecialOption
  testId?: string
  /**
   * Opt-in per-field clear. When provided AND at least one option is
   * selected, a small "×" button renders beside the dropdown trigger
   * that calls this callback. Mirrors the DateSelect onClear pattern.
   */
  onClear?: () => void
}

export function OperatorMultiSelectDropdown({
  options,
  selectedIds,
  onSelectionChange,
  onOpenChange,
  trigger,
  searchPlaceholder,
  emptyText,
  selectAllLabel,
  specialOption,
  testId,
  onClear,
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

  const allIds = useMemo(() => options.map((o) => o.id), [options])
  // Tracks the real operator options only; the special option is independent.
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))

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

  // Toggles every option on / off in one click. Always operates over the
  // FULL options list (not the search-filtered slice) — same as the
  // reference EmployeeFilterDropdown on Action Analysis. The special option
  // is preserved across the toggle.
  const handleToggleAll = () => {
    const keepSpecial =
      specialOption && selectedIds.includes(specialOption.id) ? [specialOption.id] : []
    onSelectionChange(isAllSelected ? keepSpecial : [...allIds, ...keepSpecial])
  }

  const showClear = !!onClear && selectedIds.length > 0

  return (
    <div className="flex w-full items-center gap-1">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuTrigger asChild className="flex-1 outline-none" data-testid={testId}>
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
            {options.length === 0 && !specialOption ? (
              <div className="py-4 text-center text-sm text-gray-500">
                {emptyText ?? t('pages.clients.filters.noUsersAvailable', 'No users available')}
              </div>
            ) : (
              <div className="space-y-1">
                {/* Select-all toggle — always visible above the per-item list.
                  Operates on the full options list, not the search slice,
                  matching the reference EmployeeFilterDropdown on Action
                  Analysis. */}
                {options.length > 0 && (
                  <label className="text-dark-500 flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50">
                    <Checkbox checked={isAllSelected} onCheckedChange={handleToggleAll} />
                    <span className="text-sm font-medium">
                      {selectAllLabel ?? t('pages.clients.filters.selectAll', 'Select all')}
                    </span>
                  </label>
                )}
                {/* Special "null" option, pinned below select-all and never
                  filtered by the search query. */}
                {specialOption && (
                  <label className="text-dark-500 flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50">
                    <Checkbox
                      checked={selectedIds.includes(specialOption.id)}
                      onCheckedChange={() => handleToggle(specialOption.id)}
                    />
                    <span className="text-sm font-medium">{specialOption.label}</span>
                  </label>
                )}
                {options.length > 0 && filteredOptions.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500">
                    {t('pages.clients.filters.noMatchingUsers', 'No matches')}
                  </div>
                ) : (
                  filteredOptions.map((opt) => (
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
                  ))
                )}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {showClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onClear?.()
          }}
          aria-label="Clear"
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600"
        >
          <Icons.Cancel01 size={14} />
        </button>
      )}
    </div>
  )
}
