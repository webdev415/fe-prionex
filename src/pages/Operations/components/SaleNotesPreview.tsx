import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import type {
  SaleNotePreviewResponse,
  SaleNotePreviewRow,
  SaleNoteRowStatus,
} from '@/features/imports/types/saleNotes'

type RowWithId = SaleNotePreviewRow & { id: number }

interface Props {
  preview: SaleNotePreviewResponse
  onConfirm: () => void
  onCancel: () => void
  isExecuting: boolean
}

function StatusBadge({ status }: { status: SaleNoteRowStatus }) {
  const { t } = useTranslation('common')
  if (status === 'ready') {
    return (
      <span className="text-success-600 inline-flex items-center gap-1 text-xs font-medium">
        <Icons.Success size={14} />
        {t('pages.imports.saleNotes.preview.statuses.ready', 'Ready')}
      </span>
    )
  }
  return (
    <span className="text-error-500 inline-flex items-center gap-1 text-xs font-medium">
      <Icons.Error size={14} />
      {t('pages.imports.saleNotes.preview.statuses.error', 'Error')}
    </span>
  )
}

export function SaleNotesPreview({ preview, onConfirm, onCancel, isExecuting }: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.saleNotes.preview'

  const previewWithId: RowWithId[] = useMemo(
    () => preview.preview_rows.map((row) => ({ ...row, id: row.row_number })),
    [preview.preview_rows]
  )
  const errorWithId: RowWithId[] = useMemo(
    () => preview.error_rows.map((row) => ({ ...row, id: row.row_number })),
    [preview.error_rows]
  )

  // Base columns shared by both Ready and Errors tables.
  const baseColumns: Column<RowWithId>[] = useMemo(
    () => [
      {
        key: 'row_number',
        header: t(`${p}.columns.rowNumber`, 'Row'),
      },
      {
        key: 'client',
        header: t(`${p}.columns.client`, 'Client'),
        obscured: true,
        render: (row: RowWithId) => (
          <span className="text-sm">
            {row.client_id ?? '—'}
            {row.client_name ? ` — ${row.client_name}` : ''}
          </span>
        ),
      },
      {
        key: 'sale_date',
        header: t(`${p}.columns.saleDate`, 'Sale Date'),
        render: (row: RowWithId) => <span className="text-sm">{row.sale_date ?? '—'}</span>,
      },
      {
        key: 'comment_preview',
        header: t(`${p}.columns.commentPreview`, 'Comment'),
        render: (row: RowWithId) => (
          <span className="text-muted-foreground text-xs">{row.comment_preview ?? '—'}</span>
        ),
      },
      {
        key: 'status',
        header: t(`${p}.columns.status`, 'Status'),
        render: (row: RowWithId) => <StatusBadge status={row.status} />,
      },
    ],
    [t, p]
  )

  // Ready table omits the Note column (no error message on ready rows).
  const readyColumns = baseColumns

  // Errors table appends the Note column for the per-row error message.
  const errorColumns: Column<RowWithId>[] = useMemo(
    () => [
      ...baseColumns,
      {
        key: 'note',
        header: t(`${p}.columns.note`, 'Note'),
        render: (row: RowWithId) => (
          <span className="text-muted-foreground text-xs">{row.error ?? ''}</span>
        ),
      },
    ],
    [baseColumns, t, p]
  )

  const { summary } = preview

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-foreground text-lg font-medium">
          {t(`${p}.title`, 'Preview Bulk Sales Note Import')}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t(`${p}.fileInfo`, {
            defaultValue: 'File: {{filename}} · {{total}} records · Batch: {{batch}}',
            filename: preview.filename,
            total: summary.total,
            batch: preview.batch_id,
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border-success-200 bg-success-50 rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-success-700 text-2xl font-bold">{summary.ready}</p>
          <p className="text-muted-foreground text-xs">{t(`${p}.ready`, 'Ready')}</p>
        </div>
        <div className="border-error-200 bg-error-50 rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-error-700 text-2xl font-bold">{summary.errors}</p>
          <p className="text-muted-foreground text-xs">{t(`${p}.errors`, 'Errors')}</p>
        </div>
        <div className="border-border bg-card/50 rounded-xl border px-4 py-3 shadow-sm">
          <p className="text-foreground text-2xl font-bold">{summary.unique_clients}</p>
          <p className="text-muted-foreground text-xs">
            {t(`${p}.uniqueClients`, 'Unique Clients')}
          </p>
        </div>
      </div>

      {previewWithId.length > 0 && (
        <div>
          <h4 className="text-foreground mb-2 text-sm font-medium">
            {preview.preview_rows_truncated
              ? t(`${p}.readyShowingFirst`, {
                  defaultValue: 'Ready (showing first {{shown}} of {{total}})',
                  shown: previewWithId.length,
                  total: summary.ready,
                })
              : t(`${p}.readyCount`, {
                  defaultValue: 'Ready ({{count}} rows)',
                  count: previewWithId.length,
                })}
          </h4>
          <DataTable<RowWithId>
            columns={readyColumns}
            data={previewWithId}
            emptyMessage={t(`${p}.emptyReady`, 'No rows ready to insert.')}
          />
        </div>
      )}

      {errorWithId.length > 0 && (
        <div>
          <h4 className="text-error-600 mb-2 text-sm font-medium">
            {t(`${p}.errorsCount`, {
              defaultValue: 'Errors ({{count}})',
              count: errorWithId.length,
            })}
          </h4>
          <DataTable<RowWithId>
            columns={errorColumns}
            data={errorWithId}
            emptyMessage={t(`${p}.emptyErrors`, 'No errors.')}
          />
        </div>
      )}

      <div className="border-border flex items-center justify-end gap-3 border-t pt-4">
        <Button variant="cancel" size="md" onClick={onCancel} disabled={isExecuting}>
          {t(`${p}.cancel`, 'Cancel')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={() => onConfirm()}
          disabled={isExecuting || summary.ready === 0}
          isLoading={isExecuting}
        >
          {t(`${p}.confirm`, 'Confirm and Import')}
        </Button>
      </div>
    </div>
  )
}
