/**
 * CreateGroupModal - Create a group within a department.
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
import { useCreateGroup } from '@/features/groups'

interface CreateGroupModalProps {
  open: boolean
  departmentId: number
  onClose: () => void
  onSuccess: () => void
}

const schema = z.object({
  name: z.string().min(1, 'pages.groups.validation.nameRequired'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function CreateGroupModal({
  open,
  departmentId,
  onClose,
  onSuccess,
}: CreateGroupModalProps) {
  const { t } = useTranslation('common')
  const createMutation = useCreateGroup()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        department_id: departmentId,
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
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Add size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.groups.modals.create.title')}
        onClose={handleClose}
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            <div>
              <Label htmlFor="group-name" required>
                {t('pages.groups.forms.name')}
              </Label>
              <Input
                id="group-name"
                {...register('name')}
                placeholder={t('pages.groups.forms.placeholders.name')}
                disabled={createMutation.isPending}
              />
              {errors.name && (
                <p className="text-error-500 mt-1 text-sm">{t(errors.name.message ?? '')}</p>
              )}
            </div>
            <div>
              <Label htmlFor="group-description">{t('pages.groups.forms.description')}</Label>
              <Textarea
                id="group-description"
                {...register('description')}
                placeholder={t('pages.groups.forms.placeholders.description')}
                rows={3}
                disabled={createMutation.isPending}
              />
            </div>
            {createMutation.isError && (
              <Alert variant="error">
                <p className="text-sm">
                  {createMutation.error?.message || t('pages.groups.forms.errors.failedToCreate')}
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
