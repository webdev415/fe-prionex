/**
 * Tag Form Modal
 *
 * Modal for creating and editing tags with color picker.
 */

import { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useCreateTag, useUpdateTag } from '@/features/tags'
import type { Tag } from '@/features/tags'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { ColorPickerField } from '@/components/forms'
import { Icons } from '@/lib/icons'

interface TagFormModalProps {
  open: boolean
  tag?: Tag
  activeProjectName?: string
  onClose: () => void
  onSuccess: () => void
}

// Preset colors for quick selection
const PRESET_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#80D80A',
  '#FF9D00',
  '#DC2626',
  '#DFDFDF',
]

// Form validation schema
const tagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Please enter a valid color in hex format (#RRGGBB)'),
  description: z.string().max(200, 'Description must be 200 characters or less').optional(),
})

type TagFormData = z.infer<typeof tagSchema>

export function TagFormModal({
  open,
  tag,
  activeProjectName,
  onClose,
  onSuccess,
}: TagFormModalProps) {
  const { t } = useTranslation('common')
  const isEdit = !!tag

  const createMutation = useCreateTag()
  const updateMutation = useUpdateTag()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: tag?.name || '',
      color: tag?.color || '#80D80A',
      description: tag?.description || '',
    },
  })

  // Watch color value for preview
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedColor = watch('color')

  // Reset form when modal opens/closes or tag changes
  useEffect(() => {
    if (open) {
      reset({
        name: tag?.name || '',
        color: tag?.color || '#80D80A',
        description: tag?.description || '',
      })
    }
  }, [open, tag, reset])

  const onSubmit = useCallback(
    async (data: TagFormData) => {
      try {
        if (isEdit && tag) {
          await updateMutation.mutateAsync({ id: tag.id, data })
        } else {
          await createMutation.mutateAsync(data)
        }
        onSuccess()
      } catch (error) {
        console.error('Failed to save tag:', error)
      }
    },
    [isEdit, tag, updateMutation, createMutation, onSuccess]
  )

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  return (
    <Modal open={open} onClose={handleClose} className="max-w-3xl">
      <form onSubmit={handleSubmit(onSubmit)} className="min-w-0">
        <ModalHeader
          icon={
            <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
              {isEdit ? (
                <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
              ) : (
                <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
              )}
            </div>
          }
          title={isEdit ? t('pages.tags.editTag', 'Edit Tag') : t('pages.tags.newTag', 'New Tag')}
        />

        <ModalContent className="overflow-x-hidden">
          <div className="min-w-0 space-y-6">
            {/* Project (Read-only) */}
            {(tag?.project_name || activeProjectName) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {t('pages.tags.fields.project', 'Project')}:
                  </span>
                  <span className="text-sm text-gray-900">
                    {tag?.project_name || activeProjectName}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t(
                    'pages.tags.fields.projectNote',
                    'Tags are automatically assigned to your active project'
                  )}
                </p>
              </div>
            )}

            {/* Tag Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('pages.tags.fields.name', 'Name')}</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder={t('pages.tags.fields.namePlaceholder', 'Enter tag name')}
                error={errors.name?.message}
                aria-label={t('pages.tags.fields.name', 'Name')}
              />
            </div>

            {/* Color Picker */}
            <ColorPickerField
              value={selectedColor}
              onChange={(color) => setValue('color', color)}
              label={t('pages.tags.fields.color', 'Color')}
              error={errors.color?.message}
              presetColors={PRESET_COLORS}
              showPreview
              previewText={watch('name') || t('pages.tags.fields.tagName', 'Tag Name')}
            />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t('pages.tags.fields.description', 'Description')} (
                {t('pages.tags.fields.optional', 'Optional')})
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder={t('pages.tags.fields.descriptionPlaceholder', 'Enter tag description')}
                error={errors.description?.message}
                rows={3}
                aria-label={t('pages.tags.fields.description', 'Description')}
              />
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? t('common.save', 'Save') : t('common.create', 'Create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
