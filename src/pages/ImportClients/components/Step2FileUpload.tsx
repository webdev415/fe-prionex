/**
 * Step2FileUpload Component
 *
 * File upload component for Step 2 of the Import Clients wizard
 * Handles CSV file upload with drag and drop functionality
 */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
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
}

export function Step2FileUpload({ data, onChange }: Step2FileUploadProps) {
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
      <h2
        className="mb-6 font-medium"
        style={{
          fontSize: '24px',
          fontWeight: 300,
          color: colors.neutral.dark[500],
          lineHeight: '120%',
          textAlign: 'center',
          letterSpacing: '-0.48px',
        }}
      >
        Import Client Data (Simple CSV)
      </h2>

      {/* File Upload Drop Zone */}
      <div
        className={cn(
          'relative flex flex-col items-center gap-6 self-stretch rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          padding: '24px',
        }}
      >
        {/* CSV Error Icon - shown when invalid CSV structure */}
        {hasInvalidCSVStructure && (
          <div
            style={{
              display: 'flex',
              padding: '6px 4px',
              justifyContent: 'center',
              alignItems: 'center',
              aspectRatio: '1/1',
            }}
          >
            <Icons.Csv02 size={48} strokeWidth={0.5} color="#EF4444" />
          </div>
        )}

        {/* Error Icon - shown when invalid file type */}
        {hasInvalidFile && !hasInvalidCSVStructure && (
          <div
            style={{
              display: 'flex',
              padding: '6px 4px',
              justifyContent: 'center',
              alignItems: 'center',
              aspectRatio: '1/1',
            }}
          >
            <Icons.FileRemove size={48} strokeWidth={0.5} color="#EF4444" />
          </div>
        )}

        {/* Cloud Icon - shown when no file or valid file */}
        {!hasInvalidFile && !hasInvalidCSVStructure && (
          <div
            className=""
            style={{
              display: 'flex',
              padding: '6px 4px',
              justifyContent: 'center',
              alignItems: 'center',
              aspectRatio: '1/1',
            }}
          >
            <Icons.CloudDownload
              size={48}
              color={colors.neutral.dark[500]}
              strokeWidth={0.5}
              stroke={colors.neutral.dark[500]}
            />
          </div>
        )}

        <div className="align-self-stretch flex flex-col items-center justify-center gap-4">
          {/* Invalid CSV Structure Error Message */}
          {hasInvalidCSVStructure && (
            <div
              style={{
                fontSize: '24px',
                fontWeight: 300,
                lineHeight: '120%',
                letterSpacing: '-0.48px',
                textAlign: 'center',
                color: '#EF4444', // Red color for error
              }}
            >
              Invalid CSV structure
            </div>
          )}

          {/* Invalid File Type Error Message */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div
              style={{
                fontSize: '24px',
                fontWeight: 300,
                lineHeight: '120%',
                letterSpacing: '-0.48px',
                textAlign: 'center',
                color: '#EF4444', // Red color for error
              }}
            >
              Invalid file type
            </div>
          )}

          {/* File Name Display */}
          {displayFile ? (
            <div
              style={{
                fontSize: '16px',
                fontWeight: 300,
                lineHeight: '155%',
                letterSpacing: '-0.32px',
                textAlign: 'center',
                color: colors.neutral.dark[500],
              }}
            >
              {displayFile.name} ({formatFileSize(displayFile.size)})
            </div>
          ) : (
            !hasInvalidCSVStructure && (
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 300,
                  lineHeight: '120%',
                  letterSpacing: '-0.48px',
                  textAlign: 'center',
                  color: colors.neutral.dark[500],
                }}
              >
                Choose CSV File
              </div>
            )
          )}

          {/* Show "Choose CSV File" text even when invalid CSV structure */}
          {hasInvalidCSVStructure && (
            <div
              style={{
                fontSize: '16px',
                fontWeight: 300,
                lineHeight: '155%',
                letterSpacing: '-0.32px',
                textAlign: 'center',
                color: colors.neutral.dark[500],
              }}
            >
              Choose CSV File
            </div>
          )}

          {/* Missing Required Columns - shown when invalid CSV structure */}
          {hasInvalidCSVStructure && data.csvValidationError?.missingColumns && data.csvValidationError.missingColumns.length > 0 && (
            <div className="flex flex-col items-center gap-3 w-full">
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  lineHeight: '155%',
                  letterSpacing: '-0.32px',
                  textAlign: 'center',
                  color: colors.neutral.dark[500],
                }}
              >
                Missing required columns:
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                {data.csvValidationError.missingColumns.map((column) => (
                  <div
                    key={column}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5"
                  >
                    <Icons.Close size={16} color="#EF4444" />
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 300,
                        color: '#EF4444',
                        textTransform: 'capitalize',
                        lineHeight: '155%',
                        letterSpacing: '-0.32px',
                      }}
                    >
                      {column.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message - Only .csv files supported */}
          {hasInvalidFile && !hasInvalidCSVStructure && (
            <div
              style={{
                fontSize: '16px',
                fontWeight: 500,
                lineHeight: '155%',
                letterSpacing: '-0.32px',
                textAlign: 'center',
                color: colors.neutral.dark[500],
              }}
            >
              Only .csv files are supported in this version.
            </div>
          )}

          {/* File Requirements - hidden when invalid file or invalid CSV structure */}
          {!hasInvalidFile && !hasInvalidCSVStructure && (
            <>
              <div className="font-lexend text-center text-[16px] leading-[155%] font-light tracking-[-0.32px] text-[#05040D]">
                File Requirements:
              </div>
              <div
                className="flex items-center justify-center gap-1 self-stretch"
                style={{ color: colors.neutral.dark[500] }}
              >
                <span className="font-lexend text-[16px] leading-[155%] font-medium tracking-[-0.32px]">
                  One CSV
                </span>{' '}
                only,{' '}
                <span className="font-lexend text-[16px] leading-[155%] font-light tracking-[-0.32px]">
                  max 50,000 rows
                </span>
              </div>
              <div
                className="flex items-center justify-center gap-1 self-stretch"
                style={{ color: colors.neutral.dark[500] }}
              >
                <span className="font-lexend text-[16px] leading-[155%] font-medium tracking-[-0.32px]">
                  Required:
                </span>{' '}
                name, phone, debt_amount
              </div>
              <div
                className="flex items-center justify-center gap-1 self-stretch"
                style={{ color: colors.neutral.dark[500] }}
              >
                <span className="font-lexend text-[16px] leading-[155%] font-medium tracking-[-0.32px]">
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
          className="flex h-12 flex-col items-center justify-center gap-[10px] rounded-full border border-[#888] px-[20px] py-[12px]"
          style={{
            color: colors.neutral.dark[500],
            fontSize: '14px',
          }}
        >
          {isValidating ? 'Validating...' : 'Browse File'}
        </Button>

        {/* Hidden File Input - removed accept restriction to allow all file types */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-start justify-center gap-6">
        {/* Download Template Button */}
        <Button
          variant="outline"
          onClick={handleDownloadTemplate}
          leftIcon={<Icons.FileDownload size={20} color={colors.secondary[800]} />}
          style={{
            display: 'flex',
            borderColor: '#FFFFFF',
            backgroundColor: '#FFFFFF',
            color: colors.secondary[800],
            borderRadius: '9999px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: '150%',
            justifyContent: 'center',
            alignItems: 'center',
            height: '48px',
          }}
        >
          Download Sample CSV Template
        </Button>

        {/* Start Import Button - disabled when invalid file, invalid CSV structure, or no file */}
        <Button
          variant="primary"
          onClick={() => {
            if (hasValidFile && !hasInvalidCSVStructure) handleStartImport()
          }}
        //   disabled={!hasValidFile || hasInvalidCSVStructure}
          style={{
            display: 'flex',
            backgroundColor: hasValidFile && !hasInvalidCSVStructure ? colors.secondary[800] : colors.gray[200], // #204E4D when enabled
            color: hasValidFile && !hasInvalidCSVStructure ? '#FFFFFF' : colors.gray[600],
            borderRadius: '9999px', // Pill shape
            padding: '4px 4px 4px 24px',
            lineHeight: '150%',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '500',
            gap: '10px',
            height: '48px',
            cursor: hasValidFile && !hasInvalidCSVStructure ? 'pointer' : 'not-allowed',
          }}
        >
          <span>Start Import</span>
          {/* Circular icon with arrow - matching Next Step button design */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: hasValidFile && !hasInvalidCSVStructure ? colors.primary[300] : colors.gray[600], // #BBFB5B when enabled
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icons.ArrowRight02 size={24} color={hasValidFile && !hasInvalidCSVStructure ? colors.neutral.dark[500] : colors.gray[500]} />
          </div>
        </Button>
      </div>
    </div>
  )
}
