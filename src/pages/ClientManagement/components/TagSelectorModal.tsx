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
  const { data: allTags, isLoading: tagsLoading } = useTags(projectId)
  const { data: clientTags, isLoading: clientTagsLoading } = useClientTags(clientId)
  const assignMutation = useAssignClientTag()
  const removeMutation = useRemoveClientTag()

  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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

  // Memoize handleToggleTag to prevent re-creating function on every render
  const handleToggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      return next
    })
  }, [])

  // Memoize handleSave to prevent re-creating function on every render
  const handleSave = useCallback(async () => {
    setIsSaving(true)

    const currentTagIds = new Set(clientTags?.map((t) => t.id) || [])
    const toAdd = [...selectedTagIds].filter((id) => !currentTagIds.has(id))
    const toRemove = [...currentTagIds].filter((id) => !selectedTagIds.has(id))

    try {
      // Optimistic update
      queryClient.setQueryData(
        ['clients', clientId, 'tags'],
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
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-600">Loading tags...</div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Icons.Search size={16} />}
              />
            </div>

            <div className="mb-4 text-sm text-gray-600">
              {selectedTagIds.size} of {allTags?.length || 0} tags selected
            </div>

            <div className="max-h-96 space-y-2 overflow-y-auto">
              {filteredTags && filteredTags.length > 0 ? (
                filteredTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2"
                  >
                    <Checkbox
                      checked={selectedTagIds.has(tag.id)}
                      onCheckedChange={() => handleToggleTag(tag.id)}
                    />
                    <TagBadge name={tag.name} color={tag.color} size="sm" />
                    {tag.description && (
                      <span className="text-xs text-gray-500">{tag.description}</span>
                    )}
                  </label>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
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
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={isSaving} disabled={isLoading}>
          Save Tags
        </Button>
      </ModalFooter>
    </Modal>
  )
})
