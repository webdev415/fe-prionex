import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDate, formatDateTime } from '@/lib/formatters'
import type { TAInteraction } from '@/features/taInteractions/api/types'

type Row = TAInteraction & { id: number }

interface Props {
  data: TAInteraction[]
}

function formatAmount(value: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pickResultName(r: TAInteraction): string {
  // leaf_node_name is the pre-dropdown-migration fallback.
  return r.dropdown_value_name ?? r.leaf_node_name ?? '—'
}

export function TaHistoryTable({ data }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((i) => ({ ...i, id: i.id }))

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: t('pages.actionAnalysis.columns.dateTime', 'Date / Time'),
      render: (r) => <span className="text-sm text-gray-700">{formatDateTime(r.created_at)}</span>,
    },
    {
      key: 'clientId',
      header: t('pages.actionAnalysis.columns.clientId', 'Client ID'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-primary-600 text-sm font-medium hover:underline"
        >
          #{r.client_id}
        </Link>
      ),
    },
    {
      key: 'chain',
      header: t('pages.actionAnalysis.columns.chain', 'Chain'),
      render: (r) => <span className="text-sm text-gray-700">{r.chain_name ?? '—'}</span>,
    },
    {
      key: 'result',
      header: t('pages.actionAnalysis.columns.result', 'Result'),
      render: (r) => <span className="text-sm text-gray-700">{pickResultName(r)}</span>,
    },
    {
      key: 'internalDate',
      header: t('pages.actionAnalysis.columns.internalDate', 'Date (promise / callback)'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.promise_date ? formatDate(r.promise_date) : '—'}
        </span>
      ),
    },
    {
      key: 'promiseAmount',
      header: t('pages.actionAnalysis.columns.promiseAmount', 'Promise amount'),
      align: 'right',
      render: (r) => (
        <span className="text-sm text-gray-700">{formatAmount(r.promise_amount)}</span>
      ),
    },
    {
      key: 'responsibleAtCreation',
      header: t('pages.actionAnalysis.columns.responsibleAtCreation', 'Responsible at creation'),
      render: (r) => <span className="text-sm text-gray-700">{r.recorded_by_name ?? '—'}</span>,
    },
    {
      key: 'currentResponsible',
      header: t('pages.actionAnalysis.columns.currentResponsible', 'Current responsible'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.assigned_operator_name ??
            (r.assigned_operator_id ? `#${r.assigned_operator_id}` : '—')}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage={t(
        'pages.actionAnalysis.taHistoryEmpty',
        'No TA interactions match the current filters'
      )}
    />
  )
}
