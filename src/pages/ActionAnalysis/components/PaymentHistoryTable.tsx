import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatDateTime, formatDate } from '@/lib/formatters'
import type { PaymentMonitoringItem, PaymentMonitoringSort } from '@/features/actionAnalysis'

type Row = PaymentMonitoringItem & { id: number }

const SORT_OPTIONS: PaymentMonitoringSort[] = [
  'recorded_at_desc',
  'recorded_at_asc',
  'verified_at_desc',
  'verified_at_asc',
  'amount_desc',
  'amount_asc',
  'payment_date_desc',
  'payment_date_asc',
]

const METHOD_BADGE: Record<string, string> = {
  bank_transfer: 'bg-blue-100 text-blue-700',
  online_gateway: 'bg-purple-100 text-purple-700',
  cash: 'bg-amber-100 text-amber-700',
  card: 'bg-emerald-100 text-emerald-700',
  other: 'bg-gray-100 text-gray-700',
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  verified: 'bg-success-50 text-success-700',
  cancelled: 'bg-error-50 text-error-700',
}

interface Props {
  data: PaymentMonitoringItem[]
  userTimezone?: string | null
  sort: PaymentMonitoringSort
  onSortChange: (next: PaymentMonitoringSort) => void
}

function formatAmount(value: string): string {
  // Backend ships Decimal as string; render with grouping but no forced currency.
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PaymentHistoryTable({ data, userTimezone, sort, onSortChange }: Props) {
  const { t } = useTranslation('common')

  const rows: Row[] = data.map((p) => ({ ...p, id: p.id }))

  const columns: Column<Row>[] = [
    {
      key: 'loanNumber',
      header: t('pages.actionAnalysis.columns.loanNumber', 'Loan number'),
      render: (r) => <span className="text-sm text-gray-700">{r.debt_contract_number ?? '—'}</span>,
    },
    {
      key: 'loanSaleDate',
      header: t('pages.actionAnalysis.columns.loanSaleDate', 'Date of loan sale'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.purchase_date ? formatDate(r.purchase_date) : '—'}
        </span>
      ),
    },
    {
      key: 'paymentType',
      header: t('pages.actionAnalysis.columns.paymentType', 'Payment type'),
      render: (r) =>
        r.payment_type ? (
          <span className="text-sm text-gray-700">
            {t(`pages.actionAnalysis.filters.paymentTypes.${r.payment_type}`, r.payment_type)}
          </span>
        ) : (
          <span className="text-sm text-gray-500">—</span>
        ),
    },
    {
      key: 'paymentComment',
      header: t('pages.actionAnalysis.columns.paymentComment', 'Payment comment'),
      render: (r) =>
        r.payment_comment ? (
          <span className="text-sm text-gray-700">{r.payment_comment}</span>
        ) : (
          <span className="text-sm text-gray-500">—</span>
        ),
    },
    {
      key: 'operator',
      header: t('pages.actionAnalysis.columns.operator', 'Operator'),
      render: (r) => (
        <span className="text-sm text-gray-700">{r.assigned_user_full_name ?? '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: t('pages.actionAnalysis.columns.createdAt', 'Created at'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.recorded_at ? formatDateTime(r.recorded_at, userTimezone) : '—'}
        </span>
      ),
    },
    {
      key: 'confirmedAt',
      header: t('pages.actionAnalysis.columns.confirmedAt', 'Confirmed at'),
      render: (r) => (
        <span className="text-sm text-gray-700">
          {r.verified_at ? formatDateTime(r.verified_at, userTimezone) : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('pages.actionAnalysis.columns.amount', 'Amount'),
      render: (r) => (
        <span className="text-sm font-medium text-gray-800">{formatAmount(r.amount)}</span>
      ),
    },
    {
      key: 'paymentMethod',
      header: t('pages.actionAnalysis.columns.paymentMethod', 'Payment method'),
      render: (r) => {
        const cls = METHOD_BADGE[r.payment_method] ?? 'bg-gray-100 text-gray-600'
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {t(`pages.actionAnalysis.filters.paymentMethods.${r.payment_method}`, r.payment_method)}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('pages.actionAnalysis.columns.status', 'Status'),
      render: (r) => {
        const cls = STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {t(`pages.actionAnalysis.filters.paymentStatuses.${r.status}`, r.status)}
          </span>
        )
      },
    },
    {
      key: 'client',
      header: t('pages.actionAnalysis.columns.client', 'Client'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-primary-600 text-sm hover:underline"
        >
          #{r.client_id}
        </Link>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500">
          {t('pages.actionAnalysis.filters.sortBy', 'Sort by')}
        </span>
        <Select value={sort} onValueChange={(v) => onSortChange(v as PaymentMonitoringSort)}>
          <SelectTrigger
            aria-label={t('pages.actionAnalysis.filters.sortBy', 'Sort by')}
            className="h-9 w-64"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {t(`pages.actionAnalysis.filters.paymentSortOptions.${opt}`, opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={t(
          'pages.actionAnalysis.paymentHistoryEmpty',
          'No payments match the current filters'
        )}
      />
    </div>
  )
}
