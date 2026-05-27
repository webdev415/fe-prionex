/**
 * Bulk write-off CSV upload page (KAN-245 follow-up).
 *
 * Routes at ``/dashboard/import/bulk-writeoff-import``. Gated on
 * ``bulk_writeoff_operations``. Single page:
 *
 *   1. File picker + Upload button.
 *   2. On 400 header-level error: red banner with missing /
 *      unrecognised columns.
 *   3. On 200: summary block + per-row table (status + errors).
 *
 * Per REQUIREMENTS §5.6 the backend always returns 200 with per-row
 * outcomes; the FE just renders what came back.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useBulkWriteoffUpload } from '@/features/writeoffs/hooks/useBulkWriteoffUpload'
import type {
  BulkWriteoffHeaderError,
  BulkWriteoffResponse,
  BulkWriteoffRow,
} from '@/features/writeoffs/api/bulkUploadTypes'

const CSV_TEMPLATE_HEADER = 'loan_id,cancellation_date,principal,interest,fine,penalty,commission'
const CSV_TEMPLATE_EXAMPLE = '1234,28.07.2026,500.00,250.00,0,0,0'

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE_HEADER + '\n' + CSV_TEMPLATE_EXAMPLE + '\n'], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'writeoff-bulk-template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function BulkWriteoffImportPage() {
  const { t } = useTranslation('common')

  const [file, setFile] = useState<File | null>(null)
  const [headerError, setHeaderError] = useState<BulkWriteoffHeaderError | null>(null)
  const [result, setResult] = useState<BulkWriteoffResponse | null>(null)

  const upload = useBulkWriteoffUpload({
    onHeaderError: (err) => {
      setHeaderError(err)
      setResult(null)
    },
  })

  const handleUpload = () => {
    if (!file) return
    setHeaderError(null)
    setResult(null)
    upload.mutate(file, {
      onSuccess: (res) => setResult(res),
    })
  }

  const rowColumns = useMemo<Column<BulkWriteoffRow>[]>(
    () => [
      {
        key: 'row',
        header: t('pages.operations.bulkWriteoffImport.rowNumber'),
        align: 'right',
      },
      {
        key: 'loan_id',
        header: t('pages.operations.bulkWriteoffImport.loanId'),
        align: 'left',
        render: (r) => (r.loan_id == null ? '—' : String(r.loan_id)),
      },
      {
        key: 'status',
        header: t('pages.operations.bulkWriteoffImport.status'),
        align: 'left',
        render: (r) =>
          r.status === 'created'
            ? t('pages.operations.bulkWriteoffImport.statusCreated')
            : t('pages.operations.bulkWriteoffImport.statusFailed'),
      },
      {
        key: 'detail',
        header: t('pages.operations.bulkWriteoffImport.detail'),
        align: 'left',
        render: (r) => {
          if (r.status === 'created') {
            return `IDs: ${(r.entry_ids ?? []).join(', ')}`
          }
          const errs = r.errors ?? []
          return errs
            .map((e) => `${e.code}${e.field ? ` (${e.field})` : ''}: ${e.message ?? ''}`)
            .join('; ')
        },
      },
    ],
    [t]
  )

  const tableRows = useMemo(() => (result?.rows ?? []).map((r) => ({ ...r, id: r.row })), [result])

  return (
    <div className="flex w-full flex-col gap-6 p-3 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-dark-500 text-xl font-semibold">
          {t('pages.operations.bulkWriteoffImport.title')}
        </h1>
        <p className="text-sm text-gray-600">{t('pages.operations.bulkWriteoffImport.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 rounded border border-gray-200 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button
              variant="primary"
              onClick={handleUpload}
              disabled={!file || upload.isPending}
              isLoading={upload.isPending}
            >
              {t('pages.operations.bulkWriteoffImport.upload')}
            </Button>
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            {t('pages.operations.bulkWriteoffImport.downloadTemplate')}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {t('pages.operations.bulkWriteoffImport.columnsHint', {
            columns: CSV_TEMPLATE_HEADER,
          })}
        </p>
      </div>

      {headerError && (
        <div className="text-error-700 border-error-300 bg-error-50 flex flex-col gap-1 rounded border p-3 text-sm">
          <p className="font-medium">{t('pages.operations.bulkWriteoffImport.headerErrorTitle')}</p>
          {headerError.missing.length > 0 && (
            <p>
              {t('pages.operations.bulkWriteoffImport.missingColumns')}:{' '}
              {headerError.missing.join(', ')}
            </p>
          )}
          {headerError.unrecognised.length > 0 && (
            <p>
              {t('pages.operations.bulkWriteoffImport.unrecognisedColumns')}:{' '}
              {headerError.unrecognised.join(', ')}
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard
              label={t('pages.operations.bulkWriteoffImport.rowsIn')}
              value={result.summary.rows_in}
            />
            <SummaryCard
              label={t('pages.operations.bulkWriteoffImport.rowsSucceeded')}
              value={result.summary.rows_succeeded}
            />
            <SummaryCard
              label={t('pages.operations.bulkWriteoffImport.rowsFailed')}
              value={result.summary.rows_failed}
            />
            <SummaryCard
              label={t('pages.operations.bulkWriteoffImport.entriesCreated')}
              value={result.summary.entries_created}
            />
          </div>
          <p className="text-xs text-gray-500">
            {t('pages.operations.bulkWriteoffImport.batchId')}: {result.bulk_batch_id}
          </p>
          <DataTable columns={rowColumns} data={tableRows} className="w-full" />
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-gray-200 p-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-dark-500 text-lg font-semibold">{value}</span>
    </div>
  )
}

export default BulkWriteoffImportPage
