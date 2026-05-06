import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { formatUkrainePhoneForDisplay } from '@/lib/phone'
import type {
  InteractionInternalDateType,
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
  /**
   * Active internal-date filter. Controls which of `promise_to_pay_date` /
   * `next_action_date` / `follow_up_date` is rendered in the "Internal date"
   * column. When unset (or `'any'`), the column shows the first non-null of
   * the three. KAN-409 follow-up.
   */
  internalDateType?: InteractionInternalDateType
}

function pickInternalDate(
  row: InteractionMonitoringItem,
  type: InteractionInternalDateType | undefined
): string | null {
  if (type === 'promise_to_pay') return row.promise_to_pay_date
  if (type === 'next_action') return row.next_action_date
  if (type === 'follow_up') return row.follow_up_date
  // No filter or `any` → fall back to whichever date is present, in the
  // order PM ranked them when describing the column.
  return row.promise_to_pay_date ?? row.next_action_date ?? row.follow_up_date ?? null
}

function formatAmount(value: string | null): string {
  if (!value) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InteractionHistoryTable({
  data,
  sortBy,
  sortDir,
  onSortChange,
  internalDateType,
}: Props) {
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
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDateTime(r.interaction_date)}</span>
      ),
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
      key: 'client',
      header: t('pages.actionAnalysis.columns.client', 'Client'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-primary-600 text-sm hover:underline"
        >
          {r.client_full_name ?? '—'}
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
      key: 'responsibleAtCreation',
      header: t('pages.actionAnalysis.columns.responsibleAtCreation', 'Responsible at creation'),
      render: (r) => <span className="text-sm text-gray-700">{r.user_name ?? '—'}</span>,
    },
    {
      key: 'currentResponsible',
      header: t('pages.actionAnalysis.columns.currentResponsible', 'Current responsible'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.current_responsible_user_name ??
            (r.current_responsible_user_id ? `#${r.current_responsible_user_id}` : '—')}
        </span>
      ),
    },
    {
      key: 'internalDate',
      header: t('pages.actionAnalysis.columns.internalDate', 'Date (promise / callback)'),
      render: (r) => {
        const value = pickInternalDate(r, internalDateType)
        return <span className="text-sm text-gray-700">{value ? formatDate(value) : '—'}</span>
      },
    },
    {
      key: 'channel',
      header: t('pages.actionAnalysis.columns.channel', 'Channel'),
      render: (r) => <span className="text-sm text-gray-700">{r.channel ?? '—'}</span>,
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
            {t(`interactionResults.${r.result_code}`, {
              defaultValue: r.result_name ?? r.result_code,
            })}
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
      render: (r) => (
        <div className="flex flex-col items-end gap-0.5 text-sm text-gray-700">
          <span>{formatAmount(r.promise_to_pay_amount)}</span>
          {r.promise_to_pay_date ? (
            <span className="text-xs text-gray-500">
              {t('pages.actionAnalysis.columns.promiseDate', 'Promise date')}:{' '}
              {formatDate(r.promise_to_pay_date)}
            </span>
          ) : null}
        </div>
      ),
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
