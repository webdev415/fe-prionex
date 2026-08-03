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
import { Icons } from '@/lib/icons'
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
  /**
   * Opt-in clear-all. When provided AND the selection is non-empty, a small
   * "×" button is rendered next to the trigger that clears the whole
   * selection. Other usages are unaffected because it only renders when
   * onClear is set.
   */
  onClear?: () => void
}

export function LastInteractionResultDropdown({
  options,
  selectedIds,
  onSelectionChange,
  onOpenChange,
  trigger,
  onClear,
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

  const showClear = !!onClear && selectedIds.length > 0

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <span className="inline-flex items-center gap-1">
        <DropdownMenuTrigger asChild className="outline-none">
          {trigger}
        </DropdownMenuTrigger>
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center"
          >
            <Icons.Cancel01 size={14} />
          </button>
        )}
      </span>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="border-border bg-card w-[280px] rounded-lg border p-0 shadow-lg"
      >
        <div className="border-border border-b p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'pages.clients.filters.lastInteractionResultSearchPlaceholder',
              'Search...'
            )}
            className="text-foreground focus:border-primary-500 border-border bg-card placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="max-h-[240px] overflow-y-auto p-2">
          {filteredOptions.length === 0 ? (
            <div className="text-muted-foreground py-4 text-center text-sm">
              {t('pages.clients.filters.lastInteractionResultEmpty', 'No chains configured yet.')}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredOptions.map((opt) => (
                <label
                  key={opt.id}
                  className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-2"
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
