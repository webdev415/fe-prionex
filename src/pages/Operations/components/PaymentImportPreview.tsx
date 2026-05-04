import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type {
  PaymentImportPreviewResponse,
  PaymentPreviewRow,
  PaymentRowStatus,
} from '@/features/imports/types/paymentImport'

interface Props {
  preview: PaymentImportPreviewResponse
  onConfirm: (options: { skipWarnings: boolean; comment: string }) => void
  onCancel: () => void
  isExecuting: boolean
}

type PreviewRowWithId = PaymentPreviewRow & { id: number }

function StatusBadge({
  status,
  labels,
}: {
  status: PaymentRowStatus
  labels: Record<PaymentRowStatus, string>
}) {
  const statusConfig: Record<PaymentRowStatus, { icon: typeof Icons.Success; color: string }> = {
    ready: { icon: Icons.Success, color: 'text-success-600' },
    warning: { icon: Icons.Warning, color: 'text-warning-500' },
    error: { icon: Icons.Error, color: 'text-error-500' },
  }

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <StatusIcon size={14} />
      {labels[status]}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function usePaymentPreviewColumns(t: TFunction<'common'>): Column<PreviewRowWithId>[] {
  const c = 'pages.imports.bulkPaymentVerification.preview.columns'
  const p = 'pages.imports.bulkPaymentVerification.preview'
  return useMemo(() => {
    const rowStatusLabels: Record<PaymentRowStatus, string> = {
      ready: t(`${p}.rowStatus.ready`),
      warning: t(`${p}.rowStatus.warning`),
      error: t(`${p}.rowStatus.error`),
    }
    const rowTypeLabels = {
      pending: t(`${p}.rowType.pending`),
      new: t(`${p}.rowType.new`),
    }
    return [
      {
        key: 'row_number',
        header: t(`${c}.row`),
      },
      {
        key: 'loan_number',
        header: t(`${c}.contractNumber`),
        render: (row: PreviewRowWithId) => (
          <span className="text-dark-500 font-medium">{row.loan_number}</span>
        ),
      },
      {
        key: 'tin',
        header: t(`${c}.tin`),
        render: (row: PreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.tin || '—'}</span>
        ),
      },
      {
        key: 'client_name',
        header: t(`${c}.client`),
        render: (row: PreviewRowWithId) => (
          <span className="text-gray-600">
            {row.client_name || (row.client_id ? `ID: ${row.client_id}` : '—')}
          </span>
        ),
      },
      {
        key: 'payment_amount',
        header: t(`${c}.amount`),
        render: (row: PreviewRowWithId) => (
          <span className="text-dark-500 font-medium">{formatAmount(row.payment_amount)}</span>
        ),
      },
      {
        key: 'payment_date',
        header: t(`${c}.date`),
      },
      {
        key: 'payment_method',
        header: t(`${c}.method`),
        render: (row: PreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.payment_method}</span>
        ),
      },
      {
        key: 'has_pending_match',
        header: t(`${c}.type`),
        render: (row: PreviewRowWithId) => {
          if (row.status === 'error') return <span className="text-xs text-gray-400">—</span>
          if (row.has_pending_match === true) {
            return (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {rowTypeLabels.pending}
              </span>
            )
          }
          if (row.has_pending_match === false) {
            return (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                {rowTypeLabels.new}
              </span>
            )
          }
          return <span className="text-xs text-gray-400">—</span>
        },
      },
      {
        key: 'status',
        header: t(`${c}.status`),
        render: (row: PreviewRowWithId) => (
          <StatusBadge status={row.status} labels={rowStatusLabels} />
        ),
      },
      {
        key: 'note',
        header: t(`${c}.note`),
        render: (row: PreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.error || row.warning || ''}</span>
        ),
      },
    ]
  }, [t])
}

export function PaymentImportPreview({ preview, onConfirm, onCancel, isExecuting }: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.bulkPaymentVerification.preview'
  const { summary } = preview

  const columns = usePaymentPreviewColumns(t)
  const [skipWarnings, setSkipWarnings] = useState(false)
  const [comment, setComment] = useState('')

  const previewRowsWithId: PreviewRowWithId[] = useMemo(
    () => preview.preview_rows.map((row) => ({ ...row, id: row.row_number })),
    [preview.preview_rows]
  )

  const errorRowsWithId: PreviewRowWithId[] = useMemo(
    () => preview.errors.map((row) => ({ ...row, id: row.row_number })),
    [preview.errors]
  )

  const actionableCount = summary.ready + summary.warnings
  const previewShown = Math.min(previewRowsWithId.length, 100)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-dark-500 text-lg font-medium">{t(`${p}.title`)}</h3>
        <p className="text-sm text-gray-600">
          {t(`${p}.fileInfo`, {
            filename: preview.filename,
            totalRecords: preview.total_records,
            batchId: preview.batch_id,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard
          label={t(`${p}.summary.ready`)}
          value={summary.ready}
          color="bg-success-50 border-success-200 text-success-700"
        />
        <SummaryCard
          label={t(`${p}.summary.warnings`)}
          value={summary.warnings}
          color="bg-warning-50 border-warning-200 text-warning-700"
        />
        <SummaryCard
          label={t(`${p}.summary.invalid`)}
          value={summary.invalid}
          color="bg-error-50 border-error-200 text-error-700"
        />
        <SummaryCard
          label={t(`${p}.summary.totalAmount`)}
          value={formatAmount(summary.total_amount)}
          color="bg-information-50 border-information-200 text-information-700"
        />
        <SummaryCard
          label={t(`${p}.summary.uniqueContracts`)}
          value={summary.unique_contracts}
          color="bg-gray-50 border-gray-200 text-dark-500"
        />
      </div>

      {previewRowsWithId.length > 0 && (
        <div>
          <h4 className="text-dark-500 mb-2 text-sm font-medium">
            {t(`${p}.previewTableTitle`, { count: previewShown })}
          </h4>
          <DataTable<PreviewRowWithId>
            columns={columns}
            data={previewRowsWithId}
            emptyMessage={t(`${p}.emptyPreview`)}
          />
        </div>
      )}

      {errorRowsWithId.length > 0 && (
        <div>
          <h4 className="text-error-600 mb-2 text-sm font-medium">
            {t(`${p}.errorsTableTitle`, { count: errorRowsWithId.length })}
          </h4>
          <DataTable<PreviewRowWithId>
            columns={columns}
            data={errorRowsWithId}
            emptyMessage={t(`${p}.emptyErrors`)}
          />
        </div>
      )}

      <div className="space-y-3 border-t border-gray-200 pt-4">
        {summary.warnings > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={skipWarnings}
              onChange={(e) => setSkipWarnings(e.target.checked)}
              className="rounded border-gray-300"
            />
            {t(`${p}.skipWarnings`, { count: summary.warnings })}
          </label>
        )}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t(`${p}.commentPlaceholder`)}
          maxLength={500}
          rows={2}
          className="focus:border-secondary-500 focus:ring-secondary-500 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3">
        <Button variant="cancel" size="md" onClick={onCancel} disabled={isExecuting}>
          {t(`${p}.cancel`)}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onConfirm({ skipWarnings, comment })}
          disabled={isExecuting || actionableCount === 0}
          isLoading={isExecuting}
        >
          {isExecuting ? t(`${p}.starting`) : t(`${p}.verifyPayments`, { count: actionableCount })}
        </Button>
      </div>
    </div>
  )
}
