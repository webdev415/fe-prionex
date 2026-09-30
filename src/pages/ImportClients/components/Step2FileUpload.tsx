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
import { useSellerFactoringAgreements } from '@/features/sellers'
import type { Step1Data } from './Step1LoanSource'
import { getErrorMessage } from '@/lib/errors'
import {
  buildNewFactoringAgreementJson,
  parseSaleTypeConflict,
  type SaleTypeConflict,
} from '../utils/newFactoringAgreement'

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
  /** 409 SALE_TYPE_CONFLICT on the new agreement — the wizard takes it back to step 1. */
  onSaleTypeConflict?: (conflict: SaleTypeConflict) => void
}

export function Step2FileUpload({
  data,
  onChange,
  isImportInProgress = false,
  step1Data,
  onImportStarted,
  onSaleTypeConflict,
}: Step2FileUploadProps) {
  const { t } = useTranslation('common')
  const [isDragging, setIsDragging] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Import mutations
  const uploadImportMutation = useUploadImport()

  // Look up factoring agreements for the selected seller. The picked
  // (or just-created) agreement's contract_purchase_date becomes the
  // batch's debts.purchase_date — there is no longer a separate
  // top-level Purchase date input in step 1.
  const sellerIdNumber = step1Data.sellerId ? parseInt(step1Data.sellerId, 10) : null
  // Same as Step1 — wizard needs the full agreement list, not a page,
  // and we skip include_count since debt_count is never displayed here.
  const { data: factoringAgreementsPage } = useSellerFactoringAgreements(sellerIdNumber, {
    limit: 1000,
    include_count: false,
  })
  const factoringAgreements = factoringAgreementsPage?.items ?? []

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
            .map((h) => h.trim().replace(/\*+$/, '').trim().toLowerCase())
            .filter((h) => h.length > 0)

          // Required columns (matching backend validation). The mobile phone
          // is required per-row by the backend (contact_type_id=1); flagging a
          // missing header here fails fast instead of letting every row fail
          // server-side. seller_company_legacy is intentionally NOT here — the
          // backend defaults it, so it is optional.
          const requiredColumns = [
            'clients_first_name',
            'clients_last_name',
            'clients_tax_id',
            'client_contacts_client_mobile_phone_contact_value',
            'debts_1_contract_number',
            'debts_1_remaining_debt_amount',
            'debts_1_seller_company_legacy',
          ]

          // Check for required columns (strip * from headers to support required markers)
          const missingColumns: string[] = []
          const headerSet = new Set(headers.map((h) => h.replace(/\*$/, '')))

          for (const reqCol of requiredColumns) {
            if (!headerSet.has(reqCol)) {
              missingColumns.push(reqCol)
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
    // Template download: tablename_columnname format matching import service
    const columns = [
      // clients (required marked with *)
      'clients_first_name*',
      'clients_last_name*',
      'clients_middle_name',
      'clients_date_of_birth',
      'clients_email',
      'clients_tax_id*',
      'clients_marital_status',
      'clients_family_members_count',
      'clients_income_level',
      'clients_sale_notes',
      // passport
      'client_passports_document_type',
      'client_passports_series',
      'client_passports_number',
      'client_passports_issued_by',
      'client_passports_issued_date',
      'client_passports_expires_date',
      // employment
      'client_employment_company_name',
      'client_employment_position',
      'client_employment_employment_type',
      'client_employment_work_experience_months',
      'client_employment_manager_full_name',
      'client_employment_work_phone',
      // addresses (registration)
      'client_addresses_registration_region',
      'client_addresses_registration_city',
      'client_addresses_registration_street',
      'client_addresses_registration_building',
      'client_addresses_registration_apartment',
      // addresses (actual)
      'client_addresses_actual_region',
      'client_addresses_actual_city',
      'client_addresses_actual_street',
      'client_addresses_actual_building',
      'client_addresses_actual_apartment',
      // contacts (common types) — mobile phone is required (contact_type_id=1)
      'client_contacts_client_mobile_phone_contact_value*',
      'client_contacts_client_mobile_phone_comment',
      'client_contacts_client_home_phone_contact_value',
      'client_contacts_client_home_phone_comment',
      'client_contacts_guarantor_mobile_phone_contact_value',
      'client_contacts_guarantor_mobile_phone_comment',
      'client_contacts_personal_email_contact_value',
      'client_contacts_personal_email_comment',
      // debt 1 (required: contract_number, remaining_debt_amount)
      'debts_1_contract_number*',
      'debts_1_remaining_debt_amount*',
      'debts_1_principal_amount',
      'debts_1_interest_amount',
      'debts_1_fees_amount',
      'debts_1_penalties_amount',
      'debts_1_fines_amount',
      'debts_1_credit_term_days',
      'debts_1_credit_issued_date',
      'debts_1_seller_company_legacy*',
      'debts_1_portfolio_name',
    ]

    const templateContent = columns.join(',') + '\n'

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8' })
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
    if (!data.csvFile || !step1Data.sellerId || !step1Data.projectCode) {
      setImportError(t('pages.imports.step2.simple.fillAllFields'))
      return
    }

    // Build factoring agreement payload — exactly one of the two fields
    // is set, controlled by Step 1's mode toggle.
    let factoringAgreementId: number | undefined
    let newFactoringAgreementJson: string | undefined
    // Derive the batch's purchase date from the agreement. Create-new
    // takes the operator-entered value; pick-existing inherits the
    // picked agreement's contract_purchase_date. Either way the wire
    // format is a plain YYYY-MM-DD string, which the BE stamps onto
    // every debt's debts.purchase_date.
    let effectivePurchaseDate: string | undefined
    if (step1Data.factoringAgreementMode === 'existing') {
      factoringAgreementId = step1Data.factoringAgreementId
        ? parseInt(step1Data.factoringAgreementId, 10)
        : undefined
      const pickedAgreement = factoringAgreements.find(
        (fa) => fa.id.toString() === step1Data.factoringAgreementId
      )
      effectivePurchaseDate = pickedAgreement?.contract_purchase_date || undefined
    } else {
      const newFa = step1Data.newFactoringAgreement
      newFactoringAgreementJson = buildNewFactoringAgreementJson(newFa)
      // effectivePurchaseDate keeps the UTC ISO format — batch_processor
      // already strips the time before stamping debts.purchase_date.
      effectivePurchaseDate = newFa.contract_purchase_date || undefined
    }

    try {
      const result = await uploadImportMutation.mutateAsync({
        file: data.csvFile,
        seller_id: parseInt(step1Data.sellerId, 10),
        project_code: step1Data.projectCode,
        purchase_date: effectivePurchaseDate,
        comment: step1Data.comment || undefined,
        import_type: 'simple',
        factoring_agreement_id: factoringAgreementId,
        new_factoring_agreement_json: newFactoringAgreementJson,
      })

      // Clear errors on success
      setImportError(null)
      // Only clear validation error on success, not before
      onChange({ csvValidationError: null })

      if (onImportStarted && result.job_id) {
        onImportStarted(result.job_id)
      }
    } catch (error) {
      // The new agreement's number is taken by one of another type — a step-1
      // decision, handed back there instead of shown as a file error. Only a
      // NEW agreement can conflict: in the existing mode a 409 keeps the usual
      // path. `step1Data` here is what this upload was sent with, even if the
      // operator has changed step 1 since.
      const saleTypeConflict =
        step1Data.factoringAgreementMode === 'new'
          ? parseSaleTypeConflict(error, {
              sellerId: step1Data.sellerId,
              agreementNumber: step1Data.newFactoringAgreement.agreement_number,
            })
          : null
      if (saleTypeConflict && onSaleTypeConflict) {
        onSaleTypeConflict(saleTypeConflict)
        return
      }

      // Handle validation errors from backend upload endpoint
      const errorMessage = getErrorMessage(error)
      setImportError(errorMessage)

      // Extract validation details from error response
      // Check if it's an Axios error (has response property)
      const isAxiosError = error && typeof error === 'object' && 'response' in error

      if (isAxiosError) {
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

        // Handle 401 Unauthorized - authentication error
        if (status === 401) {
          // Don't set csvValidationError for auth errors
          // The error message is already set in importError
          return // Exit early, don't process as validation error
        }

        // Handle FastAPI validation error format
        let detail = ''
        let missingColumns: string[] = []

        if (responseData) {
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

          // CRITICAL: Always call onChange to set csvValidationError
          onChange({
            csvValidationError: validationError,
            csvFile: data.csvFile, // Keep the file so error is visible
          })

          // state updated via onChange with validation error
        } else {
          // Not a 400 error; no CSV validation state update needed here
        }
      } else {
        // Check if error message indicates authentication issue
        if (
          errorMessage &&
          (errorMessage.includes('401') || errorMessage.includes('Unauthorized'))
        ) {
          // Don't set csvValidationError for auth errors
          return
        }
      }

      // Ensure we have an error message - fallback if extraction failed
      if (!errorMessage) {
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

  // Sync mutation error state with component error state - ALWAYS keep them in sync
  useEffect(() => {
    const mutationError = uploadImportMutation.error
    if (mutationError) {
      const errorMsg = getErrorMessage(mutationError)
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
    <div className="space-y-4 sm:space-y-6">
      {/* Section Title */}
      <h2 className="text-foreground mb-4 text-center text-xl leading-[120%] font-light tracking-[-0.48px] sm:mb-6 sm:text-2xl">
        {t('pages.imports.step2.simple.title')}
      </h2>

      {/* Warning Alert - shown when import is in progress */}
      {isImportInProgress && (
        <div className="bg-card flex items-center justify-center gap-2 rounded-lg p-4 sm:gap-3 sm:p-6">
          <Icons.Warning size={20} className="text-error-500 sm:size-6" />
          <span className="text-error-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
            {t('pages.imports.step2.simple.cannotStartAnother')}
          </span>
        </div>
      )}

      {/* Error Alert - shown when import fails - SIMPLIFIED CONDITION */}
      {(importError ||
        mutationErrorMsg ||
        uploadImportMutation.isError ||
        hasInvalidCSVStructure) && (
        <div className="border-error-500 bg-card mb-4 flex items-center justify-center gap-2 rounded-lg border-2 p-4 sm:gap-3 sm:p-6">
          <Icons.Warning size={20} className="text-error-500 sm:size-6" />
          <span className="text-error-500 text-xs leading-[150%] font-medium tracking-[-0.28px] sm:text-sm">
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
          'relative flex flex-col items-center gap-4 self-stretch rounded-lg border-2 border-dashed p-4 transition-colors sm:gap-6 sm:p-6',
          isDragging ? 'border-primary-500 bg-muted' : 'border-border',
          isImportInProgress && 'pointer-events-none opacity-50' // Disable when import in progress
        )}
        onDragOver={isImportInProgress ? undefined : handleDragOver}
        onDragLeave={isImportInProgress ? undefined : handleDragLeave}
        onDrop={isImportInProgress ? undefined : handleDrop}
      >
        {/* CSV Error Icon - shown when invalid CSV structure */}
        {hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.Csv02 size={40} strokeWidth={0.5} className="text-error-500 sm:size-12" />
          </div>
        )}

        {/* Error Icon - shown when invalid file type */}
        {hasInvalidFile && !hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.FileRemove size={40} strokeWidth={0.5} className="text-error-500 sm:size-12" />
          </div>
        )}

        {/* Cloud Icon - shown when no file or valid file */}
        {!hasInvalidFile && !hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.CloudDownload
              size={40}
              strokeWidth={0.5}
              className="text-foreground sm:size-12"
            />
          </div>
        )}

        <div className="align-self-stretch flex flex-col items-center justify-center gap-3 sm:gap-4">
          {/* Invalid CSV Structure Error Message */}
          {hasInvalidCSVStructure && (
            <div className="text-error-500 text-center text-lg leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
              {t('pages.imports.step2.simple.invalidCsvStructure')}
            </div>
          )}

          {/* Invalid File Type Error Message */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div className="text-error-500 text-center text-lg leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
              {t('pages.imports.step2.simple.invalidFileType')}
            </div>
          )}

          {/* File Name Display */}
          {displayFile ? (
            <div className="text-foreground text-center text-sm leading-[155%] font-light tracking-[-0.32px] break-words sm:text-base">
              {displayFile.name} ({formatFileSize(displayFile.size)})
            </div>
          ) : (
            !hasInvalidCSVStructure && (
              <div className="text-foreground text-center text-lg leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
                {t('pages.imports.step2.simple.chooseCsvFile')}
              </div>
            )
          )}

          {/* Show "Choose CSV File" text even when invalid CSV structure */}
          {hasInvalidCSVStructure && (
            <div className="text-foreground text-center text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
              {t('pages.imports.step2.simple.chooseCsvFile')}
            </div>
          )}

          {/* Missing Required Columns - shown when invalid CSV structure and backend provides columns */}
          {hasInvalidCSVStructure &&
            data.csvValidationError?.missingColumns &&
            data.csvValidationError.missingColumns.length > 0 && (
              <div className="flex w-full flex-col items-center gap-2 sm:gap-3">
                <div className="text-foreground text-center text-sm leading-[155%] font-bold tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.missingRequiredColumns')}
                </div>
                <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
                  {data.csvValidationError.missingColumns.map((column) => {
                    // Format column name for display
                    // e.g. clients_first_name -> first_name, debts_1_contract_number -> debts_1_contract_number
                    const stripped = column.replace(/^clients_/, '').replace(/^client_\w+_/, '')
                    const formattedName = stripped
                      .split('_')
                      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                      .join(' ')

                    return (
                      <div key={column} className="flex items-center gap-1.5 sm:gap-2">
                        <Icons.Close size={14} className="text-error-500 sm:size-4" />
                        <span className="text-error-500 text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
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
              <div className="text-error-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] break-words sm:text-base">
                {data.csvValidationError.errorMessage}
              </div>
            )}

          {/* Error Message - Only .csv files supported */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div className="text-foreground text-center text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
              {t('pages.imports.step2.simple.onlyCsvSupported')}
            </div>
          )}

          {/* File Requirements - hidden when invalid file or invalid CSV structure */}
          {!hasInvalidFile && !hasInvalidCSVStructure && (
            <>
              <div className="text-foreground text-center text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                {t('pages.imports.step2.simple.fileRequirements')}
              </div>
              <div className="text-foreground flex flex-wrap items-center justify-center gap-1 self-stretch text-center">
                <span className="text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.oneCsvOnly')}
                </span>
                <span className="text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.maxRows')}
                </span>
              </div>
              <div className="text-foreground flex flex-wrap items-center justify-center gap-1 self-stretch text-center">
                <span className="text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.required')}:
                </span>{' '}
                <span className="text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.requiredColumns')}
                </span>
              </div>
              <div className="text-foreground flex flex-wrap items-center justify-center gap-1 self-stretch text-center">
                <span className="text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.optional')}:
                </span>{' '}
                <span className="text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.imports.step2.simple.optionalColumns')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Browse File Button */}
        <Button
          variant="outline"
          onClick={handleBrowseClick}
          disabled={isImportInProgress}
          className="flex h-10 w-full flex-col items-center justify-center rounded-full text-xs sm:h-12 sm:w-auto sm:text-sm"
        >
          {t('pages.imports.step2.simple.browseFile')}
        </Button>

        {/* Hidden File Input - removed accept restriction to allow all file types */}
        <input ref={fileInputRef} type="file" onChange={handleFileInputChange} className="hidden" />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-start sm:gap-6">
        {/* Download Template Button */}
        <Button
          variant="white-secondary"
          onClick={handleDownloadTemplate}
          disabled={isImportInProgress}
          leftIcon={<Icons.FileDownload size={20} />}
          className="flex h-10 w-full items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto sm:text-sm"
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
          className="justify-center"
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
