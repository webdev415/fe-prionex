import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TelephonyTypeBadge } from '@/components/ui/TelephonyTypeBadge'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/formatters'
import { formatUkrainePhoneForDisplay } from '@/lib/phone'
import {
  classifyCallOutcome,
  isNonAnsweredOutcome,
  OUTCOME_PALETTE_CLASSES,
} from '@/lib/callOutcome'
import type { CallMonitoringItem } from '@/features/training'

type Row = CallMonitoringItem & { id: string }

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Props {
  data: CallMonitoringItem[]
  onOpenCall: (call: CallMonitoringItem) => void
}

export function CallsTable({ data, onOpenCall }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((c) => ({ ...c, id: c.call_id }))

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: t('pages.training.columns.dateTime', 'Date / Time'),
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDateTime(r.initiated_at)}</span>
      ),
    },
    {
      key: 'duration',
      header: t('pages.training.columns.duration', 'Duration'),
      render: (r) => {
        const display = isNonAnsweredOutcome(r.outcome) ? null : r.talk_duration
        return <span className="text-sm text-gray-700">{formatDuration(display)}</span>
      },
    },
    {
      key: 'status',
      header: t('pages.training.columns.status', 'Status'),
      render: (r) => {
        const outcome = classifyCallOutcome(r.outcome ?? r.state, r.direction)
        const palette = OUTCOME_PALETTE_CLASSES[outcome.palette]
        return (
          <span
            className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', palette.pill)}
          >
            {outcome.labelKey ? t(outcome.labelKey, outcome.fallback) : outcome.fallback}
          </span>
        )
      },
    },
    {
      key: 'callType',
      header: t('pages.training.columns.callType', 'Call type'),
      render: (r) => {
        const isInbound = r.direction === 'inbound'
        return (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
            {isInbound ? (
              <Icons.CallIncoming04 size={14} className="text-information-500" strokeWidth={1.5} />
            ) : (
              <Icons.CallOutgoing04 size={14} className="text-secondary-500" strokeWidth={1.5} />
            )}
            {isInbound
              ? t('pages.training.callType.incoming', 'Incoming')
              : t('pages.training.callType.outgoing', 'Outgoing')}
          </span>
        )
      },
    },
    {
      key: 'telephonyType',
      header: t('pages.training.columns.telephonyType', 'Telephony type'),
      render: (r) => <TelephonyTypeBadge type={r.telephony_type} direction={r.direction} />,
    },
    {
      key: 'phone',
      header: t('pages.training.columns.phone', 'Phone'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {formatUkrainePhoneForDisplay(r.customer_number, r.customer_number)}
        </span>
      ),
    },
    {
      key: 'agent',
      header: t('pages.training.columns.agent', 'Employee'),
      render: (r) => <span className="text-sm text-gray-700">{r.agent_extension}</span>,
    },
    {
      key: 'client',
      header: t('pages.training.columns.client', 'Client'),
      render: (r) =>
        r.client_id ? (
          <Link
            to={`/dashboard/clients/${r.client_id}`}
            className="text-primary-600 text-sm hover:underline"
          >
            #{r.client_id}
          </Link>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
    {
      key: 'recording',
      header: t('pages.training.columns.recording', 'Recording'),
      align: 'center',
      render: (r) => {
        const enabled = !!r.has_recording
        return (
          <button
            type="button"
            disabled={!enabled}
            onClick={() => enabled && onOpenCall(r)}
            aria-label={t('pages.training.actions.playRecording', 'Play recording')}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              enabled
                ? 'text-secondary-700 hover:bg-secondary-50 cursor-pointer'
                : 'cursor-not-allowed text-gray-300'
            )}
          >
            <Icons.Voice size={18} strokeWidth={1.5} />
          </button>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage={t('pages.training.empty', 'No calls match the current filters')}
    />
  )
}
