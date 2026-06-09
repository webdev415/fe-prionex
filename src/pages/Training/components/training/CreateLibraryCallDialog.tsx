import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateLibraryCall } from '@/features/training/hooks/useLibraryCalls'
import {
  LIBRARY_CATEGORIES,
  type LibraryCategory,
} from '@/features/training/types/library'

/**
 * Trainer-side direct path: add a curated call to the library without first
 * scoring it through the marker flow (KAN-411 Feature 3.4). The marker
 * auto-create path runs server-side from `POST /quality/markers/{id}/add-to-library`.
 */
export interface CreateLibraryCallDialogProps {
  open: boolean
  onClose: () => void
  existingTags: string[]
}

const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  ideal: 'Ideal',
  mistake: 'Mistake',
  complex: 'Complex',
  non_standard: 'Non-standard',
}

export function CreateLibraryCallDialog({
  open,
  onClose,
  existingTags,
}: CreateLibraryCallDialogProps) {
  const { t } = useTranslation('common')
  const [callId, setCallId] = useState('')
  const [category, setCategory] = useState<LibraryCategory>('ideal')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  const [trackedOpen, setTrackedOpen] = useState(open)
  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (open) {
      setCallId('')
      setCategory('ideal')
      setTitle('')
      setDescription('')
      setTagsInput('')
    }
  }

  const mutation = useCreateLibraryCall()

  const handleSubmit = async () => {
    if (!callId.trim()) {
      toast.error(
        t(
          'pages.training.training.library.errors.noCallId',
          'Provide the call ID this entry refers to.'
        )
      )
      return
    }
    if (!title.trim()) {
      toast.error(
        t(
          'pages.training.training.library.errors.noTitle',
          'Give the library entry a short title.'
        )
      )
      return
    }
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await mutation.mutateAsync({
        call_id: callId.trim(),
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        tags,
      })
      toast.success(
        t(
          'pages.training.training.library.success',
          'Call added to the library.'
        )
      )
      onClose()
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t(
              'pages.training.training.library.errors.generic',
              'Could not add the call to the library.'
            )
      toast.error(detail)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={t('pages.training.training.library.add', 'Add to library')}
      />
      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="library-call-id" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.library.callId', 'Call ID')}
            </label>
            <Input
              id="library-call-id"
              value={callId}
              onChange={(e) => setCallId(e.target.value)}
              maxLength={64}
              placeholder={t(
                'pages.training.training.library.callIdPlaceholder',
                'Asterisk call_id / UUID'
              )}
              className="h-[40px] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="library-category" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.library.category', 'Category')}
            </label>
            <select
              id="library-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LibraryCategory)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
            >
              {LIBRARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`pages.training.training.library.categories.${c}`, CATEGORY_LABELS[c])}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="library-title" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.library.titleField', 'Title')}
            </label>
            <Input
              id="library-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t(
                'pages.training.training.library.titlePlaceholder',
                'e.g. "Strong opening rebuttal"'
              )}
              className="h-[40px] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="library-description"
              className="text-xs font-medium text-gray-600"
            >
              {t('pages.training.training.library.descriptionField', 'Why this call is worth listening to')}
            </label>
            <textarea
              id="library-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="focus:border-primary-400 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="library-tags" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.library.tags', 'Tags (comma-separated)')}
            </label>
            <Input
              id="library-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t(
                'pages.training.training.library.tagsPlaceholder',
                'objection, rebuttal, payment'
              )}
              className="h-[40px] text-sm"
            />
            {existingTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {existingTags.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = tagsInput
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      if (current.includes(tag)) return
                      setTagsInput([...current, tag].join(', '))
                    }}
                    className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] text-[#374151] hover:bg-[#E5E7EB]"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          variant="cancel"
          size="md"
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-full"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={mutation.isPending || !callId.trim() || !title.trim()}
          className="rounded-full"
        >
          {mutation.isPending
            ? t('pages.training.training.library.submitting', 'Adding…')
            : t('pages.training.training.library.submit', 'Add to library')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreateLibraryCallDialog
