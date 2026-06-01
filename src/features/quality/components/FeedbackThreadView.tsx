/**
 * FeedbackThreadView â€” single-feedback detail + threaded replies (KAN-410, Feature 2.3).
 *
 * Rendered today from the trainer feedback inbox (FeedbackSubTab) when a
 * row is clicked. The `viewerRole` prop decides which side-only actions
 * render â€” operators (when this view is later mounted in the trainer
 * workplace) get mark-read and, for correction_task, mark-completed; both
 * parties can post replies.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import {
  useFeedbackDetail,
  useMarkFeedbackCompleted,
  useMarkFeedbackRead,
  useReplyToFeedback,
} from '../hooks/useFeedback'

interface FeedbackThreadViewProps {
  feedbackId: number
  viewerRole: 'trainer' | 'operator'
}

export function FeedbackThreadView({ feedbackId, viewerRole }: FeedbackThreadViewProps) {
  const { t } = useTranslation('common')
  const detailQuery = useFeedbackDetail(feedbackId)
  const replyMutation = useReplyToFeedback()
  const markReadMutation = useMarkFeedbackRead()
  const markCompletedMutation = useMarkFeedbackCompleted()

  const [replyText, setReplyText] = useState('')

  if (detailQuery.isLoading) {
    return <div className="p-4 text-sm text-gray-400">{t('common.loading', 'Loadingâ€¦')}</div>
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="p-4 text-sm text-red-500">
        {t('pages.training.errors.loadFeedbackFailed', 'Failed to load feedback')}
      </div>
    )
  }

  const feedback = detailQuery.data
  const canMarkRead = viewerRole === 'operator' && feedback.status === 'unread'
  const canComplete =
    viewerRole === 'operator' &&
    feedback.feedback_type === 'correction_task' &&
    feedback.status !== 'completed'

  const handleReply = async () => {
    if (!replyText.trim()) return
    await replyMutation.mutateAsync({
      feedbackId: feedback.id,
      text: replyText.trim(),
    })
    setReplyText('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-dark-500 font-medium">
            {t(
              `pages.training.feedback.types.${feedback.feedback_type}`,
              feedback.feedback_type.replace(/_/g, ' ')
            )}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(feedback.created_at).toLocaleString()}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            feedback.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : feedback.status === 'read'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {t(`pages.training.feedback.status.${feedback.status}`, feedback.status)}
        </span>
      </header>

      <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
        {feedback.text}
        {feedback.timestamp_ms != null ? (
          <div className="mt-1 font-mono text-xs text-gray-500">
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
                  : 'self-start bg-gray-100 text-gray-700'
              }`}
            >
              <div className="text-xs text-gray-500">
                {t(`pages.training.feedback.role.${reply.author_role}`, reply.author_role)} Â·{' '}
                {new Date(reply.created_at).toLocaleString()}
              </div>
              <div>{reply.text}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-gray-400">
          {t('pages.training.feedback.threadEmpty', 'No replies yet.')}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          rows={2}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={t('pages.training.feedback.replyPlaceholder', 'Write a replyâ€¦')}
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
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
          {canComplete ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markCompletedMutation.mutate(feedback.id)}
              disabled={markCompletedMutation.isPending}
              className="rounded-full"
            >
              {t('pages.training.feedback.markComplete', 'Mark completed')}
            </Button>
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
