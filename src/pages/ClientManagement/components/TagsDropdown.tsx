/**
 * Tags Dropdown Component
 *
 * Multi-select dropdown for filtering clients by tags.
 * Similar pattern to PortfolioDropdown.
 */

import { useState, useMemo, useEffect } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import type { Tag } from '@/features/tags/types'
import { useTranslation } from 'react-i18next'

interface TagsDropdownProps {
  tags: Tag[]
  selectedTagIds: number[]
  onSelectionChange: (tagIds: number[]) => void
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

export function TagsDropdown({
  tags,
  selectedTagIds,
  onSelectionChange,
  onOpenChange,
  trigger,
  onClear,
}: TagsDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSelection, setTempSelection] = useState<number[]>(selectedTagIds)
  const [isOpen, setIsOpen] = useState(false)

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags
    return tags.filter((tag) => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [tags, searchQuery])

  // Initialize temp selection when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
    if (open) {
      setTempSelection([...selectedTagIds])
      setSearchQuery('')
    }
  }

  // Sync temp selection when selectedTagIds changes externally
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTempSelection([...selectedTagIds])
    }
  }, [selectedTagIds, isOpen])

  const handleToggleTag = (tagId: number) => {
    setTempSelection((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleClear = () => {
    setTempSelection([])
  }

  const handleApply = () => {
    onSelectionChange(tempSelection)
    setIsOpen(false)
  }

  const showClear = !!onClear && selectedTagIds.length > 0

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
            className="flex shrink-0 items-center text-gray-400 hover:text-gray-600"
          >
            <Icons.Cancel01 size={14} />
          </button>
        )}
      </span>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[280px] rounded-lg border border-gray-200 bg-white p-0 shadow-lg"
      >
        {/* Search Input */}
        <div className="border-b border-gray-200 p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('pages.clients.modals.tagsDropdown.searchTags')}
            className="text-dark-500 focus:border-primary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Tags List */}
        <div className="max-h-[200px] overflow-y-auto p-2">
          {filteredTags.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              {t('pages.clients.modals.tagsDropdown.noTagsFound')}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTags.map((tag) => (
                <label
                  key={tag.id}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={tempSelection.includes(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                  />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm">{tag.name}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <Button variant="cancel" onClick={handleClear} className="flex flex-1">
              {t('pages.clients.modals.tagsDropdown.clear')}
            </Button>
            <Button variant="primary" onClick={handleApply} className="flex flex-1">
              {t('pages.clients.modals.tagsDropdown.apply')}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
