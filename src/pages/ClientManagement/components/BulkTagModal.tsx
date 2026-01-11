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

  // Reset state when modal opens
  useEffect(() => {
    if (!open) {
      // Reset on close to prepare for next open
      setSelectedTagIds([])
      setSearchQuery('')
    }
  }, [open])

  const filteredTags = tags?.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleSave = async () => {
    if (selectedTagIds.length === 0) {
      toast.error(t('pages.clients.modals.bulkTag.selectAtLeastOneTag'))
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
      ? t('pages.clients.modals.bulkTag.addTags')
      : t('pages.clients.modals.bulkTag.removeTags')

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={`${actionText} - ${clientCount} ${t('pages.clients.modals.bulkTag.clients')}`}
      />

      <ModalContent>
        <div className="space-y-4">
          {/* Search Input */}
          <Input
            placeholder={t('pages.clients.modals.bulkTag.searchTags')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Tags List */}
          <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-4">
            {isLoading ? (
              <div className="py-4 text-center text-sm text-gray-500">
                {t('pages.clients.modals.bulkTag.loadingTags')}
              </div>
            ) : filteredTags?.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                {t('pages.clients.modals.bulkTag.noTagsFound')}
              </div>
            ) : (
              filteredTags?.map((tag) => (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                  />
                  <TagBadge name={tag.name} color={tag.color} size="sm" />
                  {tag.description && (
                    <span className="text-xs text-gray-500">- {tag.description}</span>
                  )}
                </label>
              ))
            )}
          </div>

          {/* Selected count */}
          {selectedTagIds.length > 0 && (
            <div className="text-sm text-gray-600">
              {selectedTagIds.length} {t('pages.clients.modals.bulkTag.tagsSelected')}
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={bulkTagMutation.isPending}>
          {t('pages.clients.modals.bulkTag.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={selectedTagIds.length === 0 || bulkTagMutation.isPending}
        >
          {bulkTagMutation.isPending ? t('pages.clients.modals.bulkTag.processing') : actionText}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
