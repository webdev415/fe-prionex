/**
 * RuleExecutionsModal — last N runs of a single rule.
 *
 * Backend: GET /api/v1/rules/{id}/executions (PR3 commit 3.10 BE)
 * Used from RuleFormModal "View executions" link.
 */

import { useTranslation } from 'react-i18next'
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

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString('uk-UA', {
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
  const status = entry.processing_status as ProcessingStatus
  const badge = STATUS_BADGE_COLORS[status] || 'bg-gray-100 text-gray-700'
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge}`}>
              {status}
            </span>
            {entry.matched && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                matched
              </span>
            )}
            {entry.source_event_type && (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                {entry.source_event_type}
              </span>
            )}
          </div>
          {entry.action_taken && (
            <div className="text-xs text-gray-700">action: {entry.action_taken}</div>
          )}
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
            ? t('pages.tags.rules.executions.titleNamed', `Executions of "${ruleName}"`)
            : t('pages.tags.rules.executions.title', 'Rule executions')
        }
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
          <div className="py-10 text-center text-sm text-gray-500">
            {t(
              'pages.tags.rules.executions.empty',
              'No executions yet — the rule has not fired since execution log was added.'
            )}
          </div>
        )}
        {!isLoading && !isError && data && data.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
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
