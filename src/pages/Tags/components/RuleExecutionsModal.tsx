/**
 * RuleExecutionsModal — last N runs of a single rule.
 *
 * Backend: GET /api/v1/rules/{id}/executions (PR3 commit 3.10 BE)
 * Used from RuleFormModal "View executions" link.
 */

import { useTranslation } from 'react-i18next'
import i18n, { spanishLocaleOr } from '@/lib/i18n'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useRuleExecutions } from '@/features/tags/hooks/useTagTrace'
import type { ProcessingStatus, RuleExecutionEntry } from '@/features/tags/api/tagTraceApi'

interface RuleExecutionsModalProps {
  open: boolean
  ruleId: number
  ruleName?: string
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

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString(spanishLocaleOr(i18n.language, 'uk-UA'), {
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

function ExecutionRow({ entry }: { entry: RuleExecutionEntry }) {
  const { t } = useTranslation('common')
  const status = entry.processing_status as ProcessingStatus
  const badge = STATUS_BADGE_COLORS[status] || 'bg-muted text-foreground'
  return (
    <div className="border-border bg-card rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge}`}>
              {status}
            </span>
            {entry.matched && (
              <span className="bg-information-50 text-information-700 rounded px-1.5 py-0.5 text-[10px] font-medium">
                {t('pages.tags.rules.executions.matched', 'matched')}
              </span>
            )}
            {entry.source_event_type && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                {entry.source_event_type}
              </span>
            )}
          </div>
          {entry.action_taken && (
            <div className="text-foreground text-xs">
              {t('pages.tags.rules.executions.action', 'action:')} {entry.action_taken}
            </div>
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
          {formatTimestamp(entry.created_at)}
        </div>
      </div>
    </div>
  )
}

export function RuleExecutionsModal({ open, ruleId, ruleName, onClose }: RuleExecutionsModalProps) {
  const { t } = useTranslation('common')
  const { data, isLoading, isError, error, refetch } = useRuleExecutions(ruleId, {
    enabled: open,
  })

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
            <Icons.Clock01 size={18} strokeWidth={2} className="text-indigo-700" />
          </div>
        }
        title={
          ruleName
            ? t('pages.tags.rules.executions.titleNamed', `Executions of "${ruleName}"`, {
                name: ruleName,
              })
            : t('pages.tags.rules.executions.title', 'Rule executions')
        }
      />
      <ModalContent>
        {isLoading && (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {t('common.loading', 'Loading...')}
          </div>
        )}
        {isError && (
          <div className="border-error-200 bg-error-50 text-error-700 rounded-md border p-3 text-sm">
            <p className="mb-2 font-medium">
              {t('pages.tags.rules.executions.loadFailed', 'Failed to load executions')}
            </p>
            <p className="text-xs">
              {(error as Error)?.message || t('common.unknownError', 'Unknown error')}
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              {t('common.retry', 'Retry')}
            </Button>
          </div>
        )}
        {!isLoading && !isError && data && data.length === 0 && (
          <div className="text-muted-foreground py-10 text-center text-sm">
            {t(
              'pages.tags.rules.executions.empty',
              'No executions yet — the rule has not fired since execution log was added.'
            )}
          </div>
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              {t(
                'pages.tags.rules.executions.count',
                `${data.length} run${data.length === 1 ? '' : 's'} (newest first)`,
                { count: data.length }
              )}
            </p>
            <div className="space-y-2">
              {data.map((entry) => (
                <ExecutionRow key={entry.id} entry={entry} />
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
