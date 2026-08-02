/**
 * EntityFilterDropdown Component
 *
 * Dropdown with search functionality for selecting entity types.
 * Supports "All Types" option and individual entity type selection with checkboxes.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'

interface EntityFilterDropdownProps {
  entityTypes: string[]
  selectedEntityTypes: string[] // Array of selected entity types
  onEntityTypeChange: (entityTypes: string[]) => void
  trigger: React.ReactNode
  disabled?: boolean
}

export function EntityFilterDropdown({
  entityTypes,
  selectedEntityTypes,
  onEntityTypeChange,
  trigger,
  disabled = false,
}: EntityFilterDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Filter entity types based on search
  const filteredEntityTypes = useMemo(() => {
    if (!searchQuery.trim()) return entityTypes
    return entityTypes.filter((type) => type.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [entityTypes, searchQuery])

  // Function to measure and update trigger width
  const updateTriggerWidth = useCallback(() => {
    if (wrapperRef.current) {
      // Find the actual trigger button inside the wrapper
      const triggerButton = wrapperRef.current.querySelector('button')
      if (triggerButton) {
        const width = triggerButton.offsetWidth
        setTriggerWidth(width)
      }
    }
  }, [])

  // Handle open change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        setSearchQuery('')
      } else {
        // Measure trigger width after DOM updates
        requestAnimationFrame(() => {
          updateTriggerWidth()
        })
      }
    },
    [updateTriggerWidth]
  )

  // Update trigger width when window is resized and dropdown is open
  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      updateTriggerWidth()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, updateTriggerWidth])

  const handleToggleEntityType = (entityType: string) => {
    if (entityType === 'all') {
      // Toggle "All Types" - if all types are selected, deselect all; otherwise select all
      if (selectedEntityTypes.length === entityTypes.length) {
        onEntityTypeChange([]) // Deselect all
      } else {
        onEntityTypeChange([...entityTypes]) // Select all entity types
      }
    } else {
      // Toggle individual entity type
      if (selectedEntityTypes.includes(entityType)) {
        // Deselect this entity type
        onEntityTypeChange(selectedEntityTypes.filter((t) => t !== entityType))
      } else {
        // Select this entity type
        onEntityTypeChange([...selectedEntityTypes, entityType])
      }
    }
    // Don't close dropdown to allow multiple selections
  }

  // "All Types" is selected when all entity types are selected
  const isAllTypesSelected =
    selectedEntityTypes.length === entityTypes.length && entityTypes.length > 0
  // Individual entity type is selected when it's in the selectedEntityTypes array
  const isEntityTypeSelected = (entityType: string) => selectedEntityTypes.includes(entityType)

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
          className="border-border bg-card max-w-[calc(100vw-2rem)] rounded-md border p-0 shadow-lg sm:max-w-none"
        >
          {/* Search Input */}
          <div className="border-border border-b p-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="text-foreground focus:border-primary-500 border-border bg-card placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none"
              />
              <Icons.Search
                size={16}
                className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* Entity Type List */}
          <div className="max-h-[200px] overflow-y-auto sm:max-h-[300px]">
            {filteredEntityTypes.length === 0 && searchQuery ? (
              <div className="text-muted-foreground py-4 text-center text-sm">
                No entity types found
              </div>
            ) : (
              <div className="divide-border divide-y">
                {/* All Types Option */}
                <label className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={isAllTypesSelected}
                    onCheckedChange={() => handleToggleEntityType('all')}
                  />
                  <span className="text-sm font-medium">
                    {t('pages.auditLogs.searchFilters.allTypes')}
                  </span>
                </label>

                {/* Individual Entity Types */}
                {filteredEntityTypes.map((entityType) => (
                  <label
                    key={entityType}
                    className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-3 px-3 py-2.5"
                  >
                    <Checkbox
                      checked={isEntityTypeSelected(entityType)}
                      onCheckedChange={() => handleToggleEntityType(entityType)}
                    />
                    <span className="text-sm">{entityType}</span>
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
