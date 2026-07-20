/**
 * Supervisor "Queue of Numbers" tab (KAN-379, design: supervisor-04/05).
 *
 * A KPI strip for the selected queue plus a two-step CSV upload:
 *   1. pick a file → client-side header check → server preview (dry-run)
 *   2. choose append/replace → Confirm Upload commits the validated batch.
 *
 * Reuses the ImportClients drag-drop + FileReader header-validation mechanics.
 *
 * NOTE (ticket vs design): the ticket §5 specifies STRICT validation (if any
 * record is invalid, nothing is imported), while the design shows invalid rows
 * alongside an enabled "Confirm Upload" and a "Will be added" (valid) count.
 * This follows the DESIGN — Confirm is enabled whenever will_be_added > 0 — and
 * the strict-vs-partial rule is a product decision to confirm (plan §7).
 */

import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  useConfirmQueueUpload,
  usePreviewQueueUpload,
  useDialerQueues,
  useQueueStatus,
  type QueueUploadMode,
} from '@/features/dialer'
import { getErrorMessage } from '@/lib/errors'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

/** Columns the dialer CSV must contain (comment is optional). */
const REQUIRED_COLUMNS = ['client_id', 'phone_number']

function validateCsvHeader(file: File): Promise<{ isValid: boolean; missingColumns: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? ''
      const headerLine = text.split('\n')[0]?.trim() ?? ''
      if (!headerLine) {
        resolve({ isValid: false, missingColumns: REQUIRED_COLUMNS })
        return
      }
      let delimiter = ','
      if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';'
      else if (headerLine.includes('\t')) delimiter = '\t'
      const headers = new Set(
        headerLine
          .split(delimiter)
          .map((h) => h.trim().replace(/\*+$/, '').toLowerCase())
          .filter(Boolean)
      )
      const missingColumns = REQUIRED_COLUMNS.filter((c) => !headers.has(c))
      resolve({ isValid: missingColumns.length === 0, missingColumns })
    }
    reader.onerror = () => resolve({ isValid: false, missingColumns: REQUIRED_COLUMNS })
    reader.readAsText(file.slice(0, 10240))
  })
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | undefined
  tone?: 'default' | 'error'
}) {
  return (
    <div className="border-border flex items-center gap-3 rounded-xl border bg-white px-4 py-3">
      <div className={cn('text-muted-foreground', tone === 'error' && 'text-error-500')}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <p className="text-foreground text-lg font-semibold">{(value ?? 0).toLocaleString()}</p>
      </div>
    </div>
  )
}

export function QueueNumbersTab() {
  const { t } = useTranslation('common')

  const { data: queues } = useDialerQueues()
  // User override; falls back to the first queue until one is picked.
  const [pickedQueueId, setPickedQueueId] = useState<number | null>(null)
  const selectedQueueId = pickedQueueId ?? queues?.[0]?.id ?? null

  const selectedQueue = useMemo(
    () => queues?.find((q) => q.id === selectedQueueId) ?? null,
    [queues, selectedQueueId]
  )

  const { data: status } = useQueueStatus(selectedQueueId)

  const previewMutation = usePreviewQueueUpload()
  const confirmMutation = useConfirmQueueUpload()

  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [headerError, setHeaderError] = useState<string[] | null>(null)
  const [mode, setMode] = useState<QueueUploadMode>('append')
  const [showInvalid, setShowInvalid] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const preview = previewMutation.data ?? null

  const resetUpload = () => {
    setFile(null)
    setHeaderError(null)
    setShowInvalid(false)
    setMode('append')
    previewMutation.reset()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (picked: File | null) => {
    previewMutation.reset()
    setHeaderError(null)
    setShowInvalid(false)
    if (!picked) {
      setFile(null)
      return
    }
    const isCsv = picked.type === 'text/csv' || picked.name.toLowerCase().endsWith('.csv')
    if (!isCsv) {
      setFile(picked)
      setHeaderError(REQUIRED_COLUMNS)
      return
    }
    setFile(picked)
    const { isValid, missingColumns } = await validateCsvHeader(picked)
    if (!isValid) {
      setHeaderError(missingColumns)
      return
    }
    if (selectedQueueId) {
      previewMutation.mutate({ queueId: selectedQueueId, file: picked })
    }
  }

  const handleConfirm = async () => {
    if (!selectedQueueId || !preview?.upload_token) return
    try {
      const res = await confirmMutation.mutateAsync({
        queueId: selectedQueueId,
        uploadToken: preview.upload_token,
        mode,
      })
      toast.success(
        t('dialer.numbers.uploaded', '{{count}} numbers added to the queue', {
          count: res.added_count,
        })
      )
      resetUpload()
    } catch {
      // onError toast handled by the mutation.
    }
  }

  if (!queues || queues.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border bg-white p-10 text-center text-sm">
        {t('dialer.numbers.noQueues', 'Create a queue first to upload numbers.')}
      </div>
    )
  }

  const previewError = previewMutation.isError ? getErrorMessage(previewMutation.error) : null
  const canConfirm = !!preview && (preview.will_be_added ?? 0) > 0 && !confirmMutation.isPending

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Icons.Phone size={20} />}
          label={t('dialer.numbers.inQueue', 'In Queue')}
          value={status?.in_queue}
        />
        <KpiCard
          icon={<Icons.CheckmarkBadge02 size={20} />}
          label={t('dialer.numbers.processed', 'Processed')}
          value={status?.processed}
        />
        <KpiCard
          icon={<Icons.CallEnd size={20} />}
          label={t('dialer.numbers.missedCall', 'Missed Call')}
          value={status?.missed_call}
        />
        <KpiCard
          icon={<Icons.Warning size={20} />}
          label={t('dialer.numbers.lineErrors', 'Line Errors')}
          value={status?.line_errors}
          tone="error"
        />
      </div>

      {/* Upload panel */}
      <div className="border-border rounded-xl border bg-white p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-foreground text-sm font-semibold">
            {t('dialer.numbers.uploadTitle', 'Upload Numbers')}
            {selectedQueue ? ` — ${selectedQueue.name}` : ''}
          </h3>
          <div className="w-full sm:w-64">
            <Select
              value={selectedQueueId ? String(selectedQueueId) : undefined}
              onValueChange={(v) => {
                setPickedQueueId(Number(v))
                resetUpload()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('dialer.numbers.selectQueue', 'Select a queue')} />
              </SelectTrigger>
              <SelectContent>
                {queues.map((q) => (
                  <SelectItem key={q.id} value={String(q.id)}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Drop zone */}
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragging ? 'border-primary-500 bg-muted' : 'border-border'
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleFile(e.dataTransfer.files[0] ?? null)
            }}
          >
            <Icons.CloudDownload size={40} strokeWidth={0.75} className="text-muted-foreground" />
            <p className="text-foreground text-sm font-medium">
              {t('dialer.numbers.dropHint', 'Drag CSV or click to select')}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('dialer.numbers.format', 'Format: client_id, phone_number, comment')}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={previewMutation.isPending}
            >
              {t('dialer.numbers.browse', 'Browse File')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          {/* Result panel */}
          <div className="border-border flex flex-col rounded-lg border p-4">
            {!file ? (
              <div className="text-muted-foreground flex flex-1 items-center justify-center text-center text-sm">
                {t('dialer.numbers.noFile', 'Select a CSV file to validate before uploading.')}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icons.Csv02 size={18} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground truncate text-sm font-medium">
                      {file.name}
                    </span>
                  </div>
                  {preview && (
                    <span className="bg-success-50 text-success-600 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                      {t('dialer.numbers.fileUploaded', 'File Uploaded')}
                    </span>
                  )}
                </div>

                {/* Header (client-side) validation error */}
                {headerError && (
                  <div className="border-error-500/40 bg-error-50 text-error-600 rounded-md border p-3 text-xs">
                    {t('dialer.numbers.missingColumns', 'Missing required columns:')}{' '}
                    <span className="font-medium">{headerError.join(', ')}</span>
                  </div>
                )}

                {/* Server preview error */}
                {previewError && !headerError && (
                  <div className="border-error-500/40 bg-error-50 text-error-600 rounded-md border p-3 text-xs">
                    {previewError}
                  </div>
                )}

                {previewMutation.isPending && (
                  <div className="text-muted-foreground py-4 text-center text-sm">
                    {t('dialer.numbers.validating', 'Validating…')}
                  </div>
                )}

                {/* Preview counts */}
                {preview && (
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t('dialer.numbers.totalRecords', 'Total Records')}
                      </span>
                      <span className="text-foreground font-medium">
                        {preview.total_records.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t('dialer.numbers.duplicatesRemoved', 'Duplicates Removed')}
                      </span>
                      <span className="font-medium text-amber-600">
                        {preview.duplicates_removed.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {t('dialer.numbers.invalidNumbers', 'Invalid Numbers')}
                        </span>
                        <span className="text-error-600 font-medium">
                          {preview.invalid_count.toLocaleString()}
                        </span>
                      </div>
                      {preview.invalid_count > 0 && preview.invalid_rows?.length ? (
                        <>
                          <button
                            type="button"
                            className="text-primary-600 mt-1 text-xs"
                            onClick={() => setShowInvalid((s) => !s)}
                          >
                            {showInvalid
                              ? t('dialer.numbers.hide', 'Hide')
                              : t('dialer.numbers.show', 'Show')}
                          </button>
                          {showInvalid && (
                            <div className="bg-error-50 text-error-600 mt-2 flex flex-col gap-1 rounded-md p-2 text-xs">
                              {preview.invalid_rows.map((r) => (
                                <div key={r.row}>
                                  {t('dialer.numbers.rowLabel', 'Row {{row}}', { row: r.row })}:{' '}
                                  {r.reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                    <div className="border-border mt-1 flex items-center justify-between border-t pt-2">
                      <span className="text-foreground font-medium">
                        {t('dialer.numbers.willBeAdded', 'Will be added')}
                      </span>
                      <span className="text-foreground font-semibold">
                        {preview.will_be_added.toLocaleString()}
                      </span>
                    </div>

                    {/* Append vs replace */}
                    <RadioGroup
                      className="mt-2"
                      value={mode}
                      onValueChange={(v) => setMode(v as QueueUploadMode)}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioItem value="append" />
                        {t('dialer.numbers.modeAppend', 'Add to existing queue')}
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <RadioItem value="replace" />
                        {t('dialer.numbers.modeReplace', 'Replace queue')}
                      </label>
                    </RadioGroup>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer: strict-validation note + actions */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Icons.Warning size={14} />
            {t(
              'dialer.numbers.strictNote',
              'Strict validation — if a record is invalid, it is reported before import.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={resetUpload} disabled={!file}>
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={!canConfirm}
              isLoading={confirmMutation.isPending}
            >
              {t('dialer.numbers.confirmUpload', 'Confirm Upload')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QueueNumbersTab
