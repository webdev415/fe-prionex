import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMaterialCategories, useUpdateMaterial } from '@/features/training/hooks/useMaterials'
import type { Material } from '@/features/training/types/materials'

/** Metadata-only edit for a material (KAN-499) — the stored file is never replaced. */
export interface MaterialEditDialogProps {
  material: Material | null
  onClose: () => void
}

export function MaterialEditDialog({ material, onClose }: MaterialEditDialogProps) {
  const { t } = useTranslation('common')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [tagsInput, setTagsInput] = useState('')

  const [trackedId, setTrackedId] = useState<number | null>(null)
  if (material && material.id !== trackedId) {
    setTrackedId(material.id)
    setTitle(material.title)
    setDescription(material.description ?? '')
    setCategoryId(material.category_id ?? '')
    setTagsInput((material.tags ?? []).join(', '))
  }

  const { data: categories } = useMaterialCategories(material != null)
  const mutation = useUpdateMaterial()

  const handleSubmit = async () => {
    if (!material) return
    if (!title.trim()) {
      toast.error(
        t('pages.training.training.materials.errors.noTitle', 'Give the material a title.')
      )
      return
    }
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await mutation.mutateAsync({
        id: material.id,
        payload: {
          title: title.trim(),
          description: description.trim() || null,
          category_id: categoryId === '' ? null : categoryId,
          tags,
        },
      })
      toast.success(t('pages.training.training.materials.updateSuccess', 'Material updated.'))
      onClose()
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.training.training.materials.errors.update', 'Could not update the material.')
      toast.error(detail)
    }
  }

  return (
    <Modal open={material != null} onClose={onClose} maxWidth="md">
      <ModalHeader title={t('pages.training.training.materials.edit', 'Edit material')} />
      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="material-edit-title" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.titleField', 'Title')}
            </label>
            <Input
              id="material-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-[40px] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="material-edit-category" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.category', 'Category')}
            </label>
            <select
              id="material-edit-category"
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
            <label
              htmlFor="material-edit-description"
              className="text-xs font-medium text-gray-600"
            >
              {t('pages.training.training.materials.descriptionField', 'Description')}
            </label>
            <textarea
              id="material-edit-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="focus:border-primary-400 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="material-edit-tags" className="text-xs font-medium text-gray-600">
              {t('pages.training.training.materials.tags', 'Tags (comma-separated)')}
            </label>
            <Input
              id="material-edit-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
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
          disabled={mutation.isPending || !title.trim()}
          className="rounded-full"
        >
          {mutation.isPending
            ? t('pages.training.training.materials.saving', 'Saving…')
            : t('actions.save', 'Save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default MaterialEditDialog
