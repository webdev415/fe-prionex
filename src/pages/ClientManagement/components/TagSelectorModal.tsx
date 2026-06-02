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
import { sortTagsWithSelectedFirst } from '@/features/tags/utils/sortTags'
import { useDebounce } from '@/hooks/useDebounce'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('common')
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

  // Memoize filtered tags to avoid recalculating on every render.
  // Also drop tags with expiry_type='target_action_date' — these are
  // assigned only via chain effects (the expires_at comes from a TA
  // date field); the backend rejects manual assignments for them.
  const filteredTags = useMemo(() => {
    const matched = (allTags ?? []).filter(
      (tag) =>
        tag.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) &&
        (tag.expiry_type ?? 'permanent') !== 'target_action_date'
    )
    return sortTagsWithSelectedFirst(matched, selectedTagIds)
  }, [allTags, debouncedSearchQuery, selectedTagIds])

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

      toast.success(t('pages.clients.modals.tagSelector.tagsUpdated', { name: clientName }))
      onClose()
    } catch {
      toast.error(t('pages.clients.modals.tagSelector.updateFailed'))
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
    t,
  ])

  const isLoading = tagsLoading || clientTagsLoading

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg" data-testid="tag-selector-modal">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-9 w-9 items-center justify-center rounded-full">
            <Icons.Contact size={21} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.tagSelector.title', { name: clientName })}
      />

      <ModalContent>
        {isLoading ? (
          <div className="space-y-4 sm:space-y-5" data-testid="tag-selector-loading-skeleton">
            <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="max-h-64 space-y-2 overflow-y-auto sm:max-h-96">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded p-2"
                  aria-label={t('pages.clients.modals.tagSelector.loadingTags')}
                >
                  <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                  <div className="h-6 w-32 animate-pulse rounded-full bg-gray-200" />
                  <div className="hidden h-4 w-40 animate-pulse rounded bg-gray-200 sm:block" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 sm:mb-4">
              <Input
                placeholder={t('pages.clients.modals.tagSelector.searchTags')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Icons.Search size={16} />}
                className="w-full"
              />
            </div>

            <div className="mb-3 text-xs text-gray-600 sm:mb-4 sm:text-sm">
              {t('pages.clients.modals.tagSelector.selectedCount', {
                selected: selectedTagIds.size,
                total: allTags?.length || 0,
              })}
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto sm:max-h-96">
              {filteredTags && filteredTags.length > 0 ? (
                filteredTags.map((tag) => {
                  const payloadTag = tag as unknown as TagWithPayloadFlag
                  const isPayloadTag = !!payloadTag.requires_payload
                  return (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 sm:gap-3"
                    >
                      <Checkbox
                        checked={selectedTagIds.has(tag.id)}
                        onCheckedChange={() => handleToggleTag(payloadTag)}
                        disabled={!canAssignTags}
                      />
                      <TagBadge name={tag.name} color={tag.color} size="sm" />
                      {isPayloadTag && (
                        <span
                          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                          title={t('pages.clients.modals.tagSelector.payloadTagHint')}
                        >
                          {t('pages.clients.modals.tagSelector.payloadTagBadge')}
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
                    ? t('pages.clients.modals.tagSelector.noTagsMatch')
                    : t('pages.clients.modals.tagSelector.noTagsAvailable')}
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
          {t('actions.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          isLoading={isSaving}
          disabled={isLoading || !canAssignTags}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('pages.clients.modals.tagSelector.saveTags')}
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
