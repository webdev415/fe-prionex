/**
 * Step2FileUpload Component
 *
 * File upload component for Step 2 of the Import Clients wizard
 * Handles CSV file upload with drag and drop functionality
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useUploadImport } from '@/features/imports'
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
  const { t } = useTranslation('common')
  const [isDragging, setIsDragging] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import mutations
  const uploadImportMutation = useUploadImport()

  // Reset mutation state when import is no longer in progress (allows new imports)
  useEffect(() => {
    if (!isImportInProgress && uploadImportMutation.isError) {
      // Reset mutation when import completes/fails to allow retry
      uploadImportMutation.reset()
    }
  }, [isImportInProgress, uploadImportMutation])

  const isFileValid = (file: File): boolean => {
    return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  }

  // Validate CSV file structure (headers) when file is selected
  const validateCSVFile = async (
    file: File
  ): Promise<{ isValid: boolean; missingColumns?: string[] }> => {
    return new Promise((resolve) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          if (!text) {
            resolve({ isValid: false, missingColumns: [] })
            return
          }

          // Read first line (header)
          const lines = text.split('\n')
          if (lines.length === 0) {
            resolve({ isValid: false, missingColumns: [] })
            return
          }

          const headerLine = lines[0].trim()
          if (!headerLine) {
            resolve({ isValid: false, missingColumns: [] })
            return
          }

          // Parse header columns
          // Try comma first, then semicolon, then tab
          let delimiter = ','
          if (headerLine.includes(';') && !headerLine.includes(',')) {
            delimiter = ';'
          } else if (headerLine.includes('\t')) {
            delimiter = '\t'
          }

          const headers = headerLine
            .split(delimiter)
            .map((h) => h.trim().toLowerCase())
            .filter((h) => h.length > 0)

          // Required columns (matching backend requirements - exact column names only)
          const requiredColumns = [
            'first_name',
            'last_name',
            'date of birth',
            'tin',
            'registration_address',
            'personal_address',
            'number of family members',
            'job: organization name',
            'job: position',
            'income level',
            'passport type',
            'who issued the passport',
            'contract number',
            'start date',
            'last return date',
            'loan amount (uah)',
            'body debt (uah)',
            'total to refund',
            'loan term (days)',
          ]

          // Conditionally required: at least one phone column
          const phoneColumns = [
            'phone number from registry',
            'phone_number_from_registry',
            'phone number of client',
            'phone_number_of_client',
            'phone',
          ]

          // Check for required columns
          const missingColumns: string[] = []
          const headerSet = new Set(headers)

          for (const reqCol of requiredColumns) {
            if (!headerSet.has(reqCol)) {
              // Check if we already found this column (e.g., first_name vs First Name)
              const found = headers.some(
                (h) =>
                  h.replace(/\s+/g, '_') === reqCol ||
                  h.replace(/\s+/g, '_') === reqCol.replace(/_/g, ' ') ||
                  reqCol.replace(/_/g, ' ') === h
              )
              if (!found) {
                // Only add if not already in missingColumns (avoid duplicates)
                const colName = reqCol.replace(/_/g, ' ')
                if (!missingColumns.includes(colName) && !missingColumns.includes(reqCol)) {
                  missingColumns.push(reqCol)
                }
              }
            }
          }

          // Check for at least one phone column
          const hasPhone = phoneColumns.some((col) => headerSet.has(col))
          if (!hasPhone) {
            // Check if any phone column exists with different formatting
            const hasPhoneFormatted = headers.some((h) =>
              phoneColumns.some(
                (pc) =>
                  h.replace(/\s+/g, '_') === pc ||
                  h.replace(/\s+/g, '_') === pc.replace(/_/g, ' ') ||
                  pc.replace(/_/g, ' ') === h ||
                  h.includes('phone')
              )
            )
            if (!hasPhoneFormatted) {
              // Don't add phone to missing columns as it's conditionally required
              // Backend will handle this during upload
            }
          }

          resolve({
            isValid: missingColumns.length === 0,
            missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
          })
        } catch (error) {
          console.error('Error validating CSV file:', error)
          resolve({ isValid: false, missingColumns: [] })
        }
      }

      reader.onerror = () => {
        resolve({ isValid: false, missingColumns: [] })
      }

      // Read only first 10KB to get header (enough for header row)
      const blob = file.slice(0, 10240)
      reader.readAsText(blob)
    })
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

    // Valid CSV file - validate structure immediately
    onChange({
      csvFile: file,
      invalidFile: null,
      csvValidationError: null, // Clear previous error while validating
    })

    // Validate CSV structure (headers) immediately
    const validationResult = await validateCSVFile(file)

    if (!validationResult.isValid && validationResult.missingColumns) {
      // Set validation error immediately
      onChange({
        csvValidationError: {
          isValid: false,
          missingColumns: validationResult.missingColumns,
          errorMessage: undefined,
        },
      })
    } else {
      // File is valid, clear any previous errors
      onChange({
        csvValidationError: null,
      })
    }
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
    const templateContent = 'first_name, last_name, phone, tin, debt_amount\n'
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
      setImportError(t('pages.imports.step2.simple.fillAllFields'))
      return
    }

    // Don't clear errors here - errors will be set in catch block if upload fails
    // This ensures previous errors remain visible until a new error occurs or upload succeeds
    console.log('=== STARTING UPLOAD ===')
    console.log('Current importError:', importError)
    console.log('Mutation error:', uploadImportMutation.error)
    console.log('Mutation isError:', uploadImportMutation.isError)

    try {
      const result = await uploadImportMutation.mutateAsync({
        file: data.csvFile,
        seller_creditor: step1Data.sellerCreditor,
        project_code: step1Data.projectCode,
        purchase_date: step1Data.purchaseDate,
        comment: step1Data.comment || undefined,
        import_type: 'simple',
      })

      // Clear errors on success
      setImportError(null)
      // Only clear validation error on success, not before
      onChange({ csvValidationError: null })

      if (onImportStarted && result.job_id) {
        onImportStarted(result.job_id)
      }
    } catch (error) {
      // Log error for debugging
      console.error('=== UPLOAD ERROR CAUGHT ===', error)
      console.error('Error type:', typeof error)
      console.error('Error keys:', error && typeof error === 'object' ? Object.keys(error) : 'N/A')

      // Handle validation errors from backend upload endpoint
      const errorMessage = getErrorMessage(error)
      console.log('Error message extracted:', errorMessage)

      // CRITICAL: Set error state IMMEDIATELY - this must happen first
      console.log('Setting error state to:', errorMessage)
      setImportError(errorMessage)

      // Extract validation details from error response
      // Check if it's an Axios error (has response property)
      const isAxiosError = error && typeof error === 'object' && 'response' in error

      if (isAxiosError) {
        console.log('Error has response structure')
        const apiError = error as {
          response?: {
            data?: {
              detail?: string | string[]
              message?: string
              missing_columns?: string[]
            }
            status?: number
          }
        }

        const responseData = apiError.response?.data
        const status = apiError.response?.status

        console.log('Response data:', JSON.stringify(responseData, null, 2))
        console.log('Status:', status)

        // Handle 401 Unauthorized - authentication error
        if (status === 401) {
          console.log('401 Unauthorized - authentication required')
          // Don't set csvValidationError for auth errors
          // The error message is already set in importError
          return // Exit early, don't process as validation error
        }

        // Handle FastAPI validation error format
        let detail = ''
        let missingColumns: string[] = []

        if (responseData) {
          console.log('Processing response data...')
          // FastAPI returns detail as string or array
          if (typeof responseData.detail === 'string') {
            detail = responseData.detail
          } else if (Array.isArray(responseData.detail)) {
            // ValidationError format: array of error objects
            detail = responseData.detail
              .map((err: { msg?: string; message?: string } | string) => {
                if (typeof err === 'string') return err
                return err.msg || err.message || String(err)
              })
              .join(', ')
          }

          // PRIORITY 1: Check if missing_columns is directly in response (backend now provides this)
          if (responseData.missing_columns && Array.isArray(responseData.missing_columns)) {
            missingColumns = responseData.missing_columns
            console.log('Found missing_columns in response:', missingColumns)
          } else if (detail.includes('Missing required columns:')) {
            // PRIORITY 2: Extract missing columns from detail message (fallback for old format)
            // Backend format: "Missing required columns: first_name, last_name. Required columns: ..."
            const match = detail.match(/Missing required columns:\s*([^.]+?)(?:\.|$)/i)
            if (!match) {
              // Try without requiring period
              const match2 = detail.match(/Missing required columns:\s*([^,]+(?:,\s*[^,]+)*)/i)
              if (match2 && match2[1]) {
                missingColumns = match2[1]
                  .split(',')
                  .map((col) => col.trim())
                  .filter((col) => col.length > 0)
                console.log('Extracted missing_columns from detail:', missingColumns)
              }
            }
          }
        }

        // CRITICAL: ALWAYS set csvValidationError for ANY 400 error
        // This ensures csvValidationError is never null when there's a validation error
        if (status === 400) {
          // Extract missing columns if not already extracted
          if (missingColumns.length === 0 && detail.includes('Missing required columns:')) {
            const match = detail.match(/Missing required columns:\s*([^.]+?)(?:\.|$)/i)
            if (match && match[1]) {
              missingColumns = match[1]
                .split(',')
                .map((c) => c.trim())
                .filter((c) => c.length > 0)
            }
          }

          // Set CSV validation error state - ALWAYS for 400 errors
          const validationError = {
            isValid: false,
            missingColumns: missingColumns,
            errorMessage: missingColumns.length === 0 ? detail : undefined,
          }

          console.log('=== SETTING csvValidationError ===', validationError)
          console.log('Current data state:', {
            csvFile: data.csvFile,
            csvValidationError: data.csvValidationError,
          })

          // CRITICAL: Always call onChange to set csvValidationError
          onChange({
            csvValidationError: validationError,
            csvFile: data.csvFile, // Keep the file so error is visible
          })

          console.log('=== onChange CALLED ===')
        } else {
          console.log('Not a 400 error. Status:', status, 'Detail:', detail)
        }
      } else {
        console.log('Error does not have response structure')
        // Check if error message indicates authentication issue
        if (
          errorMessage &&
          (errorMessage.includes('401') || errorMessage.includes('Unauthorized'))
        ) {
          console.log('Authentication error detected in error message')
          // Don't set csvValidationError for auth errors
          return
        }
      }

      // Ensure we have an error message - fallback if extraction failed
      if (!errorMessage) {
        console.warn('Error caught but no error message extracted!', error)
        setImportError(t('pages.imports.step2.simple.errorOccurred'))
      }
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

  // Get current error from mutation - this is the source of truth
  const mutationError = uploadImportMutation.error
  const mutationErrorMsg = mutationError ? getErrorMessage(mutationError) : null

  // DEBUG: Log state on render to help diagnose
  if (mutationError || uploadImportMutation.isError) {
    console.log('RENDER: Mutation has error!', {
      importError,
      mutationErrorMsg,
      isError: uploadImportMutation.isError,
      hasInvalidCSV: hasInvalidCSVStructure,
    })
  }

  // Sync mutation error state with component error state - ALWAYS keep them in sync
  useEffect(() => {
    const mutationError = uploadImportMutation.error
    if (mutationError) {
      const errorMsg = getErrorMessage(mutationError)
      console.log('useEffect: Setting error from mutation error state:', errorMsg)
      // Defer state update to avoid cascading renders
      setTimeout(() => {
        setImportError(errorMsg)
      }, 0)

      // Also extract validation details if it's a validation error
      if (typeof mutationError === 'object' && 'response' in mutationError) {
        const apiError = mutationError as {
          response?: {
            data?: {
              detail?: string | string[]
              missing_columns?: string[]
            }
            status?: number
          }
        }

        const responseData = apiError.response?.data
        const status = apiError.response?.status

        if (responseData && status === 400) {
          let detail = ''
          let missingColumns: string[] = []

          if (typeof responseData.detail === 'string') {
            detail = responseData.detail
          } else if (Array.isArray(responseData.detail)) {
            detail = responseData.detail
              .map((err: { msg?: string; message?: string } | string) => {
                if (typeof err === 'string') return err
                return err.msg || err.message || String(err)
              })
              .join(', ')
          }

          // Extract missing columns
          if (detail.includes('Missing required columns:')) {
            const match = detail.match(/Missing required columns:\s*([^.]+?)(?:\.|$)/i)
            if (!match) {
              const match2 = detail.match(/Missing required columns:\s*([^,]+(?:,\s*[^,]+)*)/i)
              if (match2 && match2[1]) {
                missingColumns = match2[1]
                  .split(',')
                  .map((col) => col.trim())
                  .filter((col) => col.length > 0)
              }
            } else if (match[1]) {
              missingColumns = match[1]
                .split(',')
                .map((col) => col.trim())
                .filter((col) => col.length > 0)
            }
          }

          if (responseData.missing_columns && Array.isArray(responseData.missing_columns)) {
            missingColumns = responseData.missing_columns
          }

          // Check if it's a CSV validation error
          const isValidationError =
            detail.includes('CSV') ||
            detail.includes('header') ||
            detail.includes('column') ||
            detail.includes('Missing required') ||
            missingColumns.length > 0

          if (isValidationError) {
            onChange({
              csvValidationError: {
                isValid: false,
                missingColumns: missingColumns,
                errorMessage: missingColumns.length === 0 ? detail : undefined,
              },
              csvFile: data.csvFile,
            })
          }
        }
      }
    } else if (!uploadImportMutation.isPending && !uploadImportMutation.isError) {
      // Clear error when mutation succeeds or resets
      // But only if we're not in the middle of handling an error
    }
  }, [
    uploadImportMutation.error,
    uploadImportMutation.isPending,
    uploadImportMutation.isError,
    data.csvFile,
    onChange,
  ])

  // Track the file that caused the error
  const [errorFile, setErrorFile] = useState<File | null>(null)

  // Update errorFile when validation error occurs
  useEffect(() => {
    if (hasInvalidCSVStructure && data.csvFile && !errorFile) {
      // Defer state update to avoid cascading renders
      setTimeout(() => {
        setErrorFile(data.csvFile)
      }, 0)
    } else if (!hasInvalidCSVStructure) {
      setTimeout(() => {
        setErrorFile(null)
      }, 0)
    }
  }, [hasInvalidCSVStructure, data.csvFile, errorFile])

  const displayFile = data.csvFile || data.invalidFile || errorFile

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <h2 className="text-dark-500 mb-6 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
        {t('pages.imports.step2.simple.title')}
      </h2>

      {/* Warning Alert - shown when import is in progress */}
      {isImportInProgress && (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-white p-6">
          <Icons.Warning size={24} className="text-error-500" />
          <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.imports.step2.simple.cannotStartAnother')}
          </span>
        </div>
      )}

      {/* Error Alert - shown when import fails - SIMPLIFIED CONDITION */}
      {(importError ||
        mutationErrorMsg ||
        uploadImportMutation.isError ||
        hasInvalidCSVStructure) && (
        <div className="mb-4 flex items-center justify-center gap-3 rounded-lg border-2 border-red-500 bg-white p-6">
          <Icons.Warning size={24} className="text-error-500" />
          <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {importError ||
              mutationErrorMsg ||
              data.csvValidationError?.errorMessage ||
              (uploadImportMutation.isError
                ? t('pages.imports.step2.simple.errorOccurred')
                : null) ||
              (hasInvalidCSVStructure
                ? t('pages.imports.step2.simple.csvValidationFailed')
                : null) ||
              t('pages.imports.step2.simple.errorOccurred')}
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
              {t('pages.imports.step2.simple.invalidCsvStructure')}
            </div>
          )}

          {/* Invalid File Type Error Message */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div className="text-error-500 text-center text-2xl leading-[120%] font-light tracking-[-0.48px]">
              {t('pages.imports.step2.simple.invalidFileType')}
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
                {t('pages.imports.step2.simple.chooseCsvFile')}
              </div>
            )
          )}

          {/* Show "Choose CSV File" text even when invalid CSV structure */}
          {hasInvalidCSVStructure && (
            <div className="text-dark-500 text-center text-base leading-[155%] font-light tracking-[-0.32px]">
              {t('pages.imports.step2.simple.chooseCsvFile')}
            </div>
          )}

          {/* Missing Required Columns - shown when invalid CSV structure and backend provides columns */}
          {hasInvalidCSVStructure &&
            data.csvValidationError?.missingColumns &&
            data.csvValidationError.missingColumns.length > 0 && (
              <div className="flex w-full flex-col items-center gap-3">
                <div className="text-dark-500 text-center text-base leading-[155%] font-bold tracking-[-0.32px]">
                  {t('pages.imports.step2.simple.missingRequiredColumns')}
                </div>
                <div className="flex w-full flex-wrap items-center justify-center gap-3">
                  {data.csvValidationError.missingColumns.map((column) => {
                    // Format column name: first_name -> First Name, debt_amount -> Debt Amount
                    const formattedName = column
                      .split('_')
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                      .join(' ')

                    return (
                      <div key={column} className="flex items-center gap-2">
                        <Icons.Close size={16} className="text-error-500" />
                        <span className="text-error-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                          {formattedName}
                        </span>
                      </div>
                    )
                  })}
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
              {t('pages.imports.step2.simple.onlyCsvSupported')}
            </div>
          )}

          {/* File Requirements - hidden when invalid file or invalid CSV structure */}
          {!hasInvalidFile && !hasInvalidCSVStructure && (
            <>
              <div className="text-dark-500 text-center text-base leading-[155%] font-light tracking-[-0.32px]">
                {t('pages.imports.step2.simple.fileRequirements')}
              </div>
              <div className="text-dark-500 flex items-center justify-center gap-1 self-stretch">
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {t('pages.imports.step2.simple.oneCsvOnly')}
                </span>
                <span className="text-base leading-[155%] font-light tracking-[-0.32px]">
                  {t('pages.imports.step2.simple.maxRows')}
                </span>
              </div>
              <div className="text-dark-500 flex items-center justify-center gap-1 self-stretch">
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {t('pages.imports.step2.simple.required')}:
                </span>{' '}
                {t('pages.imports.step2.simple.requiredColumns')}
              </div>
              <div className="text-dark-500 flex items-center justify-center gap-1 self-stretch">
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {t('pages.imports.step2.simple.optional')}:
                </span>{' '}
                {t('pages.imports.step2.simple.optionalColumns')}
              </div>
            </>
          )}
        </div>

        {/* Browse File Button */}
        <Button
          variant="outline"
          onClick={handleBrowseClick}
          disabled={isImportInProgress}
          className="flex h-12 flex-col items-center justify-center rounded-full text-sm"
        >
          {t('pages.imports.step2.simple.browseFile')}
        </Button>

        {/* Hidden File Input - removed accept restriction to allow all file types */}
        <input ref={fileInputRef} type="file" onChange={handleFileInputChange} className="hidden" />
      </div>

      {/* Action Buttons */}
      <div className="flex items-start justify-center gap-6">
        {/* Download Template Button */}
        <Button
          variant="white-secondary"
          onClick={handleDownloadTemplate}
          disabled={isImportInProgress}
          leftIcon={<Icons.FileDownload size={20} />}
          className="flex h-12 items-center justify-center rounded-full text-sm leading-[150%] font-medium"
        >
          {t('pages.imports.step2.simple.downloadSampleTemplate')}
        </Button>

        {/* Start Import Button - disabled when invalid file, invalid CSV structure, or no file */}
        <DoubleButton
          icon={
            isStartingImport ? (
              <svg
                className="h-6 w-6 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <Icons.ArrowRight02 size={24} />
            )
          }
          iconPosition="right"
          onClick={handleStartImport}
          disabled={
            !hasValidFile || hasInvalidCSVStructure || isImportInProgress || isStartingImport
          }
        >
          {t('pages.imports.step2.simple.startImport')}
        </DoubleButton>
      </div>
    </div>
  )
}
