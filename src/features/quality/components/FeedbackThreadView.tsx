/**
 * FeedbackThreadView — single-feedback detail + threaded replies.
 * `viewerRole` gates side-only actions; correction_task rows also expose the
 * linked task's lifecycle (operator Done, trainer Confirm/Return) (KAN-762).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import {
  useCorrectionTaskByFeedback,
  useTransitionCorrectionTask,
} from '@/features/training/hooks/useCorrectionTasks'
import type { CorrectionTaskStatus } from '@/features/training/types/correction'
import {
  feedbackKeys,
  useFeedbackDetail,
  useMarkFeedbackRead,
  useReplyToFeedback,
} from '../hooks/useFeedback'

interface FeedbackThreadViewProps {
  feedbackId: number
  viewerRole: 'trainer' | 'operator'
}

export function FeedbackThreadView({ feedbackId, viewerRole }: FeedbackThreadViewProps) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const detailQuery = useFeedbackDetail(feedbackId)
  const replyMutation = useReplyToFeedback()
  const markReadMutation = useMarkFeedbackRead()
  const transitionMutation = useTransitionCorrectionTask()

  const [replyText, setReplyText] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnComment, setReturnComment] = useState('')

  const isCorrection = detailQuery.data?.feedback_type === 'correction_task'
  const taskQuery = useCorrectionTaskByFeedback(isCorrection ? feedbackId : null)
  const task = taskQuery.data ?? null

  if (detailQuery.isLoading) {
    return (
      <div className="text-muted-foreground p-4 text-sm">{t('common.loading', 'Loading…')}</div>
    )
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="text-error-600 p-4 text-sm">
        {t('pages.training.errors.loadFeedbackFailed', 'Failed to load feedback')}
      </div>
    )
  }

  const feedback = detailQuery.data
  const canMarkRead = viewerRole === 'operator' && feedback.status === 'unread'

  const label = task ? lifecycleLabel(task.status) : null
  const canMarkDone =
    viewerRole === 'operator' &&
    task != null &&
    ['notified', 'read', 'in_progress', 'returned_for_revision'].includes(task.status)
  const canReview = viewerRole === 'trainer' && task != null && task.status === 'completed'
  const deadlineIso = task?.due_date ?? feedback.deadline
  const isOverdue = task?.is_overdue ?? false

  const handleReply = async () => {
    if (!replyText.trim()) return
    await replyMutation.mutateAsync({
      feedbackId: feedback.id,
      text: replyText.trim(),
    })
    setReplyText('')
  }

  const runTransitions = async (states: CorrectionTaskStatus[], comment?: string) => {
    if (!task) return
    for (const to_state of states) {
      await transitionMutation.mutateAsync({
        taskId: task.id,
        payload: { to_state, comment: comment ?? null },
      })
    }
  }

  const handleMarkDone = async () => {
    if (!task) return
    // Open states must pass through in_progress before completed.
    const states: CorrectionTaskStatus[] =
      task.status === 'in_progress' ? ['completed'] : ['in_progress', 'completed']
    await runTransitions(states)
  }

  // The mirrored system reply arrives asynchronously; refetch to pick it up.
  const refetchThread = () =>
    queryClient.invalidateQueries({ queryKey: feedbackKeys.detail(feedback.id) })

  const handleConfirm = async () => {
    await runTransitions(['confirmed'])
    refetchThread()
  }

  const handleReturn = async () => {
    await runTransitions(['returned_for_revision'], returnComment.trim() || undefined)
    setReturnComment('')
    setReturnOpen(false)
    refetchThread()
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-dark-500 font-medium">
            {t(
              `pages.training.feedback.types.${feedback.feedback_type}`,
              feedback.feedback_type.replace(/_/g, ' ')
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            {new Date(feedback.created_at).toLocaleString()}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOverdue ? (
            <span className="bg-error-50 text-error-700 rounded-full px-2 py-0.5 text-xs font-medium">
              {t('pages.training.feedback.overdue', 'Overdue')}
            </span>
          ) : null}
          {isCorrection && label ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_BADGE[label]}`}
            >
              {t(`pages.training.feedback.lifecycle.${label}`, label)}
            </span>
          ) : (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                feedback.status === 'completed'
                  ? 'bg-success-50 text-success-700'
                  : feedback.status === 'read'
                    ? 'bg-information-50 text-information-700'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {t(`pages.training.feedback.status.${feedback.status}`, feedback.status)}
            </span>
          )}
        </div>
      </header>

      {isCorrection && deadlineIso ? (
        <div
          className={`text-xs ${isOverdue ? 'text-error-600 font-medium' : 'text-muted-foreground'}`}
        >
          {t('pages.training.feedback.deadline', 'Deadline')}:{' '}
          {new Date(deadlineIso).toLocaleString()}
        </div>
      ) : null}

      <div className="bg-muted text-foreground rounded-md p-3 text-sm">
        {feedback.text}
        {feedback.timestamp_ms != null ? (
          <div className="text-muted-foreground mt-1 font-mono text-xs">
            {formatTs(feedback.timestamp_ms)}
          </div>
        ) : null}
      </div>

      {feedback.replies.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {feedback.replies.map((reply) => (
            <li
              key={reply.id}
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                reply.author_role === viewerRole
                  ? 'bg-primary-50 text-primary-900 self-end'
                  : 'bg-muted text-foreground self-start'
              }`}
            >
              <div className="text-muted-foreground text-xs">
                {t(`pages.training.feedback.role.${reply.author_role}`, reply.author_role)} ·{' '}
                {new Date(reply.created_at).toLocaleString()}
              </div>
              <div>{reply.text}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-muted-foreground text-xs">
          {t('pages.training.feedback.threadEmpty', 'No replies yet.')}
        </div>
      )}

      {returnOpen ? (
        <div className="border-error-200 bg-error-50 flex flex-col gap-2 rounded-md border p-2">
          <label className="text-error-700 text-xs font-medium">
            {t('pages.training.feedback.returnReason', 'Reason for revision')}
          </label>
          <textarea
            rows={2}
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            className="border-error-200 w-full rounded-md border px-2 py-1 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="cancel"
              size="sm"
              onClick={() => setReturnOpen(false)}
              className="rounded-full"
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReturn}
              disabled={transitionMutation.isPending}
              className="rounded-full"
            >
              {t('pages.training.feedback.returnConfirm', 'Return for revision')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <textarea
          rows={2}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={t('pages.training.feedback.replyPlaceholder', 'Write a reply…')}
          className="border-border w-full rounded-md border px-2 py-1 text-sm"
        />
        <div className="flex flex-wrap justify-end gap-2">
          {canMarkRead ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markReadMutation.mutate(feedback.id)}
              disabled={markReadMutation.isPending}
              className="rounded-full"
            >
              {t('pages.training.feedback.markRead', 'Mark read')}
            </Button>
          ) : null}
          {canMarkDone ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkDone}
              disabled={transitionMutation.isPending}
              className="rounded-full"
            >
              {t('pages.training.feedback.markDone', 'Mark done')}
            </Button>
          ) : null}
          {canReview ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReturnOpen((o) => !o)}
                disabled={transitionMutation.isPending}
                className="rounded-full"
              >
                {t('pages.training.feedback.return', 'Return')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={transitionMutation.isPending}
                className="rounded-full"
              >
                {t('pages.training.feedback.confirm', 'Confirm')}
              </Button>
            </>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={handleReply}
            disabled={replyMutation.isPending || !replyText.trim()}
            className="rounded-full"
          >
            {t('pages.training.feedback.reply', 'Reply')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatTs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

type LifecycleLabel = 'open' | 'done' | 'confirmed' | 'returned'

function lifecycleLabel(status: CorrectionTaskStatus): LifecycleLabel {
  switch (status) {
    case 'completed':
      return 'done'
    case 'confirmed':
      return 'confirmed'
    case 'returned_for_revision':
      return 'returned'
    default:
      return 'open'
  }
}

const LIFECYCLE_BADGE: Record<LifecycleLabel, string> = {
  open: 'bg-warning-50 text-warning-700',
  done: 'bg-information-50 text-information-700',
  confirmed: 'bg-success-50 text-success-700',
  returned: 'bg-error-50 text-error-700',
}
