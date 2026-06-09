import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  useCreateCorrectionTask,
  useCallMonitoring,
  type CorrectionTaskType,
  type CorrectionTaskPriority,
} from '@/features/training'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'

/**
 * Trainer creates a correction task linked to one of the operator's
 * recent calls (KAN-411 Feature 3.1 / Inbox Quick Action #1).
 *
 * The dialog picks the operator's last 20 calls (last_30d window) so the
 * trainer can anchor the task to a specific recording. Once submitted,
 * task-service inserts the row with ``task_type='correction'`` and
 * ``status='notified'`` — the operator gets a push notification (via the
 * notification routing key wired in this slice) and the task appears in
 * their My-Tasks list. The trainer can later confirm/return via the
 * Tasks tab.
 */
export interface CreateCorrectionTaskDialogProps {
  open: boolean
  onClose: () => void
  operatorId: number | undefined
}

const TASK_TYPES: { id: CorrectionTaskType; key: string; fallback: string }[] = [
  {
    id: 'listen_reflect',
    key: 'pages.training.correction.types.listenReflect',
    fallback: 'Listen & reflect',
  },
  {
    id: 'practice_next_call',
    key: 'pages.training.correction.types.practiceNextCall',
    fallback: 'Practice in next call',
  },
  {
    id: 'study_material',
    key: 'pages.training.correction.types.studyMaterial',
    fallback: 'Study material',
  },
  {
    id: 'correction',
    key: 'pages.training.correction.types.correction',
    fallback: 'Generic correction',
  },
]

const PRIORITY_OPTIONS: { id: CorrectionTaskPriority; key: string; fallback: string }[] = [
  { id: 'low', key: 'pages.training.correction.priority.low', fallback: 'Low' },
  { id: 'normal', key: 'pages.training.correction.priority.normal', fallback: 'Normal' },
  { id: 'high', key: 'pages.training.correction.priority.high', fallback: 'High' },
  { id: 'urgent', key: 'pages.training.correction.priority.urgent', fallback: 'Urgent' },
]

function toDateInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function defaultDueDate(): string {
  // Default to tomorrow so the operator has at least one day to act.
  const t = new Date()
  t.setDate(t.getDate() + 1)
  return toDateInput(t)
}

export function CreateCorrectionTaskDialog({
  open,
  onClose,
  operatorId,
}: CreateCorrectionTaskDialogProps) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const operator = operatorId ? operators.find((o) => o.id === operatorId) : undefined
  const extension = operator?.asterisk_extension ?? null

  const { data: callsData, isLoading: callsLoading } = useCallMonitoring(
    {
      agent_extensions: extension ? [extension] : [],
      period: 'last_30d',
      sort: 'date_desc',
      limit: 20,
    },
    open && !!extension
  )
  // Wrap in useMemo so the logical fallback doesn't churn a new array
  // identity on every render and break the downstream useMemo's deps.
  const calls = useMemo(() => callsData?.calls ?? [], [callsData])

  const [callId, setCallId] = useState<string>('')
  const [taskType, setTaskType] = useState<CorrectionTaskType>('listen_reflect')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<string>(defaultDueDate)
  const [priority, setPriority] = useState<CorrectionTaskPriority>('normal')
  const [callTimestamp, setCallTimestamp] = useState<string>('')

  // Reset form on open / operator switch (render-time pattern so we
  // don't trip the set-state-in-effect lint rule).
  const [trackedOpen, setTrackedOpen] = useState(open)
  const [trackedOperator, setTrackedOperator] = useState(operatorId)
  if (open !== trackedOpen || operatorId !== trackedOperator) {
    setTrackedOpen(open)
    setTrackedOperator(operatorId)
    if (open) {
      setCallId('')
      setTaskType('listen_reflect')
      setTitle('')
      setDescription('')
      setDueDate(defaultDueDate())
      setPriority('normal')
      setCallTimestamp('')
    }
  }

  const selectedCall = useMemo(() => calls.find((c) => c.call_id === callId), [calls, callId])

  const mutation = useCreateCorrectionTask()

  const handleSubmit = async () => {
    if (!operatorId) {
      toast.error(
        t('pages.training.correction.errors.noOperator', 'Select an operator from the Inbox first.')
      )
      return
    }
    if (!callId) {
      toast.error(
        t(
          'pages.training.correction.errors.noCall',
          'Pick a recent call to anchor the correction task.'
        )
      )
      return
    }
    if (!title.trim()) {
      toast.error(
        t(
          'pages.training.correction.errors.noTitle',
          'Give the task a short title so the operator knows what to fix.'
        )
      )
      return
    }

    const tsSeconds = callTimestamp ? Number.parseInt(callTimestamp, 10) : NaN
    const payload = {
      operator_id: operatorId,
      call_id: callId,
      call_timestamp_seconds: Number.isFinite(tsSeconds) && tsSeconds >= 0 ? tsSeconds : undefined,
      task_type: taskType,
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : undefined,
      priority,
    }

    try {
      await mutation.mutateAsync(payload)
      toast.success(
        t(
          'pages.training.correction.success',
          'Correction task created. The operator has been notified.'
        )
      )
      onClose()
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.training.correction.errors.generic', 'Could not create the correction task.')
      toast.error(detail)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader title={t('pages.training.correction.title', 'Assign correction task')} />
      <ModalContent>
        <div className="flex flex-col gap-4">
          {!operatorId ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(
                'pages.training.correction.errors.noOperator',
                'Select an operator from the Inbox first.'
              )}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.training.correction.operator', 'Operator')}
              </span>
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                {operator?.full_name ?? `#${operatorId}`}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="correction-call" className="text-xs font-medium text-gray-600">
              {t('pages.training.correction.call', 'Call recording')}
            </label>
            {!extension ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t(
                  'pages.training.correction.noExtension',
                  'This operator has no telephony extension; no recent calls available.'
                )}
              </p>
            ) : callsLoading ? (
              <p className="text-xs text-gray-500">
                {t('pages.training.correction.loadingCalls', 'Loading recent calls…')}
              </p>
            ) : calls.length === 0 ? (
              <p className="text-xs text-gray-500">
                {t('pages.training.correction.noCalls', 'No calls found in the last 30 days.')}
              </p>
            ) : (
              <select
                id="correction-call"
                value={callId}
                onChange={(e) => setCallId(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">{t('pages.training.correction.pickCall', 'Pick a call…')}</option>
                {calls.map((call) => {
                  const initiated = call.initiated_at
                    ? new Date(call.initiated_at).toLocaleString()
                    : '—'
                  return (
                    <option key={call.call_id} value={call.call_id}>
                      {initiated} · {call.customer_number}
                      {call.outcome ? ` · ${call.outcome}` : ''}
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          {selectedCall ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="correction-call-ts" className="text-xs font-medium text-gray-600">
                {t(
                  'pages.training.correction.timestamp',
                  'Timestamp in recording (seconds, optional)'
                )}
              </label>
              <Input
                id="correction-call-ts"
                type="number"
                min={0}
                value={callTimestamp}
                onChange={(e) => setCallTimestamp(e.target.value)}
                placeholder="e.g. 83 (for 1:23)"
                className="h-[40px] text-sm"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="correction-type" className="text-xs font-medium text-gray-600">
                {t('pages.training.correction.taskType', 'Task type')}
              </label>
              <select
                id="correction-type"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as CorrectionTaskType)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
              >
                {TASK_TYPES.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {t(opt.key, opt.fallback)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="correction-priority" className="text-xs font-medium text-gray-600">
                {t('pages.training.correction.priority', 'Priority')}
              </label>
              <select
                id="correction-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as CorrectionTaskPriority)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {t(opt.key, opt.fallback)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="correction-title" className="text-xs font-medium text-gray-600">
              {t('pages.training.correction.titleField', 'Title')}
            </label>
            <Input
              id="correction-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder={t(
                'pages.training.correction.titlePlaceholder',
                'e.g. "Skipped objection-handling step"'
              )}
              className="h-[40px] text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="correction-description" className="text-xs font-medium text-gray-600">
              {t('pages.training.correction.descriptionField', 'What to do')}
            </label>
            <textarea
              id="correction-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              placeholder={t(
                'pages.training.correction.descriptionPlaceholder',
                'Describe the error and the corrective action the operator should take.'
              )}
              className="focus:border-primary-400 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="correction-due" className="text-xs font-medium text-gray-600">
              {t('pages.training.correction.dueDate', 'Due date')}
            </label>
            <Input
              id="correction-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
          disabled={mutation.isPending || !operatorId || !callId || !title.trim()}
          className="rounded-full"
        >
          {mutation.isPending
            ? t('pages.training.correction.submitting', 'Creating…')
            : t('pages.training.correction.submit', 'Create task')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreateCorrectionTaskDialog
