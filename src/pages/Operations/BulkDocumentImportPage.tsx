/**
 * BulkDocumentImportPage
 *
 * Bulk upload of credit/client documents via a single ZIP archive, matched to
 * existing credits/clients within a selected factoring agreement. Gated by the
 * ``import_documents`` permission (route wrapped in PermissionRoute).
 *
 * Agreement + document-type dropdowns, an agreement info panel (agreement
 * number, who sold, purchase date), and a ZIP-only upload area that uploads the
 * archive in chunks (init -> chunk* -> complete) with a progress bar.
 */

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { useDocumentImportReadiness } from '@/features/documentImportRules'
import {
  documentImportApi,
  useDownloadExampleArchive,
  useUploadDocumentArchive,
} from '@/features/documentImport'
import { useFactoringAgreements } from '@/features/factoringAgreements'
import { useSellers } from '@/features/sellers'
import { DocumentImportProgress } from './components/DocumentImportProgress'
import { BulkJobBanner } from './components/BulkJobBanner'

export function BulkDocumentImportPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const { data: agreementsPage, isLoading: isLoadingAgreements } = useFactoringAgreements({
    page_size: 200,
  })
  // Readiness, not a type picker: the rules decide each file's type, and the
  // upload cannot start while a folder has no default to fall back to.
  const {
    data: readiness,
    isLoading: isLoadingReadiness,
    isError: readinessFailed,
    refetch: refetchReadiness,
  } = useDocumentImportReadiness()
  const downloadExample = useDownloadExampleArchive()
  const { uploadFile, cancelUpload, startImport, uploading, starting, progress } =
    useUploadDocumentArchive()

  const agreements = useMemo(() => agreementsPage?.items ?? [], [agreementsPage])

  const [agreementId, setAgreementId] = useState<string>('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedAgreement = useMemo(
    () => agreements.find((a) => String(a.id) === agreementId) ?? null,
    [agreements, agreementId]
  )

  // The agreement carries only seller_id; resolve it to the seller's name.
  const { data: sellersData } = useSellers({ is_active: true, limit: 100 })
  const sellerName = useMemo(
    () =>
      (sellersData?.sellers ?? []).find((s) => s.id === selectedAgreement?.seller_id)
        ?.seller_name ?? null,
    [sellersData, selectedAgreement]
  )

  // The ZIP is uploaded + staged on selection; Start Import only runs once the
  // upload has finished (uploadId set), an agreement is chosen, and the
  // project's type rules are complete — the backend refuses the start
  // otherwise, and a button that looks ready is worse than one that explains.
  const rulesReady = readiness?.ready ?? false
  // A readiness request that failed is not an answer. Telling the operator to
  // go and set defaults that may already be set sends them somewhere they have
  // no reason to be — and they often cannot open that screen anyway. When the
  // check itself is broken the page says so, leaves Start alone and lets the
  // backend refuse with its 409, which names the folders it is actually
  // missing. Only a readiness that came back and said "not ready" blocks here.
  const rulesBlockStart = !readinessFailed && !rulesReady
  const canSubmit =
    agreementId !== '' && uploadId !== null && !rulesBlockStart && !uploading && !starting

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error(t('pages.imports.documents.zipOnly', 'Only .zip archives are allowed.'))
      return
    }
    // Replace any previously staged upload so we don't orphan it on disk.
    if (uploadId) {
      documentImportApi.abortUpload(uploadId).catch(() => {})
      setUploadId(null)
    }
    setZipFile(file)
    try {
      const result = await uploadFile(file)
      setUploadId(result.upload_id)
    } catch {
      // upload failed (toast shown by the hook) — clear the selection
      setZipFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!uploadId || agreementId === '') return
    try {
      const result = await startImport(uploadId, Number(agreementId))
      // Hand off to the progress card, which polls the job to completion.
      setJobId(result.job_id)
    } catch (error) {
      // The hook toasts the message either way. A 409 means the rules changed
      // since this page loaded — an admin cleared a default — so re-read
      // readiness: the notice above and the button below must agree with the
      // answer that just refused the start.
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        void refetchReadiness()
      }
    }
  }

  const handleReset = () => {
    setJobId(null)
    setZipFile(null)
    setUploadId(null)
    setAgreementId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Discard a staged upload that finished but hasn't been started yet — deletes
  // the staged .zip.part + .meta.json on the server and clears the selection.
  const handleRemoveStaged = () => {
    if (uploadId) documentImportApi.abortUpload(uploadId).catch(() => {})
    setZipFile(null)
    setUploadId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleViewHistory = () => {
    navigate('/dashboard/import/history?import_type=document')
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t('pages.imports.documents.title', 'Bulk Document Import')}
        </h1>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-primary-foreground" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t('pages.imports.documents.viewHistory', 'Import History')}
        </Button>
      </div>

      {jobId !== null ? (
        <DocumentImportProgress jobId={jobId} onComplete={handleReset} />
      ) : (
        <div className="border-border bg-card/50 space-y-5 rounded-xl border p-4 shadow-sm sm:p-6">
          <div>
            <h3 className="text-foreground text-lg font-medium">
              {t('pages.imports.documents.sectionTitle', 'Upload Document Archive')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t(
                'pages.imports.documents.subtitle',
                'Upload a ZIP archive of credit and client documents, matched to a selected factoring agreement.'
              )}
            </p>
          </div>

          {/* Factoring agreement */}
          <div>
            <Label htmlFor="doc-import-agreement" required className="mb-1.5 block">
              {t('pages.imports.documents.agreement', 'Factoring agreement')}
            </Label>
            <Select
              value={agreementId}
              onValueChange={setAgreementId}
              disabled={isLoadingAgreements}
            >
              <SelectTrigger className="w-full" id="doc-import-agreement">
                <SelectValue
                  placeholder={
                    isLoadingAgreements
                      ? t('common.loading', 'Loading…')
                      : t('pages.imports.documents.selectAgreement', 'Select a factoring agreement')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {agreements.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.agreement_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agreement info panel — agreement number, who sold, purchase date */}
          {selectedAgreement && (
            <dl className="bg-muted grid grid-cols-1 gap-y-2 rounded-md p-4 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-6">
              <dt className="text-muted-foreground font-medium">
                {t('pages.imports.documents.seller', 'Seller')}
              </dt>
              <dd className="text-foreground font-light">{sellerName || '—'}</dd>

              <dt className="text-muted-foreground font-medium">
                {t('pages.imports.documents.agreementNumber', 'Agreement number')}
              </dt>
              <dd className="text-foreground font-light">
                {selectedAgreement.agreement_number || '—'}
              </dd>

              <dt className="text-muted-foreground font-medium">
                {t('pages.imports.documents.whoSold', 'Who sold')}
              </dt>
              <dd className="text-foreground font-light">
                {selectedAgreement.previous_lender || '—'}
              </dd>

              <dt className="text-muted-foreground font-medium">
                {t('pages.imports.documents.purchaseDate', 'Purchase date')}
              </dt>
              <dd className="text-foreground font-light">
                {selectedAgreement.contract_purchase_date || '—'}
              </dd>
            </dl>
          )}

          {/* No document-type picker: the project's rules type each file on
              their own. What the operator needs here is whether those rules
              are complete, and a way to reach them if they are not. */}
          {!isLoadingReadiness && readinessFailed && (
            <div
              role="alert"
              className="border-error-300 bg-error-50 text-error-800 flex items-start gap-2 rounded-lg border p-3 text-sm"
            >
              <Icons.Warning size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span className="flex-1">
                {t(
                  'pages.imports.documents.rulesCheckFailed',
                  'Could not check the bulk-upload rules. The import may still work; try again to be sure.'
                )}
              </span>
              <Button
                variant="white-secondary"
                size="sm"
                onClick={() => void refetchReadiness()}
                className="shrink-0"
              >
                {t('actions.retry', 'Retry')}
              </Button>
            </div>
          )}

          {!isLoadingReadiness && !readinessFailed && !rulesReady && (
            <div
              role="status"
              className="border-warning-300 bg-warning-50 text-warning-800 flex items-start gap-2 rounded-lg border p-3 text-sm"
            >
              <Icons.Warning size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>
                {t(
                  'pages.imports.documents.rulesNotReady',
                  'Bulk upload is unavailable until a default document type is set for {{folders}} under Settings → Document Generation → Bulk Upload Rules.',
                  {
                    folders: (readiness?.missing_defaults ?? ['credits', 'users'])
                      .map((folder) => `${folder}/`)
                      .join(', '),
                  }
                )}
              </span>
            </div>
          )}

          {/* ZIP upload (single .zip only) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label required>
                {t('pages.imports.documents.archive', 'Document archive (.zip)')}
              </Label>
              <Button
                variant="white-secondary"
                size="sm"
                onClick={() => downloadExample.mutate()}
                disabled={downloadExample.isPending}
                leftIcon={
                  downloadExample.isPending ? (
                    <Icons.Spinner className="h-4 w-4" />
                  ) : (
                    <Icons.Download size={16} />
                  )
                }
              >
                {downloadExample.isPending
                  ? t('pages.imports.documents.downloading', 'Downloading…')
                  : t('pages.imports.documents.downloadTemplate', 'Download Template')}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="border-border hover:bg-muted/50 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icons.CloudDownload size={32} strokeWidth={0.75} className="text-muted-foreground" />
              {zipFile ? (
                <span className="text-foreground text-sm font-medium">{zipFile.name}</span>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {t('pages.imports.documents.dropZip', 'Click to select a .zip archive')}
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadId && !uploading && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-success-600 flex items-center gap-1 text-xs font-medium">
                  <Icons.Success size={14} className="text-success-500" />
                  {t('pages.imports.documents.uploadReady', 'Uploaded — ready to import')}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveStaged}
                  className="text-error-600 hover:text-error-700 text-xs font-medium"
                >
                  {t('pages.imports.documents.removeFile', 'Remove')}
                </button>
              </div>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              {t(
                'pages.imports.documents.structureHint',
                'ZIP with credits/<external_id>/ and users/<external_id>/ folders — each folder is named by the credit or client external_id. Files inside are attached to the matching credit or client.'
              )}
            </p>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div>
              <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
                <span>{t('pages.imports.documents.uploading', 'Uploading…')}</span>
                <div className="flex items-center gap-3">
                  <span>{progress}%</span>
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="text-error-600 hover:text-error-700 font-medium"
                  >
                    {t('pages.imports.documents.cancelUpload', 'Cancel')}
                  </button>
                </div>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary-400 h-full rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              leftIcon={starting ? <Icons.Spinner className="h-4 w-4" /> : undefined}
            >
              {starting
                ? t('pages.imports.documents.starting', 'Starting…')
                : t('pages.imports.documents.startImport', 'Start Import')}
            </Button>
          </div>
        </div>
      )}

      <BulkJobBanner
        importType="document"
        label={t('pages.imports.documents.bannerInProgress', 'Document import in progress')}
        onViewHistory={handleViewHistory}
        hidden={jobId !== null}
      />
    </div>
  )
}

export default BulkDocumentImportPage
