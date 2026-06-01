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
} from '@/features/training'

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
  // No filter or `any` â†’ fall back to whichever date is present, in the
  // order PM ranked them when describing the column.
  return row.promise_to_pay_date ?? row.next_action_date ?? row.follow_up_date ?? null
}

function formatAmount(value: string | null): string {
  if (!value) return 'â€”'
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
      header: t('pages.training.columns.dateTime', 'Date / Time'),
      sortable: true,
      render: (r) => (
        <span className="text-sm text-gray-700">{formatDateTime(r.interaction_date)}</span>
      ),
    },
    {
      key: 'clientId',
      header: t('pages.training.columns.clientId', 'Client ID'),
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
      header: t('pages.training.columns.client', 'Client'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-primary-600 text-sm hover:underline"
        >
          {r.client_full_name ?? 'â€”'}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: t('pages.training.columns.phone', 'Phone'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.phone_used ? formatUkrainePhoneForDisplay(r.phone_used, r.phone_used) : 'â€”'}
        </span>
      ),
    },
    {
      key: 'responsibleAtCreation',
      header: t('pages.training.columns.responsibleAtCreation', 'Responsible at creation'),
      render: (r) => <span className="text-sm text-gray-700">{r.user_name ?? 'â€”'}</span>,
    },
    {
      key: 'currentResponsible',
      header: t('pages.training.columns.currentResponsible', 'Current responsible'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.current_responsible_user_name ??
            (r.current_responsible_user_id ? `#${r.current_responsible_user_id}` : 'â€”')}
        </span>
      ),
    },
    {
      key: 'internalDate',
      header: t('pages.training.columns.internalDate', 'Date (promise / callback)'),
      render: (r) => {
        const value = pickInternalDate(r, internalDateType)
        return <span className="text-sm text-gray-700">{value ? formatDate(value) : 'â€”'}</span>
      },
    },
    {
      key: 'channel',
      header: t('pages.training.columns.channel', 'Channel'),
      render: (r) => <span className="text-sm text-gray-700">{r.channel ?? 'â€”'}</span>,
    },
    {
      key: 'contactType',
      header: t('pages.training.columns.contactType', 'Contact type'),
      render: (r) => <span className="text-sm text-gray-700">{r.contact_type_name ?? 'â€”'}</span>,
    },
    {
      key: 'result',
      header: t('pages.training.columns.result', 'Result'),
      render: (r) =>
        r.result_code ? (
          <span className="text-sm text-gray-700">
            {t(`interactionResults.${r.result_code}`, {
              defaultValue: r.result_name ?? r.result_code,
            })}
          </span>
        ) : (
          <span className="text-sm text-gray-400">â€”</span>
        ),
    },
    {
      key: 'promise_amount',
      header: t('pages.training.columns.promiseAmount', 'Promise amount'),
      sortable: true,
      align: 'right',
      // Promise *date* lives in the dedicated "Internal date" column now â€”
      // showing it again as a sub-line here was duplicate noise.
      render: (r) => (
        <span className="text-sm text-gray-700">{formatAmount(r.promise_to_pay_amount)}</span>
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
        'pages.training.interactionsEmpty',
        'No interactions match the current filters'
      )}
    />
  )
}
