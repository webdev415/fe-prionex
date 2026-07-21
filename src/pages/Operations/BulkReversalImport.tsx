/**
 * Bulk payment reversal (storno) CSV upload page — KAN-334.
 *
 * Three-step flow, matching the other bulk-import pages
 * (upload → preview/verify → results):
 *   1. 'upload'  — drag-and-drop / pick a CSV (payment_id, principal, interest,
 *                  fine, penalty, commission). Parsed client-side; NOT sent yet.
 *   2. 'preview' — verification table of the parsed rows with a per-row total,
 *                  plus "Import" and "Back" buttons. Nothing is committed until
 *                  the operator clicks Import.
 *   3. 'result'  — per-row Created / Failed outcomes + "Upload another".
 *
 * On Import the rows are posted to ``POST /api/v1/payments/reversals/bulk``,
 * which applies the three validations per row (Σ = payment amount · verified
 * "Payment" · not already reversed) and returns a per-row result.
 *
 * i18n strings use inline English fallbacks (``t(key, 'Default')``).
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
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
type PageState = 'upload' | 'preview' | 'result'

const COMPONENT_KEYS: ComponentKey[] = ['principal', 'interest', 'fine', 'penalty', 'commission']

function rowTotal(item: BulkReversalItem): number {
  return COMPONENT_KEYS.reduce((sum, k) => sum + Number(item[k] || 0), 0)
}

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
  const p = 'pages.operations.bulkReversalImport'

  const [state, setState] = useState<PageState>('upload')
  const [items, setItems] = useState<BulkReversalItem[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [result, setResult] = useState<BulkReversalResponse | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const bulk = useBulkReversal()

  // ------------------------------------------------------------------
  // Step 1 — upload + parse (no network)
  // ------------------------------------------------------------------

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error(t(`${p}.errors.onlyCsv`, 'Only CSV files are supported.'))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t(`${p}.errors.fileTooLarge`, 'File is too large (5 MB limit).'))
        return
      }
      const parsed = await parseCsv(file)
      if (parsed == null) {
        toast.error(t(`${p}.errors.badHeader`, 'CSV must have a payment_id column.'))
        return
      }
      if (parsed.length === 0) {
        toast.error(t(`${p}.errors.noRows`, 'No valid rows found.'))
        return
      }
      setItems(parsed)
      setFileName(file.name)
      setState('preview')
    },
    [t, p]
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
      if (file) void handleFileSelected(file)
    },
    [handleFileSelected]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void handleFileSelected(file)
      if (inputRef.current) inputRef.current.value = ''
    },
    [handleFileSelected]
  )

  // ------------------------------------------------------------------
  // Step 2 — verify → import
  // ------------------------------------------------------------------

  const handleImport = useCallback(() => {
    bulk.mutate(
      { items },
      {
        onSuccess: (res) => {
          setResult(res)
          setState('result')
        },
      }
    )
  }, [bulk, items])

  const handleBack = useCallback(() => {
    setItems([])
    setFileName('')
    setState('upload')
  }, [])

  const handleUploadAnother = useCallback(() => {
    setResult(null)
    setItems([])
    setFileName('')
    setState('upload')
  }, [])

  // ------------------------------------------------------------------
  // Columns
  // ------------------------------------------------------------------

  type PreviewRow = BulkReversalItem & { id: number; _row: number }
  const previewRows = useMemo<PreviewRow[]>(
    () => items.map((it, i) => ({ ...it, id: i, _row: i + 1 })),
    [items]
  )

  const previewColumns = useMemo<Column<PreviewRow>[]>(
    () => [
      { key: '_row', header: t(`${p}.rowNumber`, 'Row'), align: 'right' },
      { key: 'payment_id', header: t(`${p}.paymentId`, 'Payment ID'), align: 'left' },
      ...COMPONENT_KEYS.map(
        (k): Column<PreviewRow> => ({
          key: k,
          header: t(`${p}.component.${k}`, k[0].toUpperCase() + k.slice(1)),
          align: 'right',
          render: (r) => formatMoneyUAHTwoDecimals(Number(r[k] || 0)),
        })
      ),
      {
        key: 'total',
        header: t(`${p}.total`, 'Total'),
        align: 'right',
        render: (r) => formatMoneyUAHTwoDecimals(rowTotal(r)),
      },
    ],
    [t, p]
  )

  type ResRow = BulkReversalResultItem & { id: number }
  const resultRows = useMemo<ResRow[]>(
    () => (result?.results ?? []).map((r) => ({ ...r, id: r.row_index })),
    [result]
  )

  const resultColumns = useMemo<Column<ResRow>[]>(
    () => [
      {
        key: 'row',
        header: t(`${p}.rowNumber`, 'Row'),
        align: 'right',
        render: (r) => r.row_index + 1,
      },
      { key: 'payment_id', header: t(`${p}.paymentId`, 'Payment ID'), align: 'left' },
      {
        key: 'status',
        header: t(`${p}.status`, 'Status'),
        align: 'left',
        render: (r) =>
          r.status === 'success' ? (
            <span className="text-success-700 bg-success-50 rounded px-2 py-0.5 text-xs font-medium">
              {t(`${p}.statusCreated`, 'Created')}
            </span>
          ) : (
            <span className="text-error-700 bg-error-50 rounded px-2 py-0.5 text-xs font-medium">
              {t(`${p}.statusFailed`, 'Failed')}
            </span>
          ),
      },
      {
        key: 'detail',
        header: t(`${p}.detail`, 'Detail'),
        align: 'left',
        render: (r) =>
          r.status === 'success'
            ? (r.reversal_group_id?.slice(0, 8) ?? '—')
            : `${r.error_code ?? ''}: ${r.error ?? ''}`,
      },
    ],
    [t, p]
  )

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t(`${p}.title`, 'Bulk Reversal Import')}
        </h1>
        <Button
          variant="primary"
          onClick={downloadTemplate}
          leftIcon={<Icons.Download size={20} className="text-primary-foreground" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs font-medium sm:h-12 sm:w-auto"
        >
          {t(`${p}.downloadTemplate`, 'Download Template')}
        </Button>
      </div>

      <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
        {/* Step 1 — Upload */}
        {state === 'upload' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-foreground text-lg font-medium">
                {t(`${p}.sectionTitle`, 'Upload CSV File')}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t(`${p}.descriptionIntro`, 'CSV columns:')}{' '}
                <code className="bg-muted rounded px-1 text-xs">payment_id</code>,{' '}
                <code className="bg-muted rounded px-1 text-xs">principal</code>,{' '}
                <code className="bg-muted rounded px-1 text-xs">interest</code>,{' '}
                <code className="bg-muted rounded px-1 text-xs">fine</code>,{' '}
                <code className="bg-muted rounded px-1 text-xs">penalty</code>,{' '}
                <code className="bg-muted rounded px-1 text-xs">commission</code>
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
              className={`focus:ring-primary-500 focus:ring-offset-card relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                dragActive ? 'border-primary-500 bg-muted' : 'border-border hover:bg-muted/50'
              }`}
            >
              <Icons.CloudDownload size={40} className="text-muted-foreground" />
              <p className="text-foreground mt-2 text-sm">
                <span className="text-primary-600 font-medium">
                  {t(`${p}.clickToUpload`, 'Click to upload')}
                </span>{' '}
                {t(`${p}.orDragAndDrop`, 'or drag and drop')}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t(`${p}.constraints`, 'CSV up to 5 MB')}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Step 2 — Preview / verify */}
        {state === 'preview' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-foreground text-lg font-medium">
                {t(`${p}.previewTitle`, 'Review before importing')}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t(`${p}.previewSubtitlePrefix`, 'File')}{' '}
                <span className="text-foreground font-medium">{fileName}</span> —{' '}
                {t(`${p}.previewRowCount`, '{{count}} row(s) to import', {
                  count: items.length,
                })}
                . {t(`${p}.previewNote`, "Each row's total must equal the payment amount.")}
              </p>
            </div>

            <DataTable columns={previewColumns} data={previewRows} className="w-full" />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="white-secondary"
                onClick={handleBack}
                disabled={bulk.isPending}
                leftIcon={<Icons.ArrowLeft size={18} />}
              >
                {t(`${p}.back`, 'Back')}
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                isLoading={bulk.isPending}
                leftIcon={<Icons.FileImport size={18} />}
              >
                {t(`${p}.import`, 'Import')} ({items.length})
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Results */}
        {state === 'result' && result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-lg font-medium">
                {t(`${p}.resultsTitle`, 'Import results')}
              </h3>
              <Button
                variant="white-secondary"
                size="sm"
                onClick={handleUploadAnother}
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
            <DataTable columns={resultColumns} data={resultRows} className="w-full" />
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
      ? 'border-success-200 bg-success-50 text-success-700'
      : tone === 'error'
        ? 'border-error-200 bg-error-50 text-error-700'
        : 'border-border bg-card text-foreground'
  return (
    <div className={`flex flex-col gap-0.5 rounded-lg border p-3 ${toneClasses}`}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  )
}

export default BulkReversalImportPage
