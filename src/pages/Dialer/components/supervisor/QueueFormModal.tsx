/**
 * Add / Edit dialer queue modal (KAN-379, design: supervisor-02).
 *
 * Follows the design's add/edit form: Queue name + Department + Access group.
 * NOTE: the ticket's richer preset config (§4.1 — telephony type, aggressiveness,
 * SIM limits, wait/hold timings, calling hours, answer mode) is not part of this
 * modal in the current design and is deferred to a dedicated configuration
 * surface (see KAN-379-aggressive-dialer-frontend-plan.md §7 open decisions).
 *
 * Cloned from DocumentTypeFormModal (react-hook-form + zod + Modal composition).
 */

import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useDepartments } from '@/features/departments'
import {
  ACCESS_GROUPS,
  ACCESS_GROUP_LABELS,
  useCreateDialerQueue,
  useUpdateDialerQueue,
  type DialerQueue,
} from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'

const schema = z.object({
  name: z.string().trim().min(1, 'Queue name is required').max(120),
  department_id: z.number().int().min(1, 'Department is required'),
  access_group: z.enum(ACCESS_GROUPS),
})

type FormData = z.infer<typeof schema>

export interface QueueFormModalProps {
  open: boolean
  queue?: DialerQueue
  onClose: () => void
}

export function QueueFormModal({ open, queue, onClose }: QueueFormModalProps) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined

  const isEdit = Boolean(queue)

  const { data: departmentsData } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = useMemo(() => departmentsData?.departments ?? [], [departmentsData])

  const createMutation = useCreateDialerQueue()
  const updateMutation = useUpdateDialerQueue()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: queue?.name ?? '',
      department_id: queue?.department_id ?? 0,
      access_group: (queue?.access_group as FormData['access_group']) ?? 'all_groups',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: queue?.name ?? '',
        department_id: queue?.department_id ?? 0,
        access_group: (queue?.access_group as FormData['access_group']) ?? 'all_groups',
      })
    }
  }, [open, queue, reset])

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && queue) {
        await updateMutation.mutateAsync({ id: queue.id, payload: data })
        toast.success(t('dialer.queueForm.updated', 'Queue updated'))
      } else {
        await createMutation.mutateAsync(data)
        toast.success(t('dialer.queueForm.created', 'Queue created'))
      }
      onClose()
    } catch {
      // Fallback error toast is emitted by the mutation's onError.
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={<Icons.Phone size={22} className="text-primary-600" strokeWidth={2} />}
        title={
          isEdit
            ? t('dialer.queueForm.editTitle', 'Edit queue')
            : t('dialer.queueForm.createTitle', 'Add a new queue')
        }
      />
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <p className="text-muted-foreground mb-4 text-sm">
            {t('dialer.queueForm.subtitle', 'Specify the name and set access for the queue')}
          </p>

          <div className="flex flex-col gap-4">
            {/* Queue name */}
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t('dialer.queueForm.name', 'Queue name')}
              </label>
              <Input
                {...register('name')}
                placeholder={t('dialer.queueForm.namePlaceholder', 'Enter the queue name')}
                variant={errors.name ? 'error' : 'default'}
              />
              {errors.name && <p className="text-error-500 mt-1 text-xs">{errors.name.message}</p>}
            </div>

            {/* Department */}
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t('dialer.queueForm.department', 'Department')}
              </label>
              <Controller
                control={control}
                name="department_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('dialer.queueForm.selectDepartment', 'Select a department')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={String(dept.id)}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.department_id && (
                <p className="text-error-500 mt-1 text-xs">{errors.department_id.message}</p>
              )}
            </div>

            {/* Access group */}
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t('dialer.queueForm.accessGroup', 'Access group')}
              </label>
              <Controller
                control={control}
                name="access_group"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('dialer.queueForm.selectGroup', 'Select groups')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {t(`dialer.accessGroup.${group}`, ACCESS_GROUP_LABELS[group])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isEdit
              ? t('dialer.queueForm.save', 'Save changes')
              : t('dialer.queueForm.create', 'Create queue')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

export default QueueFormModal
