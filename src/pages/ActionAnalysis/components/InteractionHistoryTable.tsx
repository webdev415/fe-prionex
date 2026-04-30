import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { formatDateTime } from '@/lib/formatters'
import { formatUkrainePhoneForDisplay } from '@/lib/phone'
import type {
  InteractionMonitoringItem,
  InteractionMonitoringSortBy,
  InteractionMonitoringSortDir,
} from '@/features/actionAnalysis'

type Row = InteractionMonitoringItem & { id: number }

interface Props {
  data: InteractionMonitoringItem[]
  sortBy: InteractionMonitoringSortBy
  sortDir: InteractionMonitoringSortDir
  onSortChange: (sortBy: InteractionMonitoringSortBy, sortDir: InteractionMonitoringSortDir) => void
}

function formatAmount(value: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InteractionHistoryTable({ data, sortBy, sortDir, onSortChange }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((i) => ({ ...i, id: i.id }))

  const sortConfig: SortConfig = {
    key: sortBy === 'promise_amount' ? 'promise_amount' : 'date',
    order: sortDir,
  }

  const handleSort = (key: string) => {
    if (key === 'date' || key === 'promise_amount') {
      const nextBy = key as InteractionMonitoringSortBy
      const nextDir: InteractionMonitoringSortDir =
        sortBy === nextBy && sortDir === 'desc' ? 'asc' : 'desc'
      onSortChange(nextBy, nextDir)
    }
  }

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: t('pages.actionAnalysis.columns.dateTime', 'Date / Time'),
      sortable: true,
      render: (r) => <span className="text-sm text-gray-700">{formatDateTime(r.interaction_date)}</span>,
    },
    {
      key: 'client',
      header: t('pages.actionAnalysis.columns.client', 'Client'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-sm text-primary-600 hover:underline"
        >
          {r.client_full_name ?? `#${r.client_id}`}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: t('pages.actionAnalysis.columns.phone', 'Phone'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.phone_used ? formatUkrainePhoneForDisplay(r.phone_used, r.phone_used) : '—'}
        </span>
      ),
    },
    {
      key: 'employee',
      header: t('pages.actionAnalysis.columns.employee', 'Employee'),
      render: (r) => <span className="text-sm text-gray-700">{r.user_name ?? '—'}</span>,
    },
    {
      key: 'contactType',
      header: t('pages.actionAnalysis.columns.contactType', 'Contact type'),
      render: (r) => <span className="text-sm text-gray-700">{r.contact_type_name ?? '—'}</span>,
    },
    {
      key: 'result',
      header: t('pages.actionAnalysis.columns.result', 'Result'),
      render: (r) =>
        r.result_code ? (
          <span className="text-sm text-gray-700">
            {t(`interactionResults.${r.result_code}`, { defaultValue: r.result_name ?? r.result_code })}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
    {
      key: 'promise_amount',
      header: t('pages.actionAnalysis.columns.promiseAmount', 'Promise amount'),
      sortable: true,
      align: 'right',
      render: (r) => <span className="text-sm text-gray-700">{formatAmount(r.promise_to_pay_amount)}</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      sortConfig={sortConfig}
      onSort={handleSort}
      emptyMessage={t(
        'pages.actionAnalysis.interactionsEmpty',
        'No interactions match the current filters'
      )}
    />
  )
}
