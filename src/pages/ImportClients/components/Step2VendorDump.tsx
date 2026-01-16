/**
 * Step2VendorDump Component
 *
 * File upload component for Step 2B of the Import Clients wizard (Vendor Dump)
 * Handles multiple CSV files and documents upload with drag and drop functionality
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useUploadImport } from '@/features/imports'
import type { Step1Data } from './Step1LoanSource'
import { getErrorMessage } from '@/lib/errors'

export type DatasetType = 'users' | 'loans' | 'charges' | 'payments' | 'documents'

export interface DatasetFile {
  id: string
  type: DatasetType
  name: string
  status: 'required' | 'optional'
  file: File | null
}

export interface Step2VendorDumpData {
  files: DatasetFile[]
  zipFile: File | null
  isZipUpload: boolean
}

export interface Step2VendorDumpProps {
  data: Step2VendorDumpData
  onChange: (data: Partial<Step2VendorDumpData>) => void
  isImportInProgress?: boolean
  step1Data: Step1Data
  onImportStarted?: (jobId: number | string) => void
}

const INITIAL_DATASETS: Omit<DatasetFile, 'id'>[] = [
  { type: 'users', name: 'Users', status: 'required', file: null },
  { type: 'loans', name: 'Loans', status: 'required', file: null },
  { type: 'charges', name: 'Charges', status: 'optional', file: null },
  { type: 'payments', name: 'Payments', status: 'optional', file: null },
  { type: 'documents', name: 'Documents', status: 'optional', file: null },
]

export function Step2VendorDump({
  data,
  onChange,
  isImportInProgress = false,
  step1Data,
  onImportStarted,
}: Step2VendorDumpProps) {
  const { t } = useTranslation('common')
  const [isDragging, setIsDragging] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const browseFileInputRef = useRef<HTMLInputElement | null>(null)

  // Import mutation
  const uploadImportMutation = useUploadImport()

  // Initialize datasets if not already set
  useEffect(() => {
    if (data.files.length === 0) {
      const initialFiles: DatasetFile[] = INITIAL_DATASETS.map((dataset, index) => ({
        ...dataset,
        id: `dataset-${index}`,
        file: null,
      }))
      onChange({ files: initialFiles })
    }
  }, [data.files.length, onChange])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (isImportInProgress) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFilesSelection(droppedFiles)
  }

  const handleFilesSelection = (files: File[]) => {
    const zipFile = files.find((f) => f.name.toLowerCase().endsWith('.zip'))

    if (zipFile) {
      // If ZIP is uploaded, mark documents as selected
      const updatedFiles = data.files.map((f) =>
        f.type === 'documents' ? { ...f, file: zipFile } : f
      )
      onChange({ zipFile, isZipUpload: true, files: updatedFiles })
    } else {
      // Handle individual CSV files
      handleFilesUpload(files)
    }
  }

  const handleFilesUpload = (files: File[]) => {
    const updatedFiles = [...data.files]

    files.forEach((file) => {
      const fileName = file.name.toLowerCase()
      if (fileName.includes('users') || fileName.includes('user')) {
        const usersIndex = updatedFiles.findIndex((f) => f.type === 'users')
        if (usersIndex !== -1) updatedFiles[usersIndex].file = file
      } else if (fileName.includes('loans') || fileName.includes('loan')) {
        const loansIndex = updatedFiles.findIndex((f) => f.type === 'loans')
        if (loansIndex !== -1) updatedFiles[loansIndex].file = file
      } else if (fileName.includes('charges') || fileName.includes('charge')) {
        const chargesIndex = updatedFiles.findIndex((f) => f.type === 'charges')
        if (chargesIndex !== -1) updatedFiles[chargesIndex].file = file
      } else if (fileName.includes('payments') || fileName.includes('payment')) {
        const paymentsIndex = updatedFiles.findIndex((f) => f.type === 'payments')
        if (paymentsIndex !== -1) updatedFiles[paymentsIndex].file = file
      }
    })

    onChange({ files: updatedFiles, isZipUpload: false })
  }

  const handleBrowseFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length > 0) {
      handleFilesSelection(files)
    }
    // Reset input so same file can be selected again
    if (browseFileInputRef.current) {
      browseFileInputRef.current.value = ''
    }
  }

  const handleFileInputChange = (type: DatasetType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (!file) return

    const updatedFiles = data.files.map((f) => (f.type === type ? { ...f, file } : f))
    onChange({ files: updatedFiles, isZipUpload: false })

    // Reset input so same file can be selected again
    if (fileInputRefs.current[type]) {
      fileInputRefs.current[type]!.value = ''
    }
  }

  const handleBrowseClick = (type?: DatasetType) => {
    if (type) {
      // Click specific dataset file input
      const inputRef = fileInputRefs.current[type]
      inputRef?.click()
    } else {
      // Click main Browse File button
      browseFileInputRef.current?.click()
    }
  }

  const handleStartImport = async () => {
    if (!step1Data.sellerId || !step1Data.projectCode || !step1Data.purchaseDate) {
      setImportError(t('pages.imports.step2.vendor.fillAllFields'))
      return
    }

    // Check required files are selected
    const requiredFiles = data.files.filter((f) => f.status === 'required')
    const missingRequired = requiredFiles.some((f) => !f.file)

    if (missingRequired) {
      setImportError(t('pages.imports.step2.vendor.selectAllRequired'))
      return
    }

    setImportError(null)

    try {
      // Prepare files array (excluding documents if ZIP is uploaded)
      const filesToUpload: File[] = []
      data.files.forEach((dataset) => {
        if (dataset.file && dataset.type !== 'documents') {
          filesToUpload.push(dataset.file)
        }
      })

      const result = await uploadImportMutation.mutateAsync({
        files: filesToUpload.length > 0 ? filesToUpload : undefined,
        zip_file: data.zipFile || undefined,
        seller_id: parseInt(step1Data.sellerId, 10),
        project_code: step1Data.projectCode,
        purchase_date: step1Data.purchaseDate,
        comment: step1Data.comment || undefined,
        import_type: 'vendor',
      })

      if (onImportStarted && result.job_id) {
        onImportStarted(result.job_id)
      }
    } catch (error) {
      setImportError(getErrorMessage(error))
    }
  }

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const requiredFilesSelected =
    data.files.length > 0 &&
    data.files.filter((f) => f.status === 'required').every((f) => f.file !== null)

  const isStartingImport = uploadImportMutation.isPending

  const columns: Column<DatasetFile>[] = [
    {
      key: 'name',
      header: t('pages.imports.step2.vendor.dataset'),
      render: (item) => <span className="text-dark-500 text-xs font-medium">{item.name}</span>,
    },
    {
      key: 'status',
      header: t('pages.imports.step2.vendor.status'),
      render: (item) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              item.status === 'required' ? 'bg-error-500' : 'bg-gray-500'
            )}
          />
          <span className="text-dark-500 text-xs font-medium">
            {item.status === 'required'
              ? t('pages.imports.step2.vendor.required')
              : t('pages.imports.step2.vendor.optional')}
          </span>
        </div>
      ),
    },
    {
      key: 'file',
      header: t('pages.imports.step2.vendor.file'),
      render: (item) => {
        const isDocuments = item.type === 'documents'
        const hasFile = item.file !== null

        return (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            {hasFile ? (
              <span className="text-dark-500 text-xs font-medium break-words">
                {item.file?.name} ({formatFileSize(item.file?.size || 0)})
              </span>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleBrowseClick(item.type)}
                disabled={isImportInProgress}
                className="h-8 w-full text-xs font-medium sm:w-auto"
              >
                {isDocuments
                  ? t('pages.imports.step2.vendor.chooseZip')
                  : t('pages.imports.step2.vendor.chooseFile')}
              </Button>
            )}
            <input
              ref={(el) => {
                fileInputRefs.current[item.type] = el
              }}
              type="file"
              accept={isDocuments ? '.zip' : '.csv'}
              onChange={(e) => handleFileInputChange(item.type, e)}
              className="hidden"
            />
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Section Title */}
      <h2 className="text-dark-500 mb-4 text-center text-xl leading-[120%] font-light tracking-[-0.48px] sm:mb-6 sm:text-2xl">
        {t('pages.imports.step2.vendor.title')}
      </h2>

      {/* Error Alert - shown when import fails */}
      {importError && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-white p-4 sm:gap-3 sm:p-6">
          <Icons.Warning size={20} className="text-error-500 sm:size-6" />
          <span className="text-error-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
            {importError}
          </span>
        </div>
      )}

      {/* Instructions */}
      <p className="text-dark-500 mb-4 text-center text-sm leading-[155%] font-light tracking-[-0.32px] sm:mb-6 sm:text-base">
        {t('pages.imports.step2.vendor.dragCsvs')}
      </p>

      {/* File Upload Drop Zone */}
      <div
        className={cn(
          'relative flex flex-col items-center gap-4 self-stretch rounded-lg border-2 border-dashed px-4 py-8 transition-colors sm:gap-6 sm:px-6 sm:py-12',
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300',
          isImportInProgress && 'pointer-events-none opacity-50'
        )}
        onDragOver={isImportInProgress ? undefined : handleDragOver}
        onDragLeave={isImportInProgress ? undefined : handleDragLeave}
        onDrop={isImportInProgress ? undefined : handleDrop}
      >
        {/* Cloud Icon */}
        <div className="flex aspect-square items-center justify-center px-1 py-1.5">
          <Icons.CloudDownload size={40} className="text-dark-500 sm:size-12" strokeWidth={0.5} />
        </div>

        <div className="align-self-stretch flex flex-col items-center justify-center gap-3 sm:gap-4">
          <div className="text-dark-500 text-center text-lg leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
            {t('pages.imports.step2.vendor.dragDropFiles')}
          </div>

          {/* Browse File Button */}
          <Button
            variant="outline"
            onClick={() => handleBrowseClick()}
            disabled={isImportInProgress}
            className="flex h-10 w-full flex-col items-center justify-center rounded-full text-xs sm:h-12 sm:w-auto sm:text-sm"
          >
            {t('pages.imports.step2.vendor.browseFile')}
          </Button>
        </div>
      </div>

      {/* Hidden file input for Browse File button - accepts multiple files */}
      <input
        ref={browseFileInputRef}
        type="file"
        multiple
        accept=".csv,.zip"
        onChange={handleBrowseFileInputChange}
        className="hidden"
      />

      {/* Dataset Table */}
      <div className="mt-4 sm:mt-6">
        <div className="overflow-x-auto">
          <DataTable
            columns={columns}
            data={data.files}
            emptyMessage={t('pages.imports.step2.vendor.noDatasetsConfigured')}
          />
        </div>
      </div>

      {/* Start Import Button */}
      <div className="mt-6 flex justify-center sm:mt-8">
        <DoubleButton
          icon={<Icons.ArrowRight02 size={24} />}
          iconPosition="right"
          onClick={handleStartImport}
          disabled={!requiredFilesSelected || isImportInProgress || isStartingImport}
          className="w-full justify-center sm:w-auto"
        >
          {t('pages.imports.step2.vendor.startImport')}
        </DoubleButton>
      </div>
    </div>
  )
}
