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

export interface Step2Data {
  csvFile: File | null
  invalidFile: File | null // Track invalid file separately
}

export interface Step2FileUploadProps {
  data: Step2Data
  onChange: (data: Partial<Step2Data>) => void
}

export function Step2FileUpload({ data, onChange }: Step2FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isFileValid = (file: File): boolean => {
    return file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
  }

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      onChange({ csvFile: null, invalidFile: null })
      return
    }

    if (isFileValid(file)) {
      // Valid CSV file
      onChange({ csvFile: file, invalidFile: null })
    } else {
      // Invalid file type
      onChange({ csvFile: null, invalidFile: file })
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
  const currentFile = data.csvFile || data.invalidFile

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
        {/* Error Icon - shown when invalid file */}
        {hasInvalidFile && (
          <div
            style={{
              display: 'flex',
              padding: '6px 4px',
              justifyContent: 'center',
              alignItems: 'center',
              aspectRatio: '1/1',
            }}
            >
            <Icons.FileRemove size={48} color="#EF4444" />
          </div>
        )}

        {/* Cloud Icon - shown when no file or valid file */}
        {!hasInvalidFile && (
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
          {/* Error Message - shown when invalid file */}
          {hasInvalidFile && (
            <div
              style={{
                fontSize: '16px',
                fontWeight: 500,
                lineHeight: '155%',
                letterSpacing: '-0.32px',
                textAlign: 'center',
                color: '#EF4444', // Red color for error
              }}
            >
              Invalid file type
            </div>
          )}

          {/* File Name Display */}
          {currentFile ? (
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
              {currentFile.name} ({formatFileSize(currentFile.size)})
            </div>
          ) : (
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
          )}

          {/* Error Message - Only .csv files supported */}
          {hasInvalidFile && (
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
              Only .csv files are supported in this version.
            </div>
          )}

          {/* File Requirements - hidden when invalid file */}
          {!hasInvalidFile && (
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
          className="flex h-12 flex-col items-center justify-center gap-[10px] rounded-full border border-[#888] px-[20px] py-[12px]"
          style={{
            color: colors.neutral.dark[500],
            fontSize: '14px',
          }}
        >
          Browse File
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

        {/* Start Import Button - disabled when invalid file or no file */}
        <Button
          variant="primary"
          onClick={() => {
            if (hasValidFile) handleStartImport()
          }}
        //   disabled={!hasValidFile}
          style={{
            display: 'flex',
            backgroundColor: hasValidFile ? colors.secondary[800] : colors.gray[200], // #204E4D when enabled
            color: hasValidFile ? '#FFFFFF' : colors.gray[600],
            borderRadius: '9999px', // Pill shape
            padding: '4px 4px 4px 24px',
            lineHeight: '150%',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '500',
            gap: '10px',
            height: '48px',
            cursor: hasValidFile ? 'pointer' : 'not-allowed',
          }}
        >
          <span>Start Import</span>
          {/* Circular icon with arrow - matching Next Step button design */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: hasValidFile ? colors.primary[300] : colors.gray[600], // #BBFB5B when enabled
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icons.ArrowRight02 size={24} color={hasValidFile ? colors.neutral.dark[500] : colors.gray[500]} />
          </div>
        </Button>
      </div>
    </div>
  )
}
