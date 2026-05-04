/**
 * ClientTagTraceModal — "Why this tag?" timeline view.
 *
 * Shows the unified history (assignment_log + rule_execution_log) for a
 * client's tags. Optionally narrowed to one tag_code via the `tagCode` prop.
 *
 * Backend: GET /api/v1/clients/{id}/tags/trace
 * (see api-prionex services/tag/app/routers/trace.py)
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useClientTagTrace } from '@/features/tags/hooks/useTagTrace'
import type { TraceTimelineEntry } from '@/features/tags/api/tagTraceApi'

interface ClientTagTraceModalProps {
  open: boolean
  clientId: number
  tagCode?: string
  tagName?: string
  onClose: () => void
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  action_done: 'bg-green-100 text-green-800',
  action_skipped: 'bg-gray-100 text-gray-700',
  matched: 'bg-blue-100 text-blue-800',
  not_matched: 'bg-gray-100 text-gray-500',
  error: 'bg-red-100 text-red-800',
  duplicate_skipped: 'bg-yellow-100 text-yellow-800',
  malformed: 'bg-red-100 text-red-800',
  received: 'bg-blue-50 text-blue-700',
  dispatched: 'bg-blue-50 text-blue-700',
}

const ACTION_BADGE_COLORS: Record<string, string> = {
  assigned: 'bg-green-100 text-green-800',
  removed: 'bg-orange-100 text-orange-800',
  expired: 'bg-gray-100 text-gray-600',
  mutex_replaced: 'bg-yellow-100 text-yellow-800',
  bulk_assigned: 'bg-green-50 text-green-700',
  bulk_removed: 'bg-orange-50 text-orange-700',
}

function formatTimestamp(value: string): string {
  try {
    const d = new Date(value)
    return d.toLocaleString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return value
  }
}

function TraceEntryRow({ entry }: { entry: TraceTimelineEntry }) {
  const { t } = useTranslation('common')

  const isAssignment = entry.source === 'assignment'
  const action = isAssignment
    ? entry.summary.split(' ')[0]
    : entry.processing_status || entry.summary

  const badgeColor = isAssignment
    ? ACTION_BADGE_COLORS[action] || 'bg-gray-100 text-gray-700'
    : STATUS_BADGE_COLORS[String(entry.processing_status)] || 'bg-gray-100 text-gray-700'

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}>
              {action}
            </span>
            {isAssignment && entry.actor_type && (
              <span className="text-[11px] text-gray-500">
                {t('pages.tags.trace.actor', 'actor')}: {entry.actor_type}
                {entry.actor_id ? ` #${entry.actor_id}` : ''}
              </span>
            )}
            {!isAssignment && entry.event_type && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                {entry.event_type}
              </span>
            )}
            {!isAssignment && entry.rule_name && (
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                {entry.rule_name}
              </span>
            )}
          </div>
          {entry.action_taken && (
            <div className="text-xs text-gray-700">
              <span className="text-gray-500">{t('pages.tags.trace.action', 'action')}:</span>{' '}
              {entry.action_taken}
            </div>
          )}
          {entry.reason && <div className="text-xs text-gray-600 italic">{entry.reason}</div>}
          {entry.error_message && (
            <div className="text-xs text-red-600">⚠️ {entry.error_message}</div>
          )}
          {entry.correlation_id && (
            <div className="font-mono text-[10px] text-gray-400">
              correlation_id: {entry.correlation_id}
            </div>
          )}
        </div>
        <div className="text-[11px] whitespace-nowrap text-gray-500">
          {formatTimestamp(entry.timestamp)}
        </div>
      </div>
    </div>
  )
}

export function ClientTagTraceModal({
  open,
  clientId,
  tagCode,
  tagName,
  onClose,
}: ClientTagTraceModalProps) {
  const { t } = useTranslation('common')
  const { data, isLoading, isError, error, refetch } = useClientTagTrace(clientId, {
    tagCode,
    enabled: open,
  })

  const title = tagName
    ? t('pages.tags.trace.titleSingle', `Why "${tagName}"?`, { tag: tagName })
    : t('pages.tags.trace.titleAll', 'Tag activity for this client')

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
            <Icons.Clock01 size={18} strokeWidth={2} className="text-indigo-700" />
          </div>
        }
        title={title}
      />

      <ModalContent>
        {isLoading && (
          <div className="py-12 text-center text-sm text-gray-500">
            {t('common.loading', 'Loading...')}
          </div>
        )}

        {isError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="mb-2 font-medium">
              {t('pages.tags.trace.loadFailed', 'Failed to load trace')}
            </p>
            <p className="text-xs">
              {(error as Error)?.message || t('common.unknownError', 'Unknown error')}
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}

        {!isLoading && !isError && data && data.entries.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-500">
            {tagCode
              ? t(
                  'pages.tags.trace.emptyForTag',
                  'No history yet for this tag — it may have been assigned manually or before tracing was enabled.'
                )
              : t('pages.tags.trace.empty', 'No tag activity recorded for this client.')}
          </div>
        )}

        {!isLoading && !isError && data && data.entries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {t(
                'pages.tags.trace.entriesCount',
                `${data.entries.length} event${data.entries.length === 1 ? '' : 's'} on the timeline (newest first)`,
                { count: data.entries.length }
              )}
            </p>
            <div className="space-y-2">
              {data.entries.map((entry, idx) => (
                <TraceEntryRow key={`${entry.source}-${entry.timestamp}-${idx}`} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
