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
  action_done: 'bg-success-100 text-success-800',
  action_skipped: 'bg-muted text-foreground',
  matched: 'bg-information-100 text-information-800',
  not_matched: 'bg-muted text-muted-foreground',
  error: 'bg-error-100 text-error-800',
  duplicate_skipped: 'bg-warning-100 text-warning-800',
  malformed: 'bg-error-100 text-error-800',
  received: 'bg-information-50 text-information-700',
  dispatched: 'bg-information-50 text-information-700',
}

const ACTION_BADGE_COLORS: Record<string, string> = {
  assigned: 'bg-success-100 text-success-800',
  removed: 'bg-warning-100 text-warning-800',
  expired: 'bg-muted text-muted-foreground',
  mutex_replaced: 'bg-warning-100 text-warning-800',
  bulk_assigned: 'bg-success-50 text-success-700',
  bulk_removed: 'bg-warning-50 text-warning-700',
}

function formatTimestamp(value: string, locale: string): string {
  try {
    const d = new Date(value)
    return d.toLocaleString(locale, {
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
  const { t, i18n } = useTranslation('common')

  const isAssignment = entry.source === 'assignment'
  const action = isAssignment
    ? entry.action || entry.summary.split(' ')[0]
    : entry.processing_status || entry.summary

  const badgeColor = isAssignment
    ? ACTION_BADGE_COLORS[action] || 'bg-muted text-foreground'
    : STATUS_BADGE_COLORS[String(entry.processing_status)] || 'bg-muted text-foreground'

  const showOperatorDisplay =
    isAssignment && entry.actor_type === 'operator' && Boolean(entry.actor_display_name)

  return (
    <div className="border-border bg-card rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColor}`}>
              {action}
            </span>
            {entry.tag_name && (
              <span className="text-foreground text-[11px] font-medium">{entry.tag_name}</span>
            )}
            {showOperatorDisplay ? (
              <span className="text-muted-foreground text-[11px]">{entry.actor_display_name}</span>
            ) : (
              isAssignment &&
              entry.actor_type && (
                <span className="text-muted-foreground text-[11px]">
                  {t('pages.tags.trace.actor')}: {entry.actor_type}
                  {entry.actor_id ? ` #${entry.actor_id}` : ''}
                </span>
              )
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
            <div className="text-foreground text-xs">
              <span className="text-muted-foreground">{t('pages.tags.trace.action')}:</span>{' '}
              {entry.action_taken}
            </div>
          )}
          {entry.reason && (
            <div className="text-muted-foreground text-xs italic">{entry.reason}</div>
          )}
          {entry.error_message && (
            <div className="text-error-600 text-xs">⚠️ {entry.error_message}</div>
          )}
          {entry.correlation_id && (
            <div className="text-muted-foreground font-mono text-[10px]">
              correlation_id: {entry.correlation_id}
            </div>
          )}
        </div>
        <div className="text-muted-foreground text-[11px] whitespace-nowrap">
          {formatTimestamp(entry.timestamp, i18n.language || 'en-US')}
        </div>
      </div>
    </div>
  )
}

function TraceModalSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      <div className="bg-muted h-4 w-52 rounded" />
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="border-border bg-card rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="bg-muted h-5 w-28 rounded-full" />
            <div className="bg-muted h-3 w-32 rounded" />
          </div>
          <div className="space-y-2">
            <div className="bg-muted h-3 w-11/12 rounded" />
            <div className="bg-muted h-3 w-8/12 rounded" />
          </div>
        </div>
      ))}
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
    ? t('pages.tags.trace.titleSingle', { tag: tagName })
    : t('pages.tags.trace.titleAll')

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
          <div className="py-2">
            <TraceModalSkeleton />
          </div>
        )}

        {isError && (
          <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
            <p className="mb-2 font-medium">{t('pages.tags.trace.loadFailed')}</p>
            <p className="text-xs">{(error as Error)?.message || t('common.unknownError')}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !isError && data && data.entries.length === 0 && (
          <div className="text-muted-foreground py-10 text-center text-sm">
            {tagCode ? t('pages.tags.trace.emptyForTag') : t('pages.tags.trace.empty')}
          </div>
        )}

        {!isLoading && !isError && data && data.entries.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              {t('pages.tags.trace.entriesCount', { count: data.entries.length })}
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
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
