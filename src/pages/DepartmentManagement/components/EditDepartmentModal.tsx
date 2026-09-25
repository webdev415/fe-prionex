/**
 * EditDepartmentModal Component
 *
 * Modal for editing an existing department.
 */

import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import { useDepartment, useUpdateDepartment } from '@/features/departments'
import { useProject } from '@/features/projects/hooks/useProject'
import { useEffect } from 'react'

interface EditDepartmentModalProps {
  open: boolean
  departmentId: number
  onClose: () => void
  onSuccess: () => void
}

const editDepartmentSchema = z.object({
  name: z.string().min(1, 'pages.departments.validation.nameRequired'),
  description: z.string().optional(),
})

type EditDepartmentFormData = z.infer<typeof editDepartmentSchema>

export function EditDepartmentModal({
  open,
  departmentId,
  onClose,
  onSuccess,
}: EditDepartmentModalProps) {
  const { t } = useTranslation('common')
  const { data: department, isLoading: departmentLoading } = useDepartment(departmentId)
  const { data: project, isLoading: projectLoading } = useProject(department?.project_id ?? 0, {
    enabled: !!department?.project_id && department.project_id > 0,
  })
  const updateMutation = useUpdateDepartment()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditDepartmentFormData>({
    resolver: zodResolver(editDepartmentSchema),
  })

  // Reset form when department data loads
  useEffect(() => {
    if (department) {
      reset({
        name: department.name,
        description: department.description || '',
      })
    }
  }, [department, reset])

  const isLoading = departmentLoading || (department?.project_id ? projectLoading : false)

  const onSubmit = (data: EditDepartmentFormData) => {
    updateMutation.mutate(
      {
        id: departmentId,
        data: {
          name: data.name,
          description: data.description || undefined,
        },
      },
      {
        onSuccess: () => {
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
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.PencilEdit size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.departments.modals.edit.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : department && project ? (
          <form id="edit-department-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-6">
              {/* Project Name (Read-only) */}
              <div>
                <Label>{t('pages.departments.forms.project')}</Label>
                <div className="text-foreground mt-2">{project.name}</div>
              </div>

              {/* Department Name */}
              <div>
                <Label htmlFor="name" required>
                  {t('pages.departments.forms.name')}
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder={t('pages.departments.forms.placeholders.name')}
                  disabled={updateMutation.isPending}
                />
                {errors.name && (
                  <p className="text-error-500 mt-1 text-sm">{t(errors.name.message ?? '')}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">{t('pages.departments.forms.description')}</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder={t('pages.departments.forms.placeholders.description')}
                  rows={3}
                  disabled={updateMutation.isPending}
                />
                {errors.description && (
                  <p className="text-error-500 mt-1 text-sm">{errors.description.message}</p>
                )}
              </div>

              {/* Error Alert */}
              {updateMutation.isError && (
                <Alert variant="error">
                  <p className="text-sm">
                    {updateMutation.error?.message ||
                      t('pages.departments.forms.errors.failedToUpdate')}
                  </p>
                </Alert>
              )}
            </div>
          </form>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            {t('pages.departments.modals.edit.failedToLoad')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={handleClose}
          className="h-[45px] flex-1 text-sm"
          disabled={updateMutation.isPending}
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-department-form"
          variant="primary"
          disabled={isLoading || updateMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {updateMutation.isPending ? t('actions.saving') : t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
