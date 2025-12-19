/**
 * Step2FileUpload Component
 *
 * File upload component for Step 2 of the Import Clients wizard
 * Handles CSV file upload with drag and drop functionality
 */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useValidateCSV, useUploadImport } from '@/features/imports'
import type { Step1Data } from './Step1LoanSource'
import { getErrorMessage } from '@/lib/errors'

export interface Step2Data {
  csvFile: File | null
  invalidFile: File | null // Track invalid file type
  csvValidationError: {
    isValid: boolean
    missingColumns: string[]
    errorMessage?: string // Optional error message from API
  } | null // Track CSV structure validation errors
}

export interface Step2FileUploadProps {
  data: Step2Data
  onChange: (data: Partial<Step2Data>) => void
  isImportInProgress?: boolean
  step1Data: Step1Data
  onImportStarted?: (importId: number | string) => void
}

export function Step2FileUpload({
  data,
  onChange,
  isImportInProgress = false,
  step1Data,
  onImportStarted,
}: Step2FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import mutations
  const uploadImportMutation = useUploadImport()
  const validateCSVMutation = useValidateCSV()

  const isFileValid = (file: File): boolean => {
    return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  }

  // Validate CSV structure with backend API
  const validateCSVStructure = async (file: File) => {
    try {
      const result = await validateCSVMutation.mutateAsync(file)

      if (result.is_valid) {
        // CSV structure is valid - backend confirmed
        onChange({
          csvFile: file,
          invalidFile: null,
          csvValidationError: null,
        })
      } else {
        // CSV structure is invalid - backend returned missing columns
        onChange({
          csvFile: file, // Store the file so we can display its name
          invalidFile: null,
          csvValidationError: {
            isValid: false,
            missingColumns: result.missing_columns || [], // Use backend response
          },
        })
      }
    } catch (error) {
      // Handle API error - backend validation failed
      console.error('CSV validation error:', error)
      const errorMessage = getErrorMessage(error)

      // Check if error response contains missing_columns from backend
      // Some backends return validation errors in the error response
      let missingColumns: string[] = []
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as { response?: { data?: { missing_columns?: string[] } } }
        missingColumns = apiError.response?.data?.missing_columns || []
      }

      // If backend returns an error, show it to the user
      // Only use missing columns if backend explicitly provides them
      onChange({
        csvFile: file, // Keep file reference to show filename
        invalidFile: null,
        csvValidationError: {
          isValid: false,
          missingColumns: missingColumns, // Only use if backend provides
          errorMessage: missingColumns.length === 0 ? errorMessage : undefined, // Show generic error only if no columns provided
        },
      })
    }
  }

  const handleFileSelect = async (file: File | null) => {
    // Prevent file selection if import is in progress
    if (isImportInProgress) {
      return
    }

    if (!file) {
      onChange({ csvFile: null, invalidFile: null, csvValidationError: null })
      return
    }

    if (!isFileValid(file)) {
      // Invalid file type (not CSV)
      onChange({ csvFile: null, invalidFile: file, csvValidationError: null })
      return
    }

    // Valid CSV file - validate structure with backend
    await validateCSVStructure(file)
  }

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
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    handleFileSelect(file)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleDownloadTemplate = () => {
    // Template download functionality
    // This would typically fetch a template file from the backend
    // For now, we'll create a simple CSV template with required columns
    const templateContent = 'name,phone,debt_amount\n'
    const blob = new Blob([templateContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'client_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleStartImport = async () => {
    if (
      !data.csvFile ||
      !step1Data.sellerCreditor ||
      !step1Data.projectCode ||
      !step1Data.purchaseDate
    ) {
      setImportError('Please fill in all required fields and select a CSV file')
      return
    }

    if (hasInvalidCSVStructure) {
      setImportError('Please fix CSV structure errors before importing')
      return
    }

    setImportError(null)

    try {
      const result = await uploadImportMutation.mutateAsync({
        file: data.csvFile,
        seller_creditor: step1Data.sellerCreditor,
        project_code: step1Data.projectCode,
        purchase_date: step1Data.purchaseDate,
        comment: step1Data.comment || undefined,
        import_type: 'simple',
      })

      if (onImportStarted && result.job_id) {
        onImportStarted(result.job_id)
      }
      onImportStarted?.('123' as unknown as string)
    } catch (error) {
      setImportError(getErrorMessage(error))
    }
  }

  // Format file size to MB
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const hasValidFile = !!data.csvFile
  const hasInvalidFile = !!data.invalidFile
  const hasInvalidCSVStructure = !!data.csvValidationError && !data.csvValidationError.isValid
  const isStartingImport = uploadImportMutation.isPending
  const isValidating = validateCSVMutation.isPending

  // Get the file from validation error state - we need to track it separately
  // For now, we'll show the error but need to store the file reference
  const [errorFile, setErrorFile] = useState<File | null>(null)

  // Update errorFile when validation error occurs
  if (hasInvalidCSVStructure && !errorFile && data.csvFile) {
    setErrorFile(data.csvFile)
  }

  const displayFile = data.csvFile || data.invalidFile

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <h2 className="text-dark-500 mb-6 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
        Import Client Data (Simple CSV)
      </h2>

      {/* Warning Alert - shown when import is in progress */}
      {isImportInProgress && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-white p-6">
          <Icons.Warning size={24} className="text-error-500" />
          <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            You cannot start another import until this one finishes.
          </span>
        </div>
      )}

      {/* Error Alert - shown when import fails */}
      {importError && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-white p-6">
          <Icons.Warning size={24} className="text-error-500" />
          <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {importError}
          </span>
        </div>
      )}

      {/* File Upload Drop Zone */}
      <div
        className={cn(
          'relative flex flex-col items-center gap-6 self-stretch rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300',
          isImportInProgress && 'pointer-events-none opacity-50' // Disable when import in progress
        )}
        onDragOver={isImportInProgress ? undefined : handleDragOver}
        onDragLeave={isImportInProgress ? undefined : handleDragLeave}
        onDrop={isImportInProgress ? undefined : handleDrop}
      >
        {/* CSV Error Icon - shown when invalid CSV structure */}
        {hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.Csv02 size={48} strokeWidth={0.5} className="text-error-500" />
          </div>
        )}

        {/* Error Icon - shown when invalid file type */}
        {hasInvalidFile && !hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.FileRemove size={48} strokeWidth={0.5} className="text-error-500" />
          </div>
        )}

        {/* Cloud Icon - shown when no file or valid file */}
        {!hasInvalidFile && !hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.CloudDownload size={48} strokeWidth={0.5} className="text-dark-500" />
          </div>
        )}

        <div className="align-self-stretch flex flex-col items-center justify-center gap-4">
          {/* Invalid CSV Structure Error Message */}
          {hasInvalidCSVStructure && (
            <div className="text-error-500 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
              Invalid CSV structure
            </div>
          )}

          {/* Invalid File Type Error Message */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div className="text-error-500 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
              Invalid file type
            </div>
          )}

          {/* File Name Display */}
          {displayFile ? (
            <div className="text-dark-500 text-center text-base leading-[155%] font-light tracking-[-0.32px]">
              {displayFile.name} ({formatFileSize(displayFile.size)})
            </div>
          ) : (
            !hasInvalidCSVStructure && (
              <div className="text-dark-500 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
                Choose CSV File
              </div>
            )
          )}

          {/* Show "Choose CSV File" text even when invalid CSV structure */}
          {hasInvalidCSVStructure && (
            <div className="text-dark-500 text-center text-base leading-[155%] font-light tracking-[-0.32px]">
              Choose CSV File
            </div>
          )}

          {/* Missing Required Columns - shown when invalid CSV structure and backend provides columns */}
          {hasInvalidCSVStructure &&
            data.csvValidationError?.missingColumns &&
            data.csvValidationError.missingColumns.length > 0 && (
              <div className="flex w-full flex-col items-center gap-3">
                <div className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                  Missing required columns:
                </div>
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  {data.csvValidationError.missingColumns.map((column) => (
                    <div key={column} className="flex items-center gap-2 rounded-full px-3 py-1.5">
                      <Icons.Close size={16} className="text-error-500" />
                      <span className="text-error-500 text-base leading-[155%] font-light tracking-[-0.32px] capitalize">
                        {column.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Generic Error Message - shown when API error but no specific columns provided */}
          {hasInvalidCSVStructure &&
            data.csvValidationError?.errorMessage &&
            (!data.csvValidationError.missingColumns ||
              data.csvValidationError.missingColumns.length === 0) && (
              <div className="text-error-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
                {data.csvValidationError.errorMessage}
              </div>
            )}

          {/* Error Message - Only .csv files supported */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div className="text-dark-500 text-center text-base leading-[155%] font-medium tracking-[-0.32px]">
              Only .csv files are supported in this version.
            </div>
          )}

          {/* File Requirements - hidden when invalid file or invalid CSV structure */}
          {!hasInvalidFile && !hasInvalidCSVStructure && (
            <>
              <div className="text-dark-500 text-center text-base leading-[155%] font-light tracking-[-0.32px]">
                File Requirements:
              </div>
              <div className="text-dark-500 flex items-center justify-center gap-1 self-stretch">
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px]">
                  One CSV
                </span>{' '}
                only,{' '}
                <span className="text-base leading-[155%] font-light tracking-[-0.32px]">
                  max 50,000 rows
                </span>
              </div>
              <div className="text-dark-500 flex items-center justify-center gap-1 self-stretch">
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px]">
                  Required:
                </span>{' '}
                name, phone, debt_amount
              </div>
              <div className="text-dark-500 flex items-center justify-center gap-1 self-stretch">
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px]">
                  Optional:
                </span>{' '}
                address, inn, contract...
              </div>
            </>
          )}
        </div>

        {/* Browse File Button */}
        <Button
          variant="outline"
          onClick={handleBrowseClick}
          disabled={isValidating || isImportInProgress}
          className="text-dark-500 flex h-12 flex-col items-center justify-center gap-[10px] rounded-full border border-gray-600 px-5 py-3 text-sm"
        >
          {isValidating ? 'Validating...' : 'Browse File'}
        </Button>

        {/* Hidden File Input - removed accept restriction to allow all file types */}
        <input ref={fileInputRef} type="file" onChange={handleFileInputChange} className="hidden" />
      </div>

      {/* Action Buttons */}
      <div className="flex items-start justify-center gap-6">
        {/* Download Template Button */}
        <Button
          variant="outline"
          onClick={handleDownloadTemplate}
          disabled={isImportInProgress}
          leftIcon={<Icons.FileDownload size={20} className="text-secondary-800" />}
          className={cn(
            'text-secondary-800 flex h-12 items-center justify-center rounded-full border-white bg-white px-4 py-2.5 text-sm leading-[150%] font-medium',
            isImportInProgress && 'opacity-50'
          )}
        >
          Download Sample CSV Template
        </Button>

        {/* Start Import Button - disabled when invalid file, invalid CSV structure, or no file */}
        <Button
          variant="primary"
          onClick={handleStartImport}
          disabled={
            !hasValidFile || hasInvalidCSVStructure || isImportInProgress || isStartingImport
          }
          className={cn(
            'flex h-12 items-center justify-center gap-2.5 rounded-full py-1 pr-1 pl-6 text-sm leading-[150%] font-medium',
            hasValidFile && !hasInvalidCSVStructure && !isImportInProgress && !isStartingImport
              ? 'bg-secondary-800 cursor-pointer text-white'
              : 'cursor-not-allowed bg-gray-200 text-gray-600'
          )}
        >
          <span>{isStartingImport ? 'Starting Import...' : 'Start Import'}</span>
          {/* Circular icon with arrow - matching Next Step button design */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              hasValidFile && !hasInvalidCSVStructure && !isImportInProgress && !isStartingImport
                ? 'bg-primary-300'
                : 'bg-gray-600'
            )}
          >
            <Icons.ArrowRight02
              size={24}
              className={cn(
                hasValidFile && !hasInvalidCSVStructure && !isImportInProgress && !isStartingImport
                  ? 'text-dark-500'
                  : 'text-gray-500'
              )}
            />
          </div>
        </Button>
      </div>
    </div>
  )
}
