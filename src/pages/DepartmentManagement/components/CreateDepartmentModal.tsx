/**
 * CreateDepartmentModal Component
 *
 * Modal for creating a new department in a project.
 */

import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import { useCreateDepartment } from '@/features/departments'

interface CreateDepartmentModalProps {
  open: boolean
  projectId: number
  onClose: () => void
  onSuccess: () => void
}

const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
})

type CreateDepartmentFormData = z.infer<typeof createDepartmentSchema>

export function CreateDepartmentModal({
  open,
  projectId,
  onClose,
  onSuccess,
}: CreateDepartmentModalProps) {
  const { t } = useTranslation('common')
  const createMutation = useCreateDepartment()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateDepartmentFormData>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const onSubmit = (data: CreateDepartmentFormData) => {
    createMutation.mutate(
      {
        project_id: projectId,
        name: data.name,
        description: data.description || undefined,
      },
      {
        onSuccess: () => {
          reset()
          onSuccess()
        },
      }
    )
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.departments.modals.create.title')}
        onClose={handleClose}
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            {/* Department Name */}
            <div>
              <Label htmlFor="name" required>
                {t('pages.departments.forms.name')}
              </Label>
              <Input
                id="name"
                {...register('name')}
                placeholder={t('pages.departments.forms.placeholders.name')}
                disabled={createMutation.isPending}
              />
              {errors.name && <p className="text-error-500 mt-1 text-sm">{errors.name.message}</p>}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">{t('pages.departments.forms.description')}</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder={t('pages.departments.forms.placeholders.description')}
                rows={3}
                disabled={createMutation.isPending}
              />
              {errors.description && (
                <p className="text-error-500 mt-1 text-sm">{errors.description.message}</p>
              )}
            </div>

            {/* Error Alert */}
            {createMutation.isError && (
              <Alert variant="error">
                <p className="text-sm">
                  {createMutation.error?.message ||
                    t('pages.departments.forms.errors.failedToCreate')}
                </p>
              </Alert>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          <Button
            type="button"
            variant="cancel"
            onClick={handleClose}
            className="h-[45px] flex-1 text-sm"
            disabled={createMutation.isPending}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="h-[45px] flex-1 text-sm"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? t('actions.creating') : t('actions.create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
