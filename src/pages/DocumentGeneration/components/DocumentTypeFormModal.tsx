/**
 * Create / edit modal for a single document type.
 *
 * Two fields: name (required, ~100 char cap) and color (hex, picked via
 * ``ColorPickerField``). Mirrors ``TagFormModal`` in shape but is
 * deliberately much smaller — document types have no categories,
 * visibility flags, or role-scoped rules to configure.
 */

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AxiosError } from 'axios'

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { ColorPickerField } from '@/components/forms'
import { Icons } from '@/lib/icons'
import {
  useCreateDocumentType,
  useUpdateDocumentType,
  type DocumentType,
} from '@/features/documentTypes'

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  color: z.string().regex(HEX_COLOR_PATTERN, 'Color must be a hex value (#RRGGBB)'),
})

type FormData = z.infer<typeof schema>

interface DocumentTypeFormModalProps {
  open: boolean
  documentType?: DocumentType
  onClose: () => void
  onSuccess?: () => void
}

const DEFAULT_COLOR = '#3B82F6'

export function DocumentTypeFormModal({
  open,
  documentType,
  onClose,
  onSuccess,
}: DocumentTypeFormModalProps) {
  const { t } = useTranslation('common')
  const isEdit = Boolean(documentType)

  const createMutation = useCreateDocumentType()
  const updateMutation = useUpdateDocumentType()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: documentType?.name ?? '',
      color: documentType?.color ?? DEFAULT_COLOR,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: documentType?.name ?? '',
        color: documentType?.color ?? DEFAULT_COLOR,
      })
    }
  }, [open, documentType, reset])

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && documentType) {
        await updateMutation.mutateAsync({
          id: documentType.id,
          input: { name: data.name, color: data.color },
        })
        toast.success(t('pages.documentGeneration.types.toast.updated', 'Document type updated'))
      } else {
        await createMutation.mutateAsync({ name: data.name, color: data.color })
        toast.success(t('pages.documentGeneration.types.toast.created', 'Document type created'))
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      const status = axiosErr.response?.status
      const detail = axiosErr.response?.data?.detail
      if (status === 409) {
        toast.error(
          detail ||
            t(
              'pages.documentGeneration.types.uniqueNameError',
              'A document type with this name already exists.'
            )
        )
      } else if (detail) {
        toast.error(detail)
      }
      // Non-409 errors already surface via the hook's default onError.
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Tag01 size={18} className="text-primary-foreground sm:size-5" strokeWidth={2} />
          </div>
        }
        title={
          isEdit
            ? t('pages.documentGeneration.types.editTitle', 'Edit document type')
            : t('pages.documentGeneration.types.createTitle', 'New document type')
        }
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="dt-name">
              {t('pages.documentGeneration.types.fields.name', 'Name')}
              <span className="text-error-500 ml-0.5">*</span>
            </Label>
            <Input
              id="dt-name"
              placeholder={t(
                'pages.documentGeneration.types.fields.namePlaceholder',
                'e.g. Passport'
              )}
              {...register('name')}
            />
            {errors.name && <p className="text-error-500 text-xs">{errors.name.message}</p>}
          </div>

          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <ColorPickerField
                value={field.value}
                onChange={field.onChange}
                label={t('pages.documentGeneration.types.fields.color', 'Color')}
                error={errors.color?.message}
                previewText={
                  documentType?.name ??
                  t('pages.documentGeneration.types.fields.previewText', 'Document type')
                }
              />
            )}
          />
        </ModalContent>
        <ModalFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
          >
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
          >
            {isSubmitting
              ? t('actions.saving', 'Saving…')
              : isEdit
                ? t('actions.save', 'Save')
                : t('actions.create', 'Create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
