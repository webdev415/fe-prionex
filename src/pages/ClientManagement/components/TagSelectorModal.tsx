/**
 * TagSelectorModal Component
 *
 * Modal for managing client tags with multi-select checkboxes.
 * Pre-selects existing tags and allows adding/removing tags.
 * Optimized with React.memo, useCallback, and debounced search.
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { TagBadge } from '@/components/ui/TagBadge'
import {
  useTags,
  useClientTags,
  useAssignClientTag,
  useRemoveClientTag,
} from '@/features/tags/hooks/useTags'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { useDebounce } from '@/hooks/useDebounce'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { PromiseAssignDialog } from './PromiseAssignDialog'

interface TagWithPayloadFlag {
  id: number
  name: string
  color: string
  description?: string
  requires_payload?: boolean
}

interface TagSelectorModalProps {
  clientId: number
  clientName: string
  projectId: number
  open: boolean
  onClose: () => void
}

export const TagSelectorModal = memo(function TagSelectorModal({
  clientId,
  clientName,
  projectId,
  open,
  onClose,
}: TagSelectorModalProps) {
  const queryClient = useQueryClient()
  const canAssignTags = useHasPermission(PERMISSIONS.CLIENTS.ASSIGN_TAGS)
  const { data: allTags, isLoading: tagsLoading } = useTags(projectId)
  const { data: clientTags, isLoading: clientTagsLoading } = useClientTags(clientId)
  const assignMutation = useAssignClientTag()
  const removeMutation = useRemoveClientTag()

  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Pending payload-required tag the operator wants to assign — opens
  // PromiseAssignDialog where they enter ЦД (date/time) and amount.
  const [pendingPayloadTag, setPendingPayloadTag] = useState<{
    id: number
    name: string
  } | null>(null)

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Pre-select existing tags when clientTags are loaded
  useEffect(() => {
    if (clientTags) {
      setSelectedTagIds(new Set(clientTags.map((t) => t.id)))
    }
  }, [clientTags])

  // Memoize filtered tags to avoid recalculating on every render
  const filteredTags = useMemo(
    () =>
      allTags?.filter((tag) => tag.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())),
    [allTags, debouncedSearchQuery]
  )

  // Memoize handleToggleTag to prevent re-creating function on every render.
  // Tags with `requires_payload=true` (e.g. promise_to_pay) cannot be added
  // through the bulk save path — they need a dedicated form for ЦД + amount.
  // Clicking on such a tag opens PromiseAssignDialog instead.
  const handleToggleTag = useCallback((tag: TagWithPayloadFlag) => {
    setSelectedTagIds((prev) => {
      const isSelected = prev.has(tag.id)
      // Adding a payload-required tag → divert to dedicated dialog
      if (!isSelected && tag.requires_payload) {
        setPendingPayloadTag({ id: tag.id, name: tag.name })
        return prev
      }
      const next = new Set(prev)
      if (next.has(tag.id)) {
        next.delete(tag.id)
      } else {
        next.add(tag.id)
      }
      return next
    })
  }, [])

  // Memoize handleSave to prevent re-creating function on every render
  const handleSave = useCallback(async () => {
    if (!canAssignTags) {
      return
    }

    setIsSaving(true)

    const currentTagIds = new Set(clientTags?.map((t) => t.id) || [])
    const toAdd = [...selectedTagIds].filter((id) => !currentTagIds.has(id))
    const toRemove = [...currentTagIds].filter((id) => !selectedTagIds.has(id))

    try {
      // Optimistic update
      queryClient.setQueriesData(
        { queryKey: ['clients', clientId, 'tags'] },
        () => allTags?.filter((t) => selectedTagIds.has(t.id)) || []
      )

      // Execute API calls
      await Promise.all([
        ...toAdd.map((tagId) => assignMutation.mutateAsync({ clientId, tagId })),
        ...toRemove.map((tagId) => removeMutation.mutateAsync({ clientId, tagId })),
      ])

      toast.success(`Tags updated for ${clientName}`)
      onClose()
    } catch {
      toast.error('Failed to update tags')
      queryClient.invalidateQueries({ queryKey: ['clients', clientId, 'tags'] })
    } finally {
      setIsSaving(false)
    }
  }, [
    clientTags,
    selectedTagIds,
    queryClient,
    clientId,
    allTags,
    assignMutation,
    removeMutation,
    clientName,
    onClose,
    canAssignTags,
  ])

  const isLoading = tagsLoading || clientTagsLoading

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg" data-testid="tag-selector-modal">
      <ModalHeader
        icon={<Icons.Contact size={24} className="text-primary-500" />}
        title={`Manage Tags - ${clientName}`}
      />

      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <div className="text-xs text-gray-600 sm:text-sm">Loading tags...</div>
          </div>
        ) : (
          <>
            <div className="mb-3 sm:mb-4">
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Icons.Search size={16} />}
                className="w-full"
              />
            </div>

            <div className="mb-3 text-xs text-gray-600 sm:mb-4 sm:text-sm">
              {selectedTagIds.size} of {allTags?.length || 0} tags selected
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto sm:max-h-96">
              {filteredTags && filteredTags.length > 0 ? (
                filteredTags.map((tag) => {
                  const t = tag as unknown as TagWithPayloadFlag
                  const isPayloadTag = !!t.requires_payload
                  return (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 sm:gap-3"
                    >
                      <Checkbox
                        checked={selectedTagIds.has(tag.id)}
                        onCheckedChange={() => handleToggleTag(t)}
                        disabled={!canAssignTags}
                      />
                      <TagBadge name={tag.name} color={tag.color} size="sm" />
                      {isPayloadTag && (
                        <span
                          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                          title="Тег требует ЦД и/или сумму — откроется отдельная форма"
                        >
                          требует ЦД
                        </span>
                      )}
                      {tag.description && (
                        <span className="hidden text-xs text-gray-500 sm:inline">
                          {tag.description}
                        </span>
                      )}
                    </label>
                  )
                })
              ) : (
                <div className="py-6 text-center text-xs text-gray-500 sm:py-8 sm:text-sm">
                  {debouncedSearchQuery
                    ? 'No tags found matching your search'
                    : 'No tags available'}
                </div>
              )}
            </div>
          </>
        )}
      </ModalContent>

      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          disabled={isLoading || !canAssignTags}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          Save Tags
        </Button>
      </ModalFooter>
      {pendingPayloadTag && (
        <PromiseAssignDialog
          open={true}
          clientId={clientId}
          clientName={clientName}
          tagId={pendingPayloadTag.id}
          tagName={pendingPayloadTag.name}
          onClose={() => setPendingPayloadTag(null)}
        />
      )}
    </Modal>
  )
})
