/**
 * Bulk write-off CSV upload page (KAN-245 follow-up).
 *
 * Layout mirrors BulkPaymentVerification — outer card + drag-and-drop
 * upload zone that auto-uploads on file selection (no separate Upload
 * button). After upload, the per-row results render in place of the
 * dropzone; an "Upload another" button resets the state.
 *
 * The results table joins the parsed CSV input (cancellation date +
 * per-component amounts) with the backend per-row response by
 * row_number, so each row shows the operator the same line they
 * uploaded plus the import outcome.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import { useBulkWriteoffUpload } from '@/features/writeoffs/hooks/useBulkWriteoffUpload'
import type {
  BulkWriteoffHeaderError,
  BulkWriteoffResponse,
  BulkWriteoffRow,
} from '@/features/writeoffs/api/bulkUploadTypes'

const CSV_TEMPLATE_HEADER = 'loan_id,cancellation_date,principal,interest,fine,penalty,commission'
const CSV_TEMPLATE_EXAMPLE = '1234,28.07.2026,500.00,250.00,0,0,0'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB — matches backend _MAX_UPLOAD_BYTES
const COMPONENT_KEYS = ['principal', 'interest', 'fine', 'penalty', 'commission'] as const

type ComponentKey = (typeof COMPONENT_KEYS)[number]

interface ParsedCsvRow {
  loan_id: string
  cancellation_date: string
  components: Record<ComponentKey, string>
}

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

/**
 * Lightweight CSV → Map<row_number, ParsedCsvRow>.
 *
 * Best-effort: matches columns by header name (case-insensitive, BOM-
 * stripped). Returns an empty map if the header doesn't look right —
 * the backend is the source of truth for header validation, this is
 * purely for display enrichment.
 */
async function parseCsvForDisplay(file: File): Promise<Map<number, ParsedCsvRow>> {
  const text = await file.text()
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines.length === 0) return new Map()

  const header = (lines[0] ?? '').split(',').map((c) =>
    c
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, '')
  )

  const idx = (name: string) => header.indexOf(name)
  const colLoan = idx('loan_id')
  const colDate = idx('cancellation_date')
  const colIdx: Record<ComponentKey, number> = {
    principal: idx('principal'),
    interest: idx('interest'),
    fine: idx('fine'),
    penalty: idx('penalty'),
    commission: idx('commission'),
  }
  if (colLoan < 0 || colDate < 0) return new Map()

  const map = new Map<number, ParsedCsvRow>()
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    if (raw == null || raw.trim() === '') continue
    const cells = raw.split(',').map((c) => c.trim())
    const components = COMPONENT_KEYS.reduce(
      (acc, k) => {
        acc[k] = colIdx[k] >= 0 ? (cells[colIdx[k]] ?? '') : ''
        return acc
      },
      {} as Record<ComponentKey, string>
    )
    map.set(i, {
      loan_id: cells[colLoan] ?? '',
      cancellation_date: cells[colDate] ?? '',
      components,
    })
  }
  return map
}

type EnrichedRow = BulkWriteoffRow & {
  id: number
  cancellation_date?: string
  components?: Record<ComponentKey, string>
}

export function BulkWriteoffImportPage() {
  const { t } = useTranslation('common')
  const p = 'pages.operations.bulkWriteoffImport'

  const [headerError, setHeaderError] = useState<BulkWriteoffHeaderError | null>(null)
  const [result, setResult] = useState<BulkWriteoffResponse | null>(null)
  const [parsedCsv, setParsedCsv] = useState<Map<number, ParsedCsvRow>>(new Map())
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useBulkWriteoffUpload({
    onHeaderError: (err) => {
      setHeaderError(err)
      setResult(null)
    },
  })

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        return t(`${p}.errors.onlyCsv`)
      }
      if (file.size > MAX_FILE_SIZE) {
        return t(`${p}.errors.fileTooLarge`, {
          size: (file.size / (1024 * 1024)).toFixed(1),
        })
      }
      return null
    },
    [t, p]
  )

  const triggerUpload = useCallback(
    async (file: File) => {
      const err = validateFile(file)
      if (err) {
        toast.error(err)
        return
      }
      setHeaderError(null)
      setResult(null)

      const parsed = await parseCsvForDisplay(file)
      setParsedCsv(parsed)

      upload.mutate(file, {
        onSuccess: (res) => setResult(res),
      })
    },
    [upload, validateFile]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
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

  const resetState = useCallback(() => {
    setHeaderError(null)
    setResult(null)
    setParsedCsv(new Map())
  }, [])

  const rowColumns = useMemo<Column<EnrichedRow>[]>(
    () => [
      {
        key: 'row',
        header: t(`${p}.rowNumber`),
        align: 'right',
      },
      {
        key: 'client_id',
        header: t(`${p}.clientId`),
        align: 'left',
        render: (r) => (r.client_id == null ? '—' : String(r.client_id)),
      },
      {
        key: 'loan_number',
        header: t(`${p}.loanNumber`),
        align: 'left',
        render: (r) => r.loan_number ?? (r.loan_id == null ? '—' : String(r.loan_id)),
      },
      {
        key: 'cancellation_date',
        header: t(`${p}.cancellationDate`),
        align: 'left',
        render: (r) => r.cancellation_date || '—',
      },
      {
        key: 'components',
        header: t(`${p}.components`),
        align: 'left',
        render: (r) => {
          const c = r.components
          if (!c) return '—'
          const parts = COMPONENT_KEYS.flatMap((k) => {
            const raw = (c[k] ?? '').trim()
            if (raw === '' || raw === '0' || Number(raw) === 0) return []
            return [`${t(`${p}.component.${k}`)}: ${raw}`]
          })
          return parts.length === 0 ? '—' : parts.join(', ')
        },
      },
      {
        key: 'status',
        header: t(`${p}.status`),
        align: 'left',
        render: (r) =>
          r.status === 'created' ? (
            <span className="text-success-700 bg-success-50 rounded px-2 py-0.5 text-xs font-medium">
              {t(`${p}.statusCreated`)}
            </span>
          ) : (
            <span className="text-error-700 bg-error-50 rounded px-2 py-0.5 text-xs font-medium">
              {t(`${p}.statusFailed`)}
            </span>
          ),
      },
      {
        key: 'detail',
        header: t(`${p}.detail`),
        align: 'left',
        render: (r) => {
          if (r.status === 'created') {
            const ids = r.entry_ids ?? []
            return ids.length === 0 ? '—' : `IDs: ${ids.join(', ')}`
          }
          const errs = r.errors ?? []
          return errs
            .map((e) => `${e.code}${e.field ? ` (${e.field})` : ''}: ${e.message ?? ''}`)
            .join('; ')
        },
      },
    ],
    [t, p]
  )

  const tableRows = useMemo<EnrichedRow[]>(() => {
    const rows = result?.rows ?? []
    return rows.map((r) => {
      const csv = parsedCsv.get(r.row)
      return {
        ...r,
        id: r.row,
        cancellation_date: csv?.cancellation_date,
        components: csv?.components,
      }
    })
  }, [result, parsedCsv])

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">{t(`${p}.title`)}</h1>

        <Button
          variant="primary"
          onClick={downloadTemplate}
          leftIcon={<Icons.Download size={20} className="text-dark-500" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t(`${p}.downloadTemplate`)}
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        {!result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-dark-500 text-lg font-medium">{t(`${p}.sectionTitle`)}</h3>
                <p className="text-sm text-gray-600">
                  {t(`${p}.descriptionIntro`)}{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">loan_id</code>,{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">cancellation_date</code>,{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">principal</code>,{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">interest</code>,{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">fine</code>,{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">penalty</code>,{' '}
                  <code className="rounded bg-gray-100 px-1 text-xs">commission</code>
                </p>
              </div>
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
              className={`focus:ring-secondary-500 relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                dragActive
                  ? 'border-secondary-500 bg-secondary-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              } ${upload.isPending ? 'pointer-events-none opacity-50' : ''}`}
            >
              {upload.isPending ? (
                <div className="flex flex-col items-center gap-2">
                  <Icons.Spinner className="h-8 w-8" />
                  <p className="text-sm text-gray-600">{t(`${p}.validating`)}</p>
                </div>
              ) : (
                <>
                  <Icons.CloudDownload size={40} className="text-gray-400" />
                  <p className="text-dark-500 mt-2 text-sm">
                    <span className="text-secondary-700 font-medium">
                      {t(`${p}.clickToUpload`)}
                    </span>{' '}
                    {t(`${p}.orDragAndDrop`)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{t(`${p}.constraints`)}</p>
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

            {headerError && (
              <div className="text-error-700 border-error-300 bg-error-50 flex flex-col gap-1 rounded border p-3 text-sm">
                <p className="font-medium">{t(`${p}.headerErrorTitle`)}</p>
                {headerError.missing.length > 0 && (
                  <p>
                    {t(`${p}.missingColumns`)}: {headerError.missing.join(', ')}
                  </p>
                )}
                {headerError.unrecognised.length > 0 && (
                  <p>
                    {t(`${p}.unrecognisedColumns`)}: {headerError.unrecognised.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-dark-500 text-lg font-medium">{t(`${p}.resultsTitle`)}</h3>
                <p className="text-xs text-gray-500">
                  {t(`${p}.batchId`)}: {result.bulk_batch_id}
                </p>
              </div>
              <Button
                variant="white-secondary"
                size="sm"
                onClick={resetState}
                leftIcon={<Icons.CloudDownload size={16} />}
              >
                {t(`${p}.uploadAnother`)}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard label={t(`${p}.rowsIn`)} value={result.summary.rows_in} />
              <SummaryCard
                label={t(`${p}.rowsSucceeded`)}
                value={result.summary.rows_succeeded}
                tone="success"
              />
              <SummaryCard
                label={t(`${p}.rowsFailed`)}
                value={result.summary.rows_failed}
                tone={result.summary.rows_failed > 0 ? 'error' : 'neutral'}
              />
              <SummaryCard
                label={t(`${p}.entriesCreated`)}
                value={result.summary.entries_created}
              />
            </div>

            <DataTable columns={rowColumns} data={tableRows} className="w-full" />
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

export default BulkWriteoffImportPage
