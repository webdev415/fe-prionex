import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type {
  OAPreviewResponse,
  OAPreviewRow,
  OARowStatus,
} from '@/features/imports/types/operatorAssignment'

interface Props {
  preview: OAPreviewResponse
  onConfirm: (reason?: string) => void
  onCancel: () => void
  isExecuting: boolean
}

type OAPreviewRowWithId = OAPreviewRow & { id: number }

function StatusBadge({ status }: { status: OARowStatus }) {
  const { t } = useTranslation('common')

  const statusConfig: Record<
    OARowStatus,
    { icon: typeof Icons.Success; color: string; labelKey: string }
  > = {
    ready: {
      icon: Icons.Success,
      color: 'text-success-600',
      labelKey: 'pages.imports.operatorAssignment.preview.statuses.ready',
    },
    no_change: {
      icon: Icons.Cancel01,
      color: 'text-gray-400',
      labelKey: 'pages.imports.operatorAssignment.preview.statuses.noChange',
    },
    warning: {
      icon: Icons.Warning,
      color: 'text-warning-500',
      labelKey: 'pages.imports.operatorAssignment.preview.statuses.warning',
    },
    error: {
      icon: Icons.Error,
      color: 'text-error-500',
      labelKey: 'pages.imports.operatorAssignment.preview.statuses.error',
    },
  }

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <StatusIcon size={14} />
      {t(cfg.labelKey)}
    </span>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}

function usePreviewColumns(): Column<OAPreviewRowWithId>[] {
  const { t } = useTranslation('common')
  const p = 'pages.imports.operatorAssignment.preview.columns'

  return useMemo(
    () => [
      {
        key: 'row_number',
        header: t(`${p}.rowNumber`),
      },
      {
        key: 'client',
        header: t(`${p}.client`),
        render: (row: OAPreviewRowWithId) => (
          <>
            <span className="text-dark-500 font-medium">
              {row.client_name || `ID: ${row.client_id}`}
            </span>
            <span className="ml-1 text-xs text-gray-400">({row.client_id})</span>
          </>
        ),
      },
      {
        key: 'current_operator',
        header: t(`${p}.currentOperator`),
        render: (row: OAPreviewRowWithId) => (
          <span className="text-gray-600">
            {row.current_operator_name ||
              (row.current_operator_id ? `ID: ${row.current_operator_id}` : '—')}
          </span>
        ),
      },
      {
        key: 'new_operator',
        header: t(`${p}.newOperator`),
        render: (row: OAPreviewRowWithId) => (
          <>
            <span className="text-dark-500 font-medium">
              {row.operator_name || `ID: ${row.operator_id}`}
            </span>
            <span className="ml-1 text-xs text-gray-400">({row.operator_id})</span>
          </>
        ),
      },
      {
        key: 'status',
        header: t(`${p}.status`),
        render: (row: OAPreviewRowWithId) => <StatusBadge status={row.status} />,
      },
      {
        key: 'error',
        header: t(`${p}.note`),
        render: (row: OAPreviewRowWithId) => (
          <span className="text-xs text-gray-600">{row.error || ''}</span>
        ),
      },
    ],
    [t]
  )
}

export function OperatorAssignmentPreview({ preview, onConfirm, onCancel, isExecuting }: Props) {
  const { t } = useTranslation('common')
  const { summary } = preview
  const columns = usePreviewColumns()
  const [reason, setReason] = useState('')

  const previewRowsWithId: OAPreviewRowWithId[] = useMemo(
    () => preview.preview_rows.map((row) => ({ ...row, id: row.row_number })),
    [preview.preview_rows]
  )

  const errorRowsWithId: OAPreviewRowWithId[] = useMemo(
    () => preview.errors.map((row) => ({ ...row, id: row.row_number })),
    [preview.errors]
  )

  return (
    <div className="space-y-6">
      {/* File info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-dark-500 text-lg font-medium">
            {t('pages.imports.operatorAssignment.preview.title')}
          </h3>
          <p className="text-sm text-gray-600">
            {t('pages.imports.operatorAssignment.preview.fileInfo', {
              filename: preview.filename,
              totalRecords: preview.total_records,
              batchId: preview.batch_id,
            })}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard
          label={t('pages.imports.operatorAssignment.preview.readyToAssign')}
          value={summary.ready}
          color="bg-success-50 border-success-200 text-success-700"
        />
        <SummaryCard
          label={t('pages.imports.operatorAssignment.preview.noChange')}
          value={summary.no_change}
          color="bg-gray-50 border-gray-200 text-dark-500"
        />
        <SummaryCard
          label={t('pages.imports.operatorAssignment.preview.invalid')}
          value={summary.invalid}
          color="bg-error-50 border-error-200 text-error-700"
        />
        <SummaryCard
          label={t('pages.imports.operatorAssignment.preview.uniqueOperators')}
          value={summary.unique_operators}
          color="bg-information-50 border-information-200 text-information-700"
        />
      </div>

      {/* Preview table */}
      {previewRowsWithId.length > 0 && (
        <div>
          <h4 className="text-dark-500 mb-2 text-sm font-medium">
            {t('pages.imports.operatorAssignment.preview.previewRows', {
              count: Math.min(previewRowsWithId.length, 50),
            })}
          </h4>
          <DataTable<OAPreviewRowWithId>
            columns={columns}
            data={previewRowsWithId}
            emptyMessage={t('pages.imports.operatorAssignment.preview.emptyPreview')}
          />
        </div>
      )}

      {/* Errors table */}
      {errorRowsWithId.length > 0 && (
        <div>
          <h4 className="text-error-600 mb-2 text-sm font-medium">
            {t('pages.imports.operatorAssignment.preview.errors', {
              count: errorRowsWithId.length,
            })}
          </h4>
          <DataTable<OAPreviewRowWithId>
            columns={columns}
            data={errorRowsWithId}
            emptyMessage={t('pages.imports.operatorAssignment.preview.emptyErrors')}
          />
        </div>
      )}

      {/* Assignment reason */}
      <div>
        <label className="text-dark-500 mb-1 block text-sm font-medium">
          {t('pages.imports.operatorAssignment.preview.assignmentReason')}
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('pages.imports.operatorAssignment.preview.assignmentReasonPlaceholder')}
          disabled={isExecuting}
          className="text-dark-500 focus:border-secondary-500 focus:ring-secondary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:ring-1"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
        <Button variant="cancel" size="md" onClick={onCancel} disabled={isExecuting}>
          {t('pages.imports.operatorAssignment.preview.cancel')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onConfirm(reason || undefined)}
          disabled={isExecuting || summary.ready === 0}
          isLoading={isExecuting}
        >
          {isExecuting
            ? t('pages.imports.operatorAssignment.preview.starting')
            : t('pages.imports.operatorAssignment.preview.confirm', { count: summary.ready })}
        </Button>
      </div>
    </div>
  )
}
