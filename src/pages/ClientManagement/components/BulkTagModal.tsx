/**
 * Bulk Tag Modal Component
 *
 * Modal for bulk adding or removing tags from multiple clients.
 * Similar to TagSelectorModal but for bulk operations.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { TagBadge } from '@/components/ui/TagBadge'
import { useTags, useBulkTagClients } from '@/features/tags/hooks/useTags'
import { toast } from 'sonner'

interface BulkTagModalProps {
  open: boolean
  clientIds: number[]
  clientCount: number
  action: 'add' | 'remove'
  onClose: () => void
}

export function BulkTagModal({ open, clientIds, clientCount, action, onClose }: BulkTagModalProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

  // Fetch tags - TODO: Get projectId from auth context
  const projectId = 1 // Temporary hardcoded value
  const { data: tags, isLoading } = useTags(projectId)
  const bulkTagMutation = useBulkTagClients()

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      // Reset on close to prepare for next open
      // Use setTimeout to avoid calling setState synchronously in effect
      const timeoutId = setTimeout(() => {
        setSelectedTagIds([])
        setSearchQuery('')
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [open])

  // Drop target_action_date tags — they're assigned only via chain
  // effects, and the bulk-assign API rejects them.
  const filteredTags = tags?.filter(
    (tag) =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (tag.expiry_type ?? 'permanent') !== 'target_action_date'
  )

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSave = async () => {
    if (selectedTagIds.length === 0) {
      toast.error(
        t('pages.clients.modals.bulkTag.selectAtLeastOneTag', 'Please select at least one tag')
      )
      return
    }

    try {
      await bulkTagMutation.mutateAsync({
        client_ids: clientIds,
        tag_ids: selectedTagIds,
        action,
      })
      onClose()
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error('Bulk tag operation failed:', error)
    }
  }

  const actionText =
    action === 'add'
      ? t('pages.clients.modals.bulkTag.addTags', 'Add Tags')
      : t('pages.clients.modals.bulkTag.removeTags', 'Remove Tags')

  return (
    <Modal open={open} onClose={onClose} maxWidth="md" data-testid="bulk-tag-modal">
      <ModalHeader
        title={`${actionText} - ${clientCount} ${t('pages.clients.modals.bulkTag.clients', 'client(s)')}`}
      />

      <ModalContent>
        <div className="space-y-3 sm:space-y-4">
          {/* Search Input */}
          <Input
            placeholder={t('pages.clients.modals.bulkTag.searchTags', 'Search tags...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />

          {/* Tags List */}
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:max-h-96 sm:p-4">
            {isLoading ? (
              <div className="py-4 text-center text-xs text-gray-500 sm:text-sm">
                {t('pages.clients.modals.bulkTag.loadingTags', 'Loading tags...')}
              </div>
            ) : filteredTags?.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-500 sm:text-sm">
                {t('pages.clients.modals.bulkTag.noTagsFound', 'No tags found')}
              </div>
            ) : (
              filteredTags?.map((tag) => {
                const isProtected = !!tag.is_protected
                const isDisabledRemove = action === 'remove' && isProtected

                return (
                  <label
                    key={tag.id}
                    className={`flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50 ${isDisabledRemove ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => handleToggleTag(tag.id)}
                      disabled={isDisabledRemove}
                    />
                    <TagBadge
                      name={tag.name}
                      color={tag.color}
                      size="sm"
                      isProtected={isProtected}
                    />
                    {isDisabledRemove && (
                      <span className="text-xs text-amber-600">
                        {t('pages.tags.protectedWarning', 'Requires approval')}
                      </span>
                    )}
                    {tag.description && !isDisabledRemove && (
                      <span className="hidden text-xs text-gray-500 sm:inline">
                        - {tag.description}
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>

          {/* Selected count */}
          {selectedTagIds.length > 0 && (
            <div className="text-xs text-gray-600 sm:text-sm">
              {selectedTagIds.length}{' '}
              {t('pages.clients.modals.bulkTag.tagsSelected', 'tag(s) selected')}
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={bulkTagMutation.isPending}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={selectedTagIds.length === 0 || bulkTagMutation.isPending}
          className="h-10 flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {bulkTagMutation.isPending
            ? t('pages.clients.modals.bulkTag.processing', 'Processing...')
            : actionText}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
