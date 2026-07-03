import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { useMaterialCategories, useUploadMaterial } from '@/features/training/hooks/useMaterials'

/**
 * Trainer-side upload for the Materials Library (KAN-499). Streams a single
 * file + metadata as multipart form-data; the server validates size / MIME /
 * magic bytes and returns a clear 4xx that surfaces here as a toast.
 */
export interface MaterialUploadDialogProps {
  open: boolean
  onClose: () => void
}

const ACCEPT = '.pdf,.doc,.docx,.mp4,.mp3,.wav,application/pdf,video/mp4,audio/mpeg,audio/wav'

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
    if (typeof detail === 'string') return detail
  }
  return err instanceof Error ? err.message : fallback
}

export function MaterialUploadDialog({ open, onClose }: MaterialUploadDialogProps) {
  const { t } = useTranslation('common')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagsInput, setTagsInput] = useState('')

  const [trackedOpen, setTrackedOpen] = useState(open)
  if (open !== trackedOpen) {
    setTrackedOpen(open)
    if (open) {
      setFile(null)
      setTitle('')
      setDescription('')
      setCategoryId('')
      setTagsInput('')
    }
  }

  const { data: categories } = useMaterialCategories(open)
  const mutation = useUploadMaterial()

  const handleSubmit = async () => {
    if (!file) {
      toast.error(t('pages.training.training.materials.errors.noFile', 'Choose a file to upload.'))
      return
    }
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await mutation.mutateAsync({
        file,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        category_id: categoryId === '' ? undefined : categoryId,
        tags,
      })
      toast.success(t('pages.training.training.materials.uploadSuccess', 'Material uploaded.'))
      onClose()
    } catch (err) {
      toast.error(
        extractError(
          err,
          t('pages.training.training.materials.errors.upload', 'Could not upload the material.')
        )
      )
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader title={t('pages.training.training.materials.upload', 'Upload material')} />
      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.file', 'File')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-600 hover:border-gray-400"
            >
              <Icons.FileImport size={16} />
              <span className="truncate">
                {file
                  ? file.name
                  : t('pages.training.training.materials.chooseFile', 'Choose a file…')}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="material-title" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.titleField', 'Title')}
            </label>
            <Input
              id="material-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t(
                'pages.training.training.materials.titlePlaceholder',
                'Defaults to the file name'
              )}
              className="h-[40px] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="material-category" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.category', 'Category')}
            </label>
            <select
              id="material-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">
                {t('pages.training.training.materials.noCategory', 'No category')}
              </option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="material-description" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.descriptionField', 'Description')}
            </label>
            <textarea
              id="material-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="focus:border-primary-400 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="material-tags" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.tags', 'Tags (comma-separated)')}
            </label>
            <Input
              id="material-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={t(
                'pages.training.training.materials.tagsPlaceholder',
                'script, onboarding'
              )}
              className="h-[40px] text-sm"
            />
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
          disabled={mutation.isPending || !file}
          className="rounded-full"
        >
          {mutation.isPending
            ? t('pages.training.training.materials.uploading', 'Uploading…')
            : t('pages.training.training.materials.upload', 'Upload material')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default MaterialUploadDialog
