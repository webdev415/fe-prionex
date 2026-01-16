/**
 * FilterDropdown Component
 *
 * Generic dropdown with search functionality for selecting multiple items.
 * Supports "All" option and individual item selection with checkboxes.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'

interface FilterDropdownProps {
  items: string[]
  selectedItems: string[] // Array of selected items
  onItemChange: (items: string[]) => void
  trigger: React.ReactNode
  disabled?: boolean
  allItemsLabel?: string
  searchPlaceholder?: string
  noItemsFoundLabel?: string
}

export function FilterDropdown({
  items,
  selectedItems,
  onItemChange,
  trigger,
  disabled = false,
  allItemsLabel = 'All',
  searchPlaceholder = 'Search',
  noItemsFoundLabel = 'No items found',
}: FilterDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    return items.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [items, searchQuery])

  // Handle open change
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSearchQuery('')
    } else {
      // Measure trigger width after DOM updates
      requestAnimationFrame(() => {
        if (wrapperRef.current) {
          // Find the actual trigger button inside the wrapper
          const triggerButton = wrapperRef.current.querySelector('button')
          if (triggerButton) {
            const width = triggerButton.offsetWidth
            setTriggerWidth(width)
          }
        }
      })
    }
  }, [])

  const handleToggleItem = (item: string) => {
    if (item === 'all') {
      // Toggle "All" - if all items are selected, deselect all; otherwise select all
      if (selectedItems.length === items.length) {
        onItemChange([]) // Deselect all
      } else {
        onItemChange([...items]) // Select all items
      }
    } else {
      // Toggle individual item
      if (selectedItems.includes(item)) {
        // Deselect this item
        onItemChange(selectedItems.filter((i) => i !== item))
      } else {
        // Select this item
        onItemChange([...selectedItems, item])
      }
    }
    // Don't close dropdown to allow multiple selections
  }

  // "All" is selected when all items are selected
  const isAllSelected = selectedItems.length === items.length && items.length > 0
  // Individual item is selected when it's in the selectedItems array
  const isItemSelected = (item: string) => selectedItems.includes(item)

  return (
    <div ref={wrapperRef} className="w-full">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <div className="w-full">
          <DropdownMenuTrigger asChild className="w-full outline-none" disabled={disabled}>
            {trigger}
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
          className="rounded-md border border-gray-200 bg-white p-0 shadow-lg"
        >
          {/* Search Input */}
          <div className="border-b border-gray-200 p-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="text-dark-500 focus:border-primary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm outline-none placeholder:text-gray-400"
              />
              <Icons.Search
                size={16}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Items List */}
          <div className="max-h-[300px] overflow-y-auto">
            {filteredItems.length === 0 && searchQuery ? (
              <div className="py-4 text-center text-sm text-gray-500">{noItemsFoundLabel}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* All Items Option */}
                <label className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={() => handleToggleItem('all')}
                  />
                  <span className="text-sm font-medium">{allItemsLabel}</span>
                </label>

                {/* Individual Items */}
                {filteredItems.map((item) => (
                  <label
                    key={item}
                    className="text-dark-500 flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={isItemSelected(item)}
                      onCheckedChange={() => handleToggleItem(item)}
                    />
                    <span className="text-sm">{item}</span>
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
