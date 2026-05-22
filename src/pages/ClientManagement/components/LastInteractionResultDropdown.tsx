/**
 * Last Interaction Result Dropdown
 *
 * Multi-select dropdown for the "Last Interaction Result" filter on
 * the Clients page. The options are TA chain names (Path 2 of the
 * KAN ticket): every ta_interaction row carries a chain_id, so this
 * works today without any admin-configured dropdown values.
 *
 * Pattern is identical to TagsDropdown — search box at top, checkbox
 * list in the middle, Apply / Clear buttons at the bottom — minus
 * the color swatch (chains don't have colors).
 */

import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useTranslation } from 'react-i18next'

export interface LastInteractionResultOption {
  id: number
  value: string
}

interface LastInteractionResultDropdownProps {
  options: LastInteractionResultOption[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  onOpenChange?: (open: boolean) => void
  trigger: React.ReactNode
}

export function LastInteractionResultDropdown({
  options,
  selectedIds,
  onSelectionChange,
  onOpenChange,
  trigger,
}: LastInteractionResultDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.value.toLowerCase().includes(q))
  }, [options, searchQuery])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
    if (open) {
      setSearchQuery('')
    }
  }

  // Apply changes immediately on each toggle — no temp state, no
  // Apply/Cancel buttons. The parent receives the updated array right
  // away so the table refilters live as the operator ticks/unticks
  // each chain.
  const handleToggle = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onSelectionChange(next)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild className="outline-none">
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
            placeholder={t(
              'pages.clients.filters.lastInteractionResultSearchPlaceholder',
              'Search...'
            )}
            className="text-dark-500 focus:border-primary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="max-h-[240px] overflow-y-auto p-2">
          {filteredOptions.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              {t('pages.clients.filters.lastInteractionResultEmpty', 'No chains configured yet.')}
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
                  <span className="text-sm">{opt.value}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
