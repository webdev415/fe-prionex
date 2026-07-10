/**
 * Bulk payment reversal (storno) CSV upload page — KAN-334.
 *
 * The operator uploads a CSV with columns:
 *   payment_id, principal, interest, fine, penalty, commission
 *
 * Unlike the write-off bulk import (which posts the file to the backend),
 * this page parses the CSV client-side into JSON items and posts them to
 * ``POST /api/v1/payments/reversals/bulk``. The backend applies the three
 * file validations per row (Σ = payment amount · payment is a real verified
 * "Payment" · payment not already reversed) and returns a per-row result.
 *
 * i18n strings use inline English fallbacks (``t(key, 'Default')``) so the
 * page renders without adding keys to every locale.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import { useBulkReversal } from '@/features/reversals/hooks/useReversals'
import type {
  BulkReversalItem,
  BulkReversalResponse,
  BulkReversalResultItem,
} from '@/features/reversals/api/types'
import { detectDelimiter } from './bulkWriteoffCsv'

const CSV_TEMPLATE_HEADER = 'payment_id,principal,interest,fine,penalty,commission'
const CSV_TEMPLATE_EXAMPLE = '55001,1000,0,500,0,0'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

type ComponentKey = 'principal' | 'interest' | 'fine' | 'penalty' | 'commission'

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE_HEADER + '\n' + CSV_TEMPLATE_EXAMPLE + '\n'], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'reversal-bulk-template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Parse the CSV into bulk items. Returns null when the header is invalid. */
async function parseCsv(file: File): Promise<BulkReversalItem[] | null> {
  const text = await file.text()
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines.length === 0) return null

  const delimiter = detectDelimiter(lines[0] ?? '')
  const header = (lines[0] ?? '').split(delimiter).map((c) =>
    c
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, '')
  )

  const colPayment = header.indexOf('payment_id')
  if (colPayment < 0) return null
  const colIdx: Record<ComponentKey, number> = {
    principal: header.indexOf('principal'),
    interest: header.indexOf('interest'),
    fine: header.indexOf('fine'),
    penalty: header.indexOf('penalty'),
    commission: header.indexOf('commission'),
  }

  const items: BulkReversalItem[] = []
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    if (raw == null || raw.trim() === '') continue
    const cells = raw.split(delimiter).map((c) => c.trim())
    const paymentId = Number(cells[colPayment])
    if (!Number.isFinite(paymentId)) continue
    const amountFor = (k: ComponentKey) => {
      const idx = colIdx[k]
      const v = idx >= 0 ? (cells[idx] ?? '') : ''
      const n = Number(v.replace(',', '.'))
      return Number.isFinite(n) ? String(n) : '0'
    }
    items.push({
      payment_id: paymentId,
      principal: amountFor('principal'),
      interest: amountFor('interest'),
      fine: amountFor('fine'),
      penalty: amountFor('penalty'),
      commission: amountFor('commission'),
    })
  }
  return items
}

export function BulkReversalImportPage() {
  const { t } = useTranslation('common')

  const [result, setResult] = useState<BulkReversalResponse | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const bulk = useBulkReversal()

  const triggerUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error(
          t('pages.operations.bulkReversalImport.errors.onlyCsv', 'Only CSV files are supported.')
        )
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          t(
            'pages.operations.bulkReversalImport.errors.fileTooLarge',
            'File is too large (5 MB limit).'
          )
        )
        return
      }
      const items = await parseCsv(file)
      if (items == null) {
        toast.error(
          t(
            'pages.operations.bulkReversalImport.errors.badHeader',
            'CSV must have a payment_id column.'
          )
        )
        return
      }
      if (items.length === 0) {
        toast.error(t('pages.operations.bulkReversalImport.errors.noRows', 'No valid rows found.'))
        return
      }
      bulk.mutate({ items }, { onSuccess: (res) => setResult(res) })
    },
    [bulk, t]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void triggerUpload(file)
    },
    [triggerUpload]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void triggerUpload(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [triggerUpload]
  )

  type Row = BulkReversalResultItem & { id: number }
  const rows = useMemo<Row[]>(
    () => (result?.results ?? []).map((r) => ({ ...r, id: r.row_index })),
    [result]
  )

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: 'row',
        header: t('pages.operations.bulkReversalImport.rowNumber', 'Row'),
        align: 'right',
        render: (r) => r.row_index + 1,
      },
      {
        key: 'payment_id',
        header: t('pages.operations.bulkReversalImport.paymentId', 'Payment ID'),
        align: 'left',
      },
      {
        key: 'status',
        header: t('pages.operations.bulkReversalImport.status', 'Status'),
        align: 'left',
        render: (r) =>
          r.status === 'success' ? (
            <span className="text-success-700 bg-success-50 rounded px-2 py-0.5 text-xs font-medium">
              {t('pages.operations.bulkReversalImport.statusCreated', 'Created')}
            </span>
          ) : (
            <span className="text-error-700 bg-error-50 rounded px-2 py-0.5 text-xs font-medium">
              {t('pages.operations.bulkReversalImport.statusFailed', 'Failed')}
            </span>
          ),
      },
      {
        key: 'detail',
        header: t('pages.operations.bulkReversalImport.detail', 'Detail'),
        align: 'left',
        render: (r) =>
          r.status === 'success'
            ? (r.reversal_group_id?.slice(0, 8) ?? '—')
            : `${r.error_code ?? ''}: ${r.error ?? ''}`,
      },
    ],
    [t]
  )

  const p = 'pages.operations.bulkReversalImport'

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t(`${p}.title`, 'Bulk Reversal Import')}
        </h1>
        <Button
          variant="primary"
          onClick={downloadTemplate}
          leftIcon={<Icons.Download size={20} className="text-dark-500" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs font-medium sm:h-12 sm:w-auto"
        >
          {t(`${p}.downloadTemplate`, 'Download Template')}
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        {!result ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-dark-500 text-lg font-medium">
                {t(`${p}.sectionTitle`, 'Upload CSV File')}
              </h3>
              <p className="text-sm text-gray-600">
                {t(`${p}.descriptionIntro`, 'CSV columns:')}{' '}
                <code className="rounded bg-gray-100 px-1 text-xs">payment_id</code>,{' '}
                <code className="rounded bg-gray-100 px-1 text-xs">principal</code>,{' '}
                <code className="rounded bg-gray-100 px-1 text-xs">interest</code>,{' '}
                <code className="rounded bg-gray-100 px-1 text-xs">fine</code>,{' '}
                <code className="rounded bg-gray-100 px-1 text-xs">penalty</code>,{' '}
                <code className="rounded bg-gray-100 px-1 text-xs">commission</code>
              </p>
            </div>

            <div
              role="button"
              tabIndex={0}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  inputRef.current?.click()
                }
              }}
              className={`focus:ring-secondary-500 relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:outline-none ${
                dragActive
                  ? 'border-secondary-500 bg-secondary-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              } ${bulk.isPending ? 'pointer-events-none opacity-50' : ''}`}
            >
              {bulk.isPending ? (
                <div className="flex flex-col items-center gap-2">
                  <Icons.Spinner className="h-8 w-8" />
                  <p className="text-sm text-gray-600">{t(`${p}.validating`, 'Uploading…')}</p>
                </div>
              ) : (
                <>
                  <Icons.CloudDownload size={40} className="text-gray-400" />
                  <p className="text-dark-500 mt-2 text-sm">
                    <span className="text-secondary-700 font-medium">
                      {t(`${p}.clickToUpload`, 'Click to upload')}
                    </span>{' '}
                    {t(`${p}.orDragAndDrop`, 'or drag and drop')}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t(`${p}.constraints`, 'CSV up to 5 MB')}
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-dark-500 text-lg font-medium">
                {t(`${p}.resultsTitle`, 'Import results')}
              </h3>
              <Button
                variant="white-secondary"
                size="sm"
                onClick={() => setResult(null)}
                leftIcon={<Icons.CloudDownload size={16} />}
              >
                {t(`${p}.uploadAnother`, 'Upload another')}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label={t(`${p}.processed`, 'Processed')} value={result.processed} />
              <SummaryCard
                label={t(`${p}.succeeded`, 'Succeeded')}
                value={result.success}
                tone="success"
              />
              <SummaryCard
                label={t(`${p}.failed`, 'Failed')}
                value={result.failed}
                tone={result.failed > 0 ? 'error' : 'neutral'}
              />
            </div>
            <DataTable columns={columns} data={rows} className="w-full" />
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'success' | 'error'
}) {
  const toneClasses =
    tone === 'success'
      ? 'border-success-200 bg-success-50'
      : tone === 'error'
        ? 'border-error-200 bg-error-50'
        : 'border-gray-200 bg-white'
  return (
    <div className={`flex flex-col gap-0.5 rounded-lg border p-3 ${toneClasses}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-dark-500 text-lg font-semibold">{value}</span>
    </div>
  )
}

export default BulkReversalImportPage
