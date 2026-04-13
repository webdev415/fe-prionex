import { useMemo, useState } from 'react'
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

function StatusBadge({ status }: { status: PaymentRowStatus }) {
  const statusConfig: Record<
    PaymentRowStatus,
    { icon: typeof Icons.Success; color: string; label: string }
  > = {
    ready: { icon: Icons.Success, color: 'text-success-600', label: 'Ready' },
    warning: { icon: Icons.Warning, color: 'text-warning-500', label: 'Warning' },
    error: { icon: Icons.Error, color: 'text-error-500', label: 'Error' },
  }

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <StatusIcon size={14} />
      {cfg.label}
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

function usePreviewColumns(): Column<PreviewRowWithId>[] {
  return useMemo(
    () => [
      {
        key: 'row_number',
        header: 'Row',
      },
      {
        key: 'loan_number',
        header: 'Contract Number',
        render: (row: PreviewRowWithId) => (
          <span className="text-dark-500 font-medium">{row.loan_number}</span>
        ),
      },
      {
        key: 'tin',
        header: 'TIN',
        render: (row: PreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.tin || '—'}</span>
        ),
      },
      {
        key: 'client_name',
        header: 'Client',
        render: (row: PreviewRowWithId) => (
          <span className="text-gray-600">
            {row.client_name || (row.client_id ? `ID: ${row.client_id}` : '—')}
          </span>
        ),
      },
      {
        key: 'payment_amount',
        header: 'Amount',
        render: (row: PreviewRowWithId) => (
          <span className="text-dark-500 font-medium">{formatAmount(row.payment_amount)}</span>
        ),
      },
      {
        key: 'payment_date',
        header: 'Date',
      },
      {
        key: 'payment_method',
        header: 'Method',
        render: (row: PreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.payment_method}</span>
        ),
      },
      {
        key: 'has_pending_match',
        header: 'Type',
        render: (row: PreviewRowWithId) => {
          if (row.status === 'error') return <span className="text-xs text-gray-400">—</span>
          if (row.has_pending_match === true) {
            return (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                Pending
              </span>
            )
          }
          if (row.has_pending_match === false) {
            return (
              <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                New
              </span>
            )
          }
          return <span className="text-xs text-gray-400">—</span>
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (row: PreviewRowWithId) => <StatusBadge status={row.status} />,
      },
      {
        key: 'note',
        header: 'Note',
        render: (row: PreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.error || row.warning || ''}</span>
        ),
      },
    ],
    []
  )
}

export function PaymentImportPreview({ preview, onConfirm, onCancel, isExecuting }: Props) {
  const { summary } = preview
  const columns = usePreviewColumns()
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

  return (
    <div className="space-y-6">
      {/* File info */}
      <div>
        <h3 className="text-dark-500 text-lg font-medium">Preview Payment Verification</h3>
        <p className="text-sm text-gray-600">
          File: <span className="font-medium">{preview.filename}</span> &middot;{' '}
          {preview.total_records} records &middot; Batch: {preview.batch_id}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard
          label="Ready"
          value={summary.ready}
          color="bg-success-50 border-success-200 text-success-700"
        />
        <SummaryCard
          label="Warnings"
          value={summary.warnings}
          color="bg-warning-50 border-warning-200 text-warning-700"
        />
        <SummaryCard
          label="Invalid"
          value={summary.invalid}
          color="bg-error-50 border-error-200 text-error-700"
        />
        <SummaryCard
          label="Total Amount"
          value={formatAmount(summary.total_amount)}
          color="bg-information-50 border-information-200 text-information-700"
        />
        <SummaryCard
          label="Unique Contracts"
          value={summary.unique_contracts}
          color="bg-gray-50 border-gray-200 text-dark-500"
        />
      </div>

      {/* Preview table */}
      {previewRowsWithId.length > 0 && (
        <div>
          <h4 className="text-dark-500 mb-2 text-sm font-medium">
            Preview ({Math.min(previewRowsWithId.length, 100)} rows)
          </h4>
          <DataTable<PreviewRowWithId>
            columns={columns}
            data={previewRowsWithId}
            emptyMessage="No preview rows"
          />
        </div>
      )}

      {/* Errors table */}
      {errorRowsWithId.length > 0 && (
        <div>
          <h4 className="text-error-600 mb-2 text-sm font-medium">
            Errors ({errorRowsWithId.length} rows)
          </h4>
          <DataTable<PreviewRowWithId>
            columns={columns}
            data={errorRowsWithId}
            emptyMessage="No errors"
          />
        </div>
      )}

      {/* Options */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        {summary.warnings > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={skipWarnings}
              onChange={(e) => setSkipWarnings(e.target.checked)}
              className="rounded border-gray-300"
            />
            Skip rows with warnings ({summary.warnings} rows)
          </label>
        )}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional comment for this import..."
          maxLength={500}
          rows={2}
          className="focus:border-secondary-500 focus:ring-secondary-500 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3">
        <Button variant="cancel" size="md" onClick={onCancel} disabled={isExecuting}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onConfirm({ skipWarnings, comment })}
          disabled={isExecuting || actionableCount === 0}
          isLoading={isExecuting}
        >
          {isExecuting ? 'Starting...' : `Verify ${actionableCount} Payments`}
        </Button>
      </div>
    </div>
  )
}
