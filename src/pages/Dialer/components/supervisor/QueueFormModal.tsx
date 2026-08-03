/**
 * Add / Edit dialer queue modal (KAN-379, design: supervisor-02).
 *
 * Follows the design's add/edit form: Queue name + Department + Access group.
 * Department and Access group are checkbox MULTI-selects (a queue can target
 * several departments / groups). An empty selection means "All departments" /
 * "All groups" (unrestricted), matching the backend's empty-array sentinel.
 *
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
import { CheckboxMultiSelect } from '@/components/ui/CheckboxMultiSelect'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalTitle } from '@/components/ui/Modal'
import { useDepartments } from '@/features/departments'
import {
  ACCESS_GROUP_LABELS,
  ACCESS_GROUP_VALUES,
  useCreateDialerQueue,
  useUpdateDialerQueue,
  type DialerQueue,
} from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'

const schema = z.object({
  name: z.string().trim().min(1, 'Queue name is required').max(120),
  // Empty arrays are valid — they mean "All departments" / "All groups".
  department_ids: z.array(z.number().int()),
  access_groups: z.array(z.string()),
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

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments]
  )
  const groupOptions = useMemo(
    () =>
      ACCESS_GROUP_VALUES.map((g) => ({
        value: g as string,
        label: t(`dialer.accessGroup.${g}`, ACCESS_GROUP_LABELS[g]),
      })),
    [t]
  )

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
      department_ids: queue?.department_ids ?? [],
      access_groups: queue?.access_groups ?? [],
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: queue?.name ?? '',
        department_ids: queue?.department_ids ?? [],
        access_groups: queue?.access_groups ?? [],
      })
    }
  }, [open, queue, reset])

  const onSubmit = async (data: FormData) => {
    // Resolve the denormalized labels the list renders from the picked ids.
    const department_names = departments
      .filter((d) => data.department_ids.includes(d.id))
      .map((d) => d.name)
    const payload = { ...data, department_names }
    try {
      if (isEdit && queue) {
        await updateMutation.mutateAsync({ id: queue.id, payload })
        toast.success(t('dialer.queueForm.updated', 'Queue updated'))
      } else {
        await createMutation.mutateAsync(payload)
        toast.success(t('dialer.queueForm.created', 'Queue created'))
      }
      onClose()
    } catch {
      // Fallback error toast is emitted by the mutation's onError.
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      {/* Header: green-circle dial-square icon + title, subtitle, then divider
          (design: supervisor-02 — description sits above the divider). */}
      <div className="border-border border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
            <Icons.DialpadSquare
              size={20}
              className="text-primary-foreground sm:size-6"
              strokeWidth={1.5}
            />
          </div>
          <ModalTitle className="text-foreground text-lg font-medium break-words sm:text-xl md:text-2xl">
            {isEdit
              ? t('dialer.queueForm.editTitle', 'Edit queue')
              : t('dialer.queueForm.createTitle', 'Add a new queue')}
          </ModalTitle>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {t('dialer.queueForm.subtitle', 'Specify the name and set access for the queue')}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
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

            {/* Department (multi-select) */}
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t('dialer.queueForm.department', 'Department')}
              </label>
              <Controller
                control={control}
                name="department_ids"
                render={({ field }) => (
                  <CheckboxMultiSelect
                    options={departmentOptions}
                    selected={field.value}
                    onChange={field.onChange}
                    allLabel={t('dialer.queueForm.allDepartments', 'All departments')}
                    ariaLabel={t('dialer.queueForm.department', 'Department')}
                  />
                )}
              />
            </div>

            {/* Access group (multi-select) */}
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">
                {t('dialer.queueForm.accessGroup', 'Access group')}
              </label>
              <Controller
                control={control}
                name="access_groups"
                render={({ field }) => (
                  <CheckboxMultiSelect
                    options={groupOptions}
                    selected={field.value}
                    onChange={field.onChange}
                    allLabel={t('dialer.accessGroup.all_groups', ACCESS_GROUP_LABELS.all_groups)}
                    ariaLabel={t('dialer.queueForm.accessGroup', 'Access group')}
                  />
                )}
              />
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} className="flex-1">
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
