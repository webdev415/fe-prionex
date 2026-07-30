import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useScheduleOneOnOne } from '@/features/quality/coaching/hooks'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'

/**
 * Schedule 1-on-1 dialog (KAN-413, Quick Action #2).
 *
 * Trainer-only form. Posts to `/api/v1/quality/coaching/one-on-ones`. On
 * success the BE fires the `one_on_one_scheduled` notification to the
 * operator (KAN-413 §1.6 / step 6) and the header KPI strip refreshes via
 * the query invalidation in `useScheduleOneOnOne`.
 *
 * Notes are optional. Duration defaults to 30 min (BE default).
 *
 * Calendar integration is out of scope for v1 — this is a scheduling +
 * notification surface only.
 */
export interface ScheduleOneOnOneDialogProps {
  open: boolean
  onClose: () => void
  operatorId: number | undefined
}

function toDateTimeLocal(value: Date): string {
  // <input type="datetime-local"> expects 'YYYY-MM-DDTHH:MM' in local time.
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}`
  )
}

function defaultStartLocal(): string {
  // Default to tomorrow at 10:00 local. Tomorrow avoids the BE's "must be
  // in the future" guard tripping on a one-minute-late submit.
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(10, 0, 0, 0)
  return toDateTimeLocal(t)
}

export function ScheduleOneOnOneDialog({ open, onClose, operatorId }: ScheduleOneOnOneDialogProps) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const operator = operatorId ? operators.find((o) => o.id === operatorId) : undefined

  const [scheduledAt, setScheduledAt] = useState<string>(defaultStartLocal)
  const [durationMinutes, setDurationMinutes] = useState<number>(30)
  const [notes, setNotes] = useState<string>('')

  // Reset form whenever the dialog opens or the focused operator changes
  // while it's open. Adjust state during render (React docs pattern) so we
  // don't trip the set-state-in-effect lint rule.
  const [trackedOpen, setTrackedOpen] = useState(open)
  const [trackedOperatorId, setTrackedOperatorId] = useState(operatorId)
  if (open !== trackedOpen || operatorId !== trackedOperatorId) {
    setTrackedOpen(open)
    setTrackedOperatorId(operatorId)
    if (open) {
      setScheduledAt(defaultStartLocal())
      setDurationMinutes(30)
      setNotes('')
    }
  }

  const mutation = useScheduleOneOnOne()

  const handleSubmit = async () => {
    if (!operatorId) {
      toast.error(
        t(
          'pages.actionAnalysis.inbox.scheduleOneOnOne.errors.noOperator',
          'Select an operator first.'
        )
      )
      return
    }
    if (!scheduledAt) {
      toast.error(
        t('pages.actionAnalysis.inbox.scheduleOneOnOne.errors.noDate', 'Pick a date and time.')
      )
      return
    }

    // Convert the local datetime to ISO. The Date constructor interprets
    // 'YYYY-MM-DDTHH:MM' as local time, which is what we want.
    const isoDatetime = new Date(scheduledAt).toISOString()

    try {
      await mutation.mutateAsync({
        operator_id: operatorId,
        scheduled_at: isoDatetime,
        duration_minutes: durationMinutes,
        notes: notes.trim() || null,
      })
      toast.success(
        t(
          'pages.actionAnalysis.inbox.scheduleOneOnOne.success',
          '1-on-1 scheduled. The operator has been notified.'
        )
      )
      onClose()
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t(
              'pages.actionAnalysis.inbox.scheduleOneOnOne.errors.generic',
              'Could not schedule the session.'
            )
      toast.error(detail)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={t('pages.actionAnalysis.inbox.scheduleOneOnOne.title', 'Schedule 1-on-1')}
      />
      <ModalContent>
        <div className="flex flex-col gap-4">
          {!operatorId ? (
            <p className="bg-error-100 text-error-700 rounded-lg px-3 py-2 text-sm">
              {t(
                'pages.actionAnalysis.inbox.scheduleOneOnOne.errors.noOperator',
                'Select an operator first.'
              )}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium">
                {t('pages.actionAnalysis.inbox.scheduleOneOnOne.operator', 'Operator')}
              </span>
              <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm font-medium">
                {operator?.full_name ?? `#${operatorId}`}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="schedule-one-on-one-datetime"
                className="text-muted-foreground text-xs font-medium"
              >
                {t('pages.actionAnalysis.inbox.scheduleOneOnOne.scheduledAt', 'Date and time')}
              </label>
              <Input
                id="schedule-one-on-one-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-[40px] text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="schedule-one-on-one-duration"
                className="text-muted-foreground text-xs font-medium"
              >
                {t('pages.actionAnalysis.inbox.scheduleOneOnOne.duration', 'Duration (minutes)')}
              </label>
              <Input
                id="schedule-one-on-one-duration"
                type="number"
                min={5}
                max={240}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number.parseInt(e.target.value, 10) || 30)}
                className="h-[40px] text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="schedule-one-on-one-notes"
              className="text-muted-foreground text-xs font-medium"
            >
              {t('pages.actionAnalysis.inbox.scheduleOneOnOne.notes', 'Notes (optional)')}
            </label>
            <textarea
              id="schedule-one-on-one-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder={t(
                'pages.actionAnalysis.inbox.scheduleOneOnOne.notesPlaceholder',
                'What do you want to cover in this session?'
              )}
              className="focus:border-primary-400 border-border rounded-md border px-3 py-2 text-sm focus:outline-none"
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
          disabled={mutation.isPending || !operatorId || !scheduledAt}
          className="rounded-full"
        >
          {mutation.isPending
            ? t('pages.actionAnalysis.inbox.scheduleOneOnOne.submitting', 'Scheduling…')
            : t('pages.actionAnalysis.inbox.scheduleOneOnOne.submit', 'Schedule session')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ScheduleOneOnOneDialog
