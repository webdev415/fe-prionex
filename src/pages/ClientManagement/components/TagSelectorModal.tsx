/**
 * TagSelectorModal Component
 *
 * Modal for managing client tags with multi-select checkboxes.
 * Pre-selects existing tags and allows adding/removing tags.
 * Protected tags: any user can assign; only permitted roles can uncheck/remove.
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
import { useAuthStore } from '@/stores/authStore'
import { canRemoveProtectedTag } from '@/features/tags/utils/protected'
import type { TagDefinition } from '@/features/tags/types'

interface TagSelectorModalProps {
  clientId: number
  clientName: string
  projectId: number
  open: boolean
  onClose: () => void
  /**
   * Called once, after the tag writes succeed, before the modal closes.
   *
   * A tag change can fire a "Tag change" chain trigger, which launches a chain
   * asynchronously. The caller uses this to arm auto-open for THIS operator, the
   * same way closing a debt does. Not called when nothing changed or the save
   * failed, so an unchanged save never arms a pointless poll.
   */
  onTagsChanged?: () => void
}

export const TagSelectorModal = memo(function TagSelectorModal({
  clientId,
  clientName,
  projectId,
  open,
  onClose,
  onTagsChanged,
}: TagSelectorModalProps) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const roleName = useAuthStore((state) => state.user?.active_role_name)
  const canAssignTags = useHasPermission(PERMISSIONS.CLIENTS.ASSIGN_TAGS)
  const { data: allTags, isLoading: tagsLoading } = useTags(projectId)
  const { data: clientTags, isLoading: clientTagsLoading } = useClientTags(clientId)
  const assignMutation = useAssignClientTag()
  const removeMutation = useRemoveClientTag()

  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [pendingPayloadTag, setPendingPayloadTag] = useState<{
    id: number
    name: string
  } | null>(null)

  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    if (clientTags) {
      setSelectedTagIds(new Set(clientTags.map((t) => t.id)))
    }
  }, [clientTags])

  // Merge catalog + assigned tags so protected tags already on the client stay visible
  // even when department scope hides them from the catalog list. Client tags override
  // catalog entries so can_remove_protected reflects GET /clients/:id/tags.
  const catalogTags = useMemo(() => {
    const byId = new Map<number, TagDefinition>()
    for (const tag of allTags ?? []) {
      byId.set(tag.id, tag)
    }
    for (const tag of clientTags ?? []) {
      byId.set(tag.id, tag)
    }
    return [...byId.values()]
  }, [allTags, clientTags])

  const filteredTags = useMemo(() => {
    const matched = catalogTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) &&
        (tag.expiry_type ?? 'permanent') !== 'target_action_date'
    )
    return sortTagsWithSelectedFirst(matched, selectedTagIds)
  }, [catalogTags, debouncedSearchQuery, selectedTagIds])

  const isTagRemovalLocked = useCallback(
    (tag: TagDefinition, isSelected: boolean) => {
      if (!isSelected || !tag.is_protected) {
        return false
      }
      return !canRemoveProtectedTag(tag, roleName)
    },
    [roleName]
  )

  const handleToggleTag = useCallback(
    (tag: TagDefinition) => {
      setSelectedTagIds((prev) => {
        const isSelected = prev.has(tag.id)
        if (isSelected && isTagRemovalLocked(tag, true)) {
          return prev
        }
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
    },
    [isTagRemovalLocked]
  )

  const handleSave = useCallback(async () => {
    if (!canAssignTags) {
      return
    }

    setIsSaving(true)

    const currentTagIds = new Set(clientTags?.map((t) => t.id) || [])
    const toAdd = [...selectedTagIds].filter((id) => !currentTagIds.has(id))
    const toRemove = [...currentTagIds].filter((id) => !selectedTagIds.has(id))

    const tagById = new Map(catalogTags.map((t) => [t.id, t]))
    const allowedToRemove = toRemove.filter((tagId) => {
      const tag = tagById.get(tagId)
      if (!tag) {
        return true
      }
      return canRemoveProtectedTag(tag, roleName)
    })

    if (allowedToRemove.length < toRemove.length) {
      toast.error(
        t(
          'pages.clients.modals.tagSelector.protectedRemoveBlocked',
          'Protected tags can only be removed by authorized roles'
        )
      )
    }

    try {
      queryClient.setQueriesData(
        { queryKey: ['clients', clientId, 'tags'] },
        () => catalogTags.filter((t) => selectedTagIds.has(t.id)) || []
      )

      await Promise.all([
        ...toAdd.map((tagId) => assignMutation.mutateAsync({ clientId, tagId })),
        ...allowedToRemove.map((tagId) => removeMutation.mutateAsync({ clientId, tagId })),
      ])

      toast.success(t('pages.clients.modals.tagSelector.tagsUpdated', { name: clientName }))
      // Only when something was actually written. Promise.all([]) resolves, so
      // saving an unchanged selection reached here and armed 15s of 1.5s polling
      // for nothing. The same applied when the only intended change was removing
      // a protected tag the operator may not remove: allowedToRemove comes back
      // empty, the error toast above fires, and this armed anyway. Beyond the
      // wasted requests, every armed window is one in which a chain launched by
      // someone else -- a colleague, a scheduled trigger -- is attributed to this
      // operator and pops the executor modal over their work.
      if (toAdd.length > 0 || allowedToRemove.length > 0) {
        onTagsChanged?.()
      }
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
    catalogTags,
    assignMutation,
    removeMutation,
    clientName,
    onClose,
    onTagsChanged,
    canAssignTags,
    roleName,
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
                total: catalogTags.length,
              })}
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto sm:max-h-96">
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id)
                  const isPayloadTag = !!tag.requires_payload
                  const removalLocked = isTagRemovalLocked(tag, isSelected)
                  const checkboxDisabled = !canAssignTags || removalLocked

                  return (
                    <label
                      key={tag.id}
                      className={`flex items-center gap-2 rounded p-2 sm:gap-3 ${removalLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleTag(tag)}
                        disabled={checkboxDisabled}
                      />
                      <TagBadge
                        name={tag.name}
                        color={tag.color}
                        size="sm"
                        isProtected={tag.is_protected}
                      />
                      {isPayloadTag && (
                        <span
                          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                          title={t('pages.clients.modals.tagSelector.payloadTagHint')}
                        >
                          {t('pages.clients.modals.tagSelector.payloadTagBadge')}
                        </span>
                      )}
                      {removalLocked && (
                        <span className="text-xs text-amber-600">
                          {t('pages.tags.protectedWarning', 'Removal requires manager approval')}
                        </span>
                      )}
                      {tag.description && !removalLocked && (
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
          onAssigned={onTagsChanged}
          onClose={() => setPendingPayloadTag(null)}
        />
      )}
    </Modal>
  )
})
