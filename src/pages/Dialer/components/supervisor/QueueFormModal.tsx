/**
 * Add / Edit dialer queue modal (KAN-379, design: supervisor-02).
 *
 * Follows the design's add/edit form: Queue name + Department + Access group.
 * Department and Access group are checkbox MULTI-selects (a queue can target
 * several departments / groups). An empty selection means "All departments" /
 * "All groups" (unrestricted), matching the backend's empty-array sentinel.
 *
 * The design deferred the ticket's richer preset config (§4.1) to a dedicated
 * configuration surface. Three of those fields turned out to be load-bearing
 * once the CRM drove the real gateway, so they live here under "Dialing
 * settings" until that surface exists:
 *
 *  - telephony_type is IMMUTABLE after creation, both here and on the gateway,
 *    and the default (white) does not match every deployment's SIM pool. Create
 *    is the only chance to get it right, so it is an explicit choice, not a
 *    hidden default.
 *  - priority and sim_card_limit are validated upstream against ranges and the
 *    department's SIM ceiling; a queue that trips either cannot sync a campaign.
 *  - the retry policy decides whether a transient line failure re-attempts or
 *    permanently exhausts the number. Line failures are periodic and accepted,
 *    so this is the mitigation, not a tuning knob.
 *
 * Aggressiveness, wait/hold timings and calling hours remain deferred — their
 * defaults are safe.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
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
  telephony_type: z.enum(['white', 'grey']),
  answer_mode: z.enum(['auto', 'manual']),
  // Mirrors the gateway's campaign range; 0 is rejected upstream.
  priority: z
    .number({ error: 'Enter a number from 1 to 5' })
    .int()
    .min(1, 'Minimum is 1')
    .max(5, 'Maximum is 5'),
  sim_card_limit: z.number({ error: 'Enter a number' }).int().min(1, 'Minimum is 1'),
  // Total attempts, not retries. Never 0 — upstream that means dial-once.
  max_attempts: z.number({ error: 'Enter a number' }).int().min(1, 'At least 1 attempt'),
  retry_delay_failed_seconds: z
    .number({ error: 'Enter a number of seconds' })
    .int()
    .min(0, 'Cannot be negative'),
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
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: queue?.name ?? '',
      department_ids: queue?.department_ids ?? [],
      access_groups: queue?.access_groups ?? [],
      telephony_type: queue?.telephony_type ?? 'white',
      answer_mode: queue?.answer_mode ?? 'auto',
      priority: queue?.priority ?? 3,
      sim_card_limit: queue?.sim_card_limit ?? 4,
      max_attempts: queue?.max_attempts ?? 3,
      retry_delay_failed_seconds: queue?.retry_delay_failed_seconds ?? 60,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name: queue?.name ?? '',
        department_ids: queue?.department_ids ?? [],
        access_groups: queue?.access_groups ?? [],
        telephony_type: queue?.telephony_type ?? 'white',
        answer_mode: queue?.answer_mode ?? 'auto',
        priority: queue?.priority ?? 3,
        sim_card_limit: queue?.sim_card_limit ?? 4,
        max_attempts: queue?.max_attempts ?? 3,
        retry_delay_failed_seconds: queue?.retry_delay_failed_seconds ?? 60,
      })
    }
  }, [open, queue, reset])

  const onSubmit = async (data: FormData) => {
    // Resolve the denormalized labels the list renders from the picked ids.
    const department_names = departments
      .filter((d) => data.department_ids.includes(d.id))
      .map((d) => d.name)
    try {
      if (isEdit && queue) {
        // Send only what the supervisor actually touched. `queue` is a row from
        // the paged list, not a detail fetch, so any dialing setting the list
        // DTO omits would have been seeded from the `??` defaults below and
        // then written back — silently replacing the queue's real gateway
        // configuration on an unrelated edit like a rename. max_attempts makes
        // that worse: changing it re-caps dial-list entries already loaded
        // upstream.
        //
        // telephony_type is never sent on update regardless: it is immutable
        // here and on the gateway, so including it would only look like it
        // took effect.
        const changed = (Object.keys(dirtyFields) as (keyof FormData)[]).filter(
          (key) => key !== 'telephony_type'
        )
        const payload: Partial<DialerQueue> & { department_names?: string[] } = {}
        for (const key of changed) {
          Object.assign(payload, { [key]: data[key] })
        }
        if (dirtyFields.department_ids) payload.department_names = department_names
        if (changed.length === 0 && !dirtyFields.department_ids) {
          onClose()
          return
        }
        await updateMutation.mutateAsync({ id: queue.id, payload })
        toast.success(t('dialer.queueForm.updated', 'Queue updated'))
      } else {
        await createMutation.mutateAsync({ ...data, department_names })
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

            {/* --- Dialing settings ------------------------------------------
                Deferred by the design, but load-bearing: see the module note. */}
            <div className="border-border mt-2 border-t pt-4">
              <p className="text-foreground mb-3 text-sm font-medium">
                {t('dialer.queueForm.dialingSettings', 'Dialing settings')}
              </p>

              <div className="flex flex-col gap-4">
                {/* Telephony type — create only (immutable afterwards) */}
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    {t('dialer.queueForm.telephonyType', 'Telephony type')}
                  </label>
                  {isEdit ? (
                    <p className="text-muted-foreground text-sm">
                      {t(
                        `dialer.telephonyType.${queue?.telephony_type ?? 'white'}`,
                        queue?.telephony_type ?? 'white'
                      )}{' '}
                      <span className="text-xs">
                        {t('dialer.queueForm.immutable', '(cannot be changed after creation)')}
                      </span>
                    </p>
                  ) : (
                    <Controller
                      control={control}
                      name="telephony_type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger
                            aria-label={t('dialer.queueForm.telephonyType', 'Telephony type')}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="white">
                              {t('dialer.telephonyType.white', 'White')}
                            </SelectItem>
                            <SelectItem value="grey">
                              {t('dialer.telephonyType.grey', 'Grey')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                  {!isEdit && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t(
                        'dialer.queueForm.telephonyTypeHint',
                        'Must match the SIM pool for this department. Cannot be changed later.'
                      )}
                    </p>
                  )}
                </div>

                {/* Answer mode — the gateway's accept_mode. On 'auto' it bridges
                    the customer to whichever operator is free, with no chance to
                    decline; 'manual' opens an accept window on the operator's
                    screen first. */}
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    {t('dialer.queueForm.answerMode', 'Answer mode')}
                  </label>
                  <Controller
                    control={control}
                    name="answer_mode"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label={t('dialer.queueForm.answerMode', 'Answer mode')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            {t('dialer.answerMode.auto', 'Automatic')}
                          </SelectItem>
                          <SelectItem value="manual">
                            {t('dialer.answerMode.manual', 'Manual (operator accepts)')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(
                      'dialer.queueForm.answerModeHint',
                      'Manual gives operators an accept window before the customer is connected.'
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* Priority */}
                  <div className="flex-1">
                    <label
                      htmlFor="queue-priority"
                      className="text-foreground mb-1 block text-sm font-medium"
                    >
                      {t('dialer.queueForm.priority', 'Priority')}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      id="queue-priority"
                      {...register('priority', { valueAsNumber: true })}
                      error={errors.priority?.message}
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('dialer.queueForm.priorityHint', '1–5. Higher wins when SIMs are scarce.')}
                    </p>
                  </div>

                  {/* SIM card limit */}
                  <div className="flex-1">
                    <label
                      htmlFor="queue-sim_card_limit"
                      className="text-foreground mb-1 block text-sm font-medium"
                    >
                      {t('dialer.queueForm.simCardLimit', 'SIM card limit')}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      id="queue-sim_card_limit"
                      {...register('sim_card_limit', { valueAsNumber: true })}
                      error={errors.sim_card_limit?.message}
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t(
                        'dialer.queueForm.simCardLimitHint',
                        "Capped at the department's own SIM limit."
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* Attempts */}
                  <div className="flex-1">
                    <label
                      htmlFor="queue-max_attempts"
                      className="text-foreground mb-1 block text-sm font-medium"
                    >
                      {t('dialer.queueForm.maxAttempts', 'Attempts per number')}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      id="queue-max_attempts"
                      {...register('max_attempts', { valueAsNumber: true })}
                      error={errors.max_attempts?.message}
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t(
                        'dialer.queueForm.maxAttemptsHint',
                        'Total attempts, including the first. Line failures are periodic, so a retry usually lands on another SIM.'
                      )}
                    </p>
                  </div>

                  {/* Retry delay after a failure */}
                  <div className="flex-1">
                    <label
                      htmlFor="queue-retry_delay_failed_seconds"
                      className="text-foreground mb-1 block text-sm font-medium"
                    >
                      {t('dialer.queueForm.retryDelayFailed', 'Retry delay (seconds)')}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      id="queue-retry_delay_failed_seconds"
                      {...register('retry_delay_failed_seconds', { valueAsNumber: true })}
                      error={errors.retry_delay_failed_seconds?.message}
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t('dialer.queueForm.retryDelayFailedHint', '0 disables retrying failures.')}
                    </p>
                  </div>
                </div>
              </div>
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
