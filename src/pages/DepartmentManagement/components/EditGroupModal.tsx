/**
 * EditGroupModal - Edit an existing group.
 */

import { useEffect } from 'react'
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
import { useGroup, useUpdateGroup } from '@/features/groups'

interface EditGroupModalProps {
  open: boolean
  groupId: number
  onClose: () => void
  onSuccess: () => void
}

const schema = z.object({
  name: z.string().min(1, 'Group name is required'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function EditGroupModal({ open, groupId, onClose, onSuccess }: EditGroupModalProps) {
  const { t } = useTranslation('common')
  const { data: group, isLoading } = useGroup(groupId)
  const updateMutation = useUpdateGroup()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (group) {
      reset({ name: group.name, description: group.description || '' })
    }
  }, [group, reset])

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(
      {
        id: groupId,
        data: { name: data.name, description: data.description || undefined },
      },
      { onSuccess }
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
        title={t('pages.groups.modals.edit.title')}
        onClose={handleClose}
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          {isLoading ? (
            <ModalSkeleton />
          ) : group ? (
            <div className="space-y-6">
              <div>
                <Label>{t('pages.groups.forms.department')}</Label>
                <div className="text-foreground mt-2">{group.department_name || '—'}</div>
              </div>
              <div>
                <Label htmlFor="edit-group-name" required>
                  {t('pages.groups.forms.name')}
                </Label>
                <Input
                  id="edit-group-name"
                  {...register('name')}
                  disabled={updateMutation.isPending}
                />
                {errors.name && (
                  <p className="text-error-500 mt-1 text-sm">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-group-description">
                  {t('pages.groups.forms.description')}
                </Label>
                <Textarea
                  id="edit-group-description"
                  {...register('description')}
                  rows={3}
                  disabled={updateMutation.isPending}
                />
              </div>
              {updateMutation.isError && (
                <Alert variant="error">
                  <p className="text-sm">
                    {updateMutation.error?.message || t('pages.groups.forms.errors.failedToUpdate')}
                  </p>
                </Alert>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('pages.groups.modals.edit.failedToLoad')}
            </p>
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
            variant="primary"
            className="h-[45px] flex-1 text-sm"
            disabled={updateMutation.isPending || isLoading || !group}
          >
            {updateMutation.isPending ? t('actions.saving') : t('actions.save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
