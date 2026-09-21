/**
 * Tags Dropdown Component
 *
 * Tag filter dropdown with two mutually exclusive tabs:
 * - Manual filter — 3-state include/exclude/neutral tag picker (KAN-797)
 * - Segments — single-select active Tag Service segments as one-click presets
 *
 * Tri-state / segment clicks apply immediately so operators do not need Apply
 * for the list to update.
 */

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import type { Tag } from '@/features/tags/types'
import { useSegments } from '@/features/tags/hooks/useTags'
import { sortTagsWithSelectedFirst } from '@/features/tags/utils/sortTags'
import {
  cycleTagTriState,
  getActiveTagFilterIds,
  getTagTriState,
  type TagFilterSelection,
} from '@/features/tags/utils/tagFilterState'
import { TagFilterTriState } from './TagFilterTriState'
import { useTranslation } from 'react-i18next'
import { formatSegmentFilterMeta } from '@/features/tags/utils/segmentFilterMeta'
import { useAuthStore } from '@/stores/authStore'

type FilterTab = 'manual' | 'segments'

interface TagsDropdownProps {
  tags: Tag[]
  tagFilterSelection: TagFilterSelection
  selectedSegmentId?: number | null
  onSelectionChange: (selection: TagFilterSelection) => void
  onSegmentChange: (segmentId: number | null) => void
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
  tagFilterSelection,
  selectedSegmentId = null,
  onSelectionChange,
  onSegmentChange,
  onOpenChange,
  trigger,
  onClear,
}: TagsDropdownProps) {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((s) => s.user?.timezone)
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSelection, setTempSelection] = useState<TagFilterSelection>(tagFilterSelection)
  const [tempSegmentId, setTempSegmentId] = useState<number | null>(selectedSegmentId)
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<FilterTab>(
    selectedSegmentId != null ? 'segments' : 'manual'
  )

  const { data: segments = [], isLoading: segmentsLoading } = useSegments({
    is_active: true,
    enabled: isOpen,
  })

  const activeFilterIds = getActiveTagFilterIds(tempSelection)
  const hasManualSelection =
    tempSelection.includeIds.length > 0 || tempSelection.excludeIds.length > 0

  // Filter tags based on search, then pin active filter tags to the top
  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matched = q ? tags.filter((tag) => tag.name.toLowerCase().includes(q)) : tags
    return sortTagsWithSelectedFirst(matched, activeFilterIds)
  }, [tags, searchQuery, activeFilterIds])

  const filteredSegments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return segments
    return segments.filter((s) => s.name.toLowerCase().includes(q))
  }, [segments, searchQuery])

  // Initialize temp selection when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
    if (open) {
      setTempSelection({
        includeIds: [...tagFilterSelection.includeIds],
        excludeIds: [...tagFilterSelection.excludeIds],
      })
      setTempSegmentId(selectedSegmentId)
      setActiveTab(selectedSegmentId != null ? 'segments' : 'manual')
      setSearchQuery('')
    }
  }

  // Sync temp selection when filters change externally
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTempSelection({
        includeIds: [...tagFilterSelection.includeIds],
        excludeIds: [...tagFilterSelection.excludeIds],
      })
      setTempSegmentId(selectedSegmentId)
    }
  }, [tagFilterSelection, selectedSegmentId, isOpen])

  const handleSelectSegment = (segmentId: number) => {
    const nextId = tempSegmentId === segmentId ? null : segmentId
    setTempSegmentId(nextId)
    const cleared = { includeIds: [] as number[], excludeIds: [] as number[] }
    setTempSelection(cleared)
    // One parent update path: segment change clears manual tags in ClientFiltersBar.
    onSegmentChange(nextId)
  }

  const handleCycleTag = (tagId: number) => {
    const next = cycleTagTriState(tempSelection, tagId)
    setTempSelection(next)
    setTempSegmentId(null)
    // Manual tag selection clears any selected segment (mutually exclusive).
    onSelectionChange(next)
  }

  const handleClear = () => {
    const next = { includeIds: [] as number[], excludeIds: [] as number[] }
    setTempSelection(next)
    setTempSegmentId(null)
    // Prefer parent clear so tag + segment reset in one state update
    if (onClear) {
      onClear()
    } else {
      onSelectionChange(next)
      onSegmentChange(null)
    }
  }

  const handleDone = () => {
    setIsOpen(false)
  }

  const showClear =
    !!onClear &&
    (tagFilterSelection.includeIds.length > 0 ||
      tagFilterSelection.excludeIds.length > 0 ||
      selectedSegmentId != null)

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
            aria-label={t('pages.clients.modals.tagsDropdown.clear')}
            className="text-muted-foreground hover:text-foreground flex shrink-0 items-center"
          >
            <Icons.Cancel01 size={14} />
          </button>
        )}
      </span>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="border-border bg-card w-[320px] rounded-lg border p-0 shadow-lg"
      >
        {/* Tabs */}
        <div className="border-border flex border-b">
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual')
              setSearchQuery('')
            }}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'border-primary-500 text-foreground border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('pages.clients.modals.tagsDropdown.tabManual')}
            {hasManualSelection ? ` (${activeFilterIds.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('segments')
              setSearchQuery('')
            }}
            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'segments'
                ? 'border-primary-500 text-foreground border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('pages.clients.modals.tagsDropdown.tabSegments')}
            {tempSegmentId != null ? ' (1)' : ''}
          </button>
        </div>

        {/* Search Input */}
        <div className="border-border border-b p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'manual'
                ? t('pages.clients.modals.tagsDropdown.searchTags')
                : t('pages.clients.modals.tagsDropdown.searchSegments')
            }
            className="text-foreground focus:border-primary-500 border-border bg-card placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 text-sm outline-none"
          />
        </div>

        {/* Manual tags list */}
        {activeTab === 'manual' && (
          <div className="max-h-[200px] overflow-y-auto p-2">
            {filteredTags.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-sm">
                {t('pages.clients.modals.tagsDropdown.noTagsFound')}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-2"
                  >
                    <TagFilterTriState
                      state={getTagTriState(tempSelection, tag.id)}
                      onCycle={() => handleCycleTag(tag.id)}
                      aria-label={`${tag.name} filter`}
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm">{tag.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Segments list */}
        {activeTab === 'segments' && (
          <div className="max-h-[240px] overflow-y-auto p-2">
            {segmentsLoading ? (
              <div className="text-muted-foreground py-4 text-center text-sm">
                {t('pages.clients.modals.tagsDropdown.loadingSegments')}
              </div>
            ) : filteredSegments.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-sm">
                {t('pages.clients.modals.tagsDropdown.noSegmentsFound')}
              </div>
            ) : (
              <div
                className="space-y-1"
                role="radiogroup"
                aria-label={t('pages.clients.modals.tagsDropdown.tabSegments')}
              >
                {filteredSegments.map((segment) => {
                  const selected = tempSegmentId === segment.id
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => handleSelectSegment(segment.id)}
                      className={`hover:bg-muted flex w-full cursor-pointer items-start gap-2 rounded px-2 py-2 text-left ${
                        selected ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-primary-500 bg-primary-500' : 'border-border bg-card'
                        }`}
                        aria-hidden
                      >
                        {selected && <span className="bg-card h-1.5 w-1.5 rounded-full" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground truncate text-sm font-medium">
                          {segment.name}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatSegmentFilterMeta(segment, t, userTimezone)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-border border-t p-3">
          <div className="flex items-center gap-2">
            <Button variant="cancel" onClick={handleClear} className="flex flex-1">
              {t('pages.clients.modals.tagsDropdown.clear')}
            </Button>
            <Button variant="primary" onClick={handleDone} className="flex flex-1">
              {t('pages.clients.modals.tagsDropdown.apply')}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
