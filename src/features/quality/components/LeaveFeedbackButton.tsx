/**
 * LeaveFeedbackButton — trainer-side "leave feedback" affordance (KAN-410, Feature 2.3).
 *
 * Opens a popup with type / text / optional timestamp fields. Timestamp is
 * pre-filled from the parent's `getCurrentTimeMs` callback (mirrors the
 * `AddMarkerButton` flow) when available, but the trainer can clear it.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useCreateFeedback } from '../hooks/useFeedback'
import { FEEDBACK_TYPES, type FeedbackType } from '../types'
import { defaultDeadline } from '../lib/deadline'

interface LeaveFeedbackButtonProps {
  callId: string
  operatorId: number
  /** Optional — when provided, the popup pre-fills the timestamp field. */
  getCurrentTimeMs?: () => number
  onCreated?: () => void
}

export function LeaveFeedbackButton({
  callId,
  operatorId,
  getCurrentTimeMs,
  onCreated,
}: LeaveFeedbackButtonProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('note')
  const [text, setText] = useState('')
  const [includeTimestamp, setIncludeTimestamp] = useState(false)
  const [deadline, setDeadline] = useState('')
  const createMutation = useCreateFeedback()

  const isCorrectionTask = feedbackType === 'correction_task'

  const handleOpen = () => {
    if (!open) {
      // When opening, snapshot the current player position so a slow
      // typist's timestamp lines up with when they clicked the button.
      setIncludeTimestamp(getCurrentTimeMs != null)
    }
    setOpen((o) => !o)
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    if (isCorrectionTask && !deadline) return
    const timestamp = includeTimestamp && getCurrentTimeMs ? getCurrentTimeMs() : null
    const deadlineIso = isCorrectionTask && deadline ? new Date(deadline).toISOString() : null
    await createMutation.mutateAsync({
      call_id: callId,
      operator_id: operatorId,
      feedback_type: feedbackType,
      text: text.trim(),
      timestamp_ms: timestamp,
      deadline: deadlineIso,
    })
    setText('')
    setFeedbackType('note')
    setDeadline('')
    setOpen(false)
    onCreated?.()
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleOpen}
        leftIcon={<Icons.Bell size={14} className="text-dark-500" />}
        className="h-[40px] rounded-md text-xs sm:h-[45px] sm:text-sm"
      >
        {t('pages.training.feedback.leave', 'Leave feedback')}
      </Button>

      {open ? (
        <div className="border-border bg-card absolute right-0 z-20 mt-1 w-80 rounded-lg border p-3 shadow-lg">
          <label className="text-foreground text-xs font-medium">
            {t('pages.training.feedback.typeLabel', 'Type')}
          </label>
          <select
            value={feedbackType}
            onChange={(e) => {
              const next = e.target.value as FeedbackType
              setFeedbackType(next)
              if (next === 'correction_task' && !deadline) setDeadline(defaultDeadline())
            }}
            className="border-border mt-1 mb-2 w-full rounded-md border px-2 py-1.5 text-sm"
          >
            {FEEDBACK_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {t(`pages.training.feedback.types.${ft}`, ft.replace(/_/g, ' '))}
              </option>
            ))}
          </select>

          <label className="text-foreground text-xs font-medium">
            {t('pages.training.feedback.text', 'Feedback text')}
          </label>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="border-border mt-1 mb-2 w-full rounded-md border px-2 py-1 text-sm"
          />

          {getCurrentTimeMs ? (
            <label className="text-foreground mb-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeTimestamp}
                onChange={(e) => setIncludeTimestamp(e.target.checked)}
              />
              {t('pages.training.feedback.includeTimestamp', 'Include current playback position')}
            </label>
          ) : null}

          {isCorrectionTask ? (
            <>
              <label className="text-foreground text-xs font-medium">
                {t('pages.training.feedback.deadline', 'Deadline')}
              </label>
              <input
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="border-border mt-1 mb-2 w-full rounded-md border px-2 py-1 text-sm"
              />
            </>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="cancel"
              size="sm"
              onClick={() => setOpen(false)}
              className="rounded-md"
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || !text.trim() || (isCorrectionTask && !deadline)}
              className="rounded-md"
            >
              {t('pages.training.feedback.send', 'Send')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
