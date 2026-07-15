/**
 * BulkDocumentImportPage
 *
 * Bulk upload of credit/client documents via a single ZIP archive, matched to
 * existing credits/clients within a selected factoring agreement. Gated by the
 * ``import_documents`` permission (route wrapped in PermissionRoute).
 *
 * This is the UI shell: agreement + document-type dropdowns, an agreement info
 * panel (agreement number, who sold, purchase date), and a ZIP-only upload
 * area. The upload/processing backend is a later slice.
 */

import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { DocumentTypePill } from '@/components/DocumentTypePill'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { useDocumentTypes } from '@/features/documentTypes'
import { useDownloadExampleArchive } from '@/features/documentImport'
import { useFactoringAgreements } from '@/features/factoringAgreements'

export function BulkDocumentImportPage() {
  const { t } = useTranslation('common')

  const { data: agreementsPage, isLoading: isLoadingAgreements } = useFactoringAgreements({
    page_size: 200,
  })
  const { data: documentTypes = [], isLoading: isLoadingDocTypes } = useDocumentTypes()
  const downloadExample = useDownloadExampleArchive()

  const agreements = useMemo(() => agreementsPage?.items ?? [], [agreementsPage])

  const [agreementId, setAgreementId] = useState<string>('')
  const [documentTypeId, setDocumentTypeId] = useState<string>('')
  const [zipFile, setZipFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedAgreement = useMemo(
    () => agreements.find((a) => String(a.id) === agreementId) ?? null,
    [agreements, agreementId]
  )

  const canSubmit = agreementId !== '' && documentTypeId !== '' && zipFile !== null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error(t('pages.imports.documents.zipOnly', 'Only .zip archives are allowed.'))
      return
    }
    setZipFile(file)
  }

  const handleSubmit = () => {
    // Upload/processing backend is a later slice.
    toast.info(
      t('pages.imports.documents.notReady', 'Document import processing is not available yet.')
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-dark-500 text-2xl font-semibold">
          {t('pages.imports.documents.title', 'Bulk Document Import')}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t(
            'pages.imports.documents.subtitle',
            'Upload a ZIP archive of credit and client documents, matched to a selected factoring agreement.'
          )}
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        {/* Factoring agreement */}
        <div>
          <Label htmlFor="doc-import-agreement" required className="mb-1.5 block">
            {t('pages.imports.documents.agreement', 'Factoring agreement')}
          </Label>
          <Select value={agreementId} onValueChange={setAgreementId} disabled={isLoadingAgreements}>
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
          <dl className="grid grid-cols-1 gap-y-2 rounded-md bg-gray-50 p-4 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-6">
            <dt className="font-medium text-gray-500">
              {t('pages.imports.documents.agreementNumber', 'Agreement number')}
            </dt>
            <dd className="text-dark-500 font-light">
              {selectedAgreement.agreement_number || '—'}
            </dd>

            <dt className="font-medium text-gray-500">
              {t('pages.imports.documents.whoSold', 'Who sold')}
            </dt>
            <dd className="text-dark-500 font-light">{selectedAgreement.previous_lender || '—'}</dd>

            <dt className="font-medium text-gray-500">
              {t('pages.imports.documents.purchaseDate', 'Purchase date')}
            </dt>
            <dd className="text-dark-500 font-light">
              {selectedAgreement.contract_purchase_date || '—'}
            </dd>
          </dl>
        )}

        {/* Document type */}
        <div>
          <Label htmlFor="doc-import-type" required className="mb-1.5 block">
            {t('pages.imports.documents.documentType', 'Document type')}
          </Label>
          <Select
            value={documentTypeId}
            onValueChange={setDocumentTypeId}
            disabled={isLoadingDocTypes || documentTypes.length === 0}
          >
            <SelectTrigger className="w-full" id="doc-import-type">
              <SelectValue
                placeholder={
                  isLoadingDocTypes
                    ? t('common.loading', 'Loading…')
                    : t('pages.imports.documents.selectDocumentType', 'Select a document type')
                }
              >
                {(() => {
                  const selected = documentTypes.find((dt) => String(dt.id) === documentTypeId)
                  return selected ? (
                    <DocumentTypePill name={selected.name} hex={selected.color} />
                  ) : null
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((dt) => (
                <SelectItem key={dt.id} value={String(dt.id)}>
                  <DocumentTypePill name={dt.name} hex={dt.color} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-white/70 p-8 text-center transition hover:border-gray-300"
          >
            <Icons.CloudDownload size={32} strokeWidth={0.75} className="text-gray-400" />
            {zipFile ? (
              <span className="text-dark-500 text-sm font-medium">{zipFile.name}</span>
            ) : (
              <span className="text-sm text-gray-500">
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
          <p className="mt-2 text-xs text-gray-500">
            {t(
              'pages.imports.documents.structureHint',
              'ZIP with credits/<external_id>/ and users/<external_id>/ folders — each folder is named by the credit or client external_id. Files inside are attached to the matching credit or client.'
            )}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {t('pages.imports.documents.startImport', 'Start Import')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default BulkDocumentImportPage
