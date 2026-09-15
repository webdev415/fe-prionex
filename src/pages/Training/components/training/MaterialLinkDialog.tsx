import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { safeHttpUrl } from '@/lib/safeUrl'
import { useCreateMaterialLink } from '@/features/training/hooks/useMaterials'
import { MaterialCategorySelect } from './MaterialCategorySelect'

/**
 * Register a link as a library material (KAN-1049).
 *
 * The sibling of MaterialUploadDialog: same metadata, no file. Most material
 * trainers use lives elsewhere — slides, a doc, a recording — and before this
 * the only way to share it was to pass the link outside the system.
 */
export interface MaterialLinkDialogProps {
  open: boolean
  onClose: () => void
}

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return err instanceof Error ? err.message : fallback
}

export function MaterialLinkDialog({ open, onClose }: MaterialLinkDialogProps) {
  const { t } = useTranslation('common')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagsInput, setTagsInput] = useState('')

  const [trackedOpen, setTrackedOpen] = useState(open)
  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (open) {
      setUrl('')
      setTitle('')
      setDescription('')
      setCategoryId('')
      setTagsInput('')
    }
  }

  const mutation = useCreateMaterialLink()

  // Gated on the same predicate the library uses to render a link, so what can
  // be saved and what can be opened cannot drift apart. The server validates it
  // too — this is the message, not the control.
  const urlInvalid = url.trim().length > 0 && !safeHttpUrl(url)
  const canSubmit = title.trim().length > 0 && url.trim().length > 0 && !urlInvalid

  const handleSubmit = async () => {
    if (!canSubmit) return
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await mutation.mutateAsync({
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || null,
        category_id: categoryId === '' ? null : categoryId,
        tags: tags.length > 0 ? tags : null,
      })
      toast.success(t('pages.training.training.materials.linkSaved', 'Link added to the library.'))
      onClose()
    } catch (err) {
      toast.error(
        extractError(
          err,
          t('pages.training.training.materials.errors.link', 'Could not save the link.')
        )
      )
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title={t('pages.training.training.materials.addLink', 'Add a link')} />
      <ModalContent>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.training.materials.linkUrl', 'Link')}
            </span>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            {urlInvalid ? (
              <span className="text-[11px] text-[#B91C1C]">
                {t(
                  'pages.training.training.materials.linkUrlInvalid',
                  'Include https:// — a link without it cannot be opened.'
                )}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.training.materials.titleField', 'Title')}
            </span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.training.materials.descriptionField', 'Description')}
            </span>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <MaterialCategorySelect value={categoryId} onChange={setCategoryId} />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.training.materials.tags', 'Tags')}
            </span>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t(
                'pages.training.training.materials.tagsPlaceholder',
                'script, onboarding'
              )}
            />
          </label>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || mutation.isPending}>
          {t('pages.training.training.materials.saveLink', 'Save link')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
