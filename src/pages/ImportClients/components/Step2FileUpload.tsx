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
import api from '@/lib/api'

export interface Step2Data {
  csvFile: File | null
  invalidFile: File | null // Track invalid file type
  csvValidationError: {
    isValid: boolean
    missingColumns: string[]
  } | null // Track CSV structure validation errors
}

export interface Step2FileUploadProps {
  data: Step2Data
  onChange: (data: Partial<Step2Data>) => void
  isImportInProgress?: boolean // Add this prop to track active imports
}

export function Step2FileUpload({
  data,
  onChange,
  isImportInProgress = false,
}: Step2FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFileValid = (file: File): boolean => {
    return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  }

  // Validate CSV structure with backend
  const validateCSVStructure = async (file: File) => {
    setIsValidating(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post<{
        is_valid: boolean
        missing_columns?: string[]
      }>('/api/v1/clients/validate-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.is_valid) {
        // CSV structure is valid
        onChange({
          csvFile: file,
          invalidFile: null,
          csvValidationError: null,
        })
      } else {
        // CSV structure is invalid - missing required columns
        onChange({
          csvFile: file, // Store the file so we can display its name
          invalidFile: null,
          csvValidationError: {
            isValid: false,
            missingColumns: response.data.missing_columns || [],
          },
        })
      }
    } catch (error) {
      // Handle API error - treat as invalid structure for now
      console.error('CSV validation error:', error)
      onChange({
        csvFile: null,
        invalidFile: null,
        csvValidationError: {
          isValid: false,
          missingColumns: ['name', 'phone', 'debt_amount'], // Default missing columns
        },
      })
    } finally {
      setIsValidating(false)
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
    // TODO: Implement template download
    console.log('Download template')
  }

  const handleStartImport = () => {
    // TODO: Implement import functionality
    console.log('Start import with file:', data.csvFile)
  }

  // Format file size to MB
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const hasValidFile = !!data.csvFile
  const hasInvalidFile = !!data.invalidFile
  const hasInvalidCSVStructure = !!data.csvValidationError && !data.csvValidationError.isValid

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
          <Icons.Warning size={24} className="text-red-500" />
          <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-red-500">
            You cannot start another import until this one finishes.
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
            <Icons.Csv02 size={48} strokeWidth={0.5} className="text-red-500" />
          </div>
        )}

        {/* Error Icon - shown when invalid file type */}
        {hasInvalidFile && !hasInvalidCSVStructure && (
          <div className="flex aspect-square items-center justify-center px-1 py-1.5">
            <Icons.FileRemove size={48} strokeWidth={0.5} className="text-red-500" />
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
            <div className="text-center text-2xl leading-[120%] font-light tracking-[-0.48px] text-red-500">
              Invalid CSV structure
            </div>
          )}

          {/* Invalid File Type Error Message */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div className="text-center text-2xl leading-[120%] font-light tracking-[-0.48px] text-red-500">
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

          {/* Missing Required Columns - shown when invalid CSV structure */}
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
                      <Icons.Close size={16} className="text-red-500" />
                      <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-red-500 capitalize">
                        {column.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
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
          disabled={isValidating}
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
          onClick={() => {
            if (hasValidFile && !hasInvalidCSVStructure && !isImportInProgress) handleStartImport()
          }}
          //   disabled={!hasValidFile || hasInvalidCSVStructure || isImportInProgress}
          className={cn(
            'flex h-12 items-center justify-center gap-2.5 rounded-full py-1 pr-1 pl-6 text-sm leading-[150%] font-medium',
            hasValidFile && !hasInvalidCSVStructure && !isImportInProgress
              ? 'bg-secondary-800 cursor-pointer text-white'
              : 'cursor-not-allowed bg-gray-200 text-gray-600'
          )}
        >
          <span>Start Import</span>
          {/* Circular icon with arrow - matching Next Step button design */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              hasValidFile && !hasInvalidCSVStructure && !isImportInProgress
                ? 'bg-primary-300'
                : 'bg-gray-600'
            )}
          >
            <Icons.ArrowRight02
              size={24}
              className={cn(
                hasValidFile && !hasInvalidCSVStructure && !isImportInProgress
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
