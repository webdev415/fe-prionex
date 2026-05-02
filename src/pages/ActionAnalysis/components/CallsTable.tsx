import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/formatters'
import { formatUkrainePhoneForDisplay } from '@/lib/phone'
import type { CallMonitoringItem } from '@/features/actionAnalysis'

type Row = CallMonitoringItem & { id: string }

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function isAnswered(c: CallMonitoringItem): boolean {
  return c.outcome === 'answered' || c.state === 'COMPLETED'
}

interface Props {
  data: CallMonitoringItem[]
  loading?: boolean
  onPlayRecording: (call: CallMonitoringItem) => void
}

export function CallsTable({ data, onPlayRecording }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((c) => ({ ...c, id: c.call_id }))

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: t('pages.actionAnalysis.columns.dateTime', 'Date / Time'),
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDateTime(r.initiated_at)}</span>
      ),
    },
    {
      key: 'duration',
      header: t('pages.actionAnalysis.columns.duration', 'Duration'),
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDuration(r.talk_duration)}</span>
      ),
    },
    {
      key: 'status',
      header: t('pages.actionAnalysis.columns.status', 'Status'),
      render: (r) => {
        const answered = isAnswered(r)
        return (
          <span
            className={
              answered
                ? 'bg-success-50 text-success-700 inline-flex rounded-full px-2 py-0.5 text-xs font-medium'
                : 'inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700'
            }
          >
            {answered
              ? t('pages.actionAnalysis.filters.statuses.answered', 'Answered')
              : t('pages.actionAnalysis.filters.statuses.notAnswered', 'Not answered')}
          </span>
        )
      },
    },
    {
      key: 'phone',
      header: t('pages.actionAnalysis.columns.phone', 'Phone'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {formatUkrainePhoneForDisplay(r.customer_number, r.customer_number)}
        </span>
      ),
    },
    {
      key: 'agent',
      header: t('pages.actionAnalysis.columns.agent', 'Employee'),
      render: (r) => <span className="text-sm text-gray-700">{r.agent_extension}</span>,
    },
    {
      key: 'client',
      header: t('pages.actionAnalysis.columns.client', 'Client'),
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
      header: t('pages.actionAnalysis.columns.recording', 'Recording'),
      align: 'center',
      render: (r) => (
        <Button
          variant="cancel"
          size="sm"
          disabled={!r.has_recording}
          onClick={() => onPlayRecording(r)}
          aria-label={t('pages.actionAnalysis.actions.playRecording', 'Play recording')}
        >
          <Icons.Voice size={16} className="text-gray-700" strokeWidth={1.5} />
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage={t('pages.actionAnalysis.empty', 'No calls match the current filters')}
    />
  )
}
