/**
 * Step2VendorDump Component
 *
 * File upload component for Step 2B of the Import Clients wizard (Vendor Dump)
 * Handles multiple CSV files and documents upload with drag and drop functionality
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import { cn } from '@/lib/utils'

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
}

const INITIAL_DATASETS: Omit<DatasetFile, 'id'>[] = [
  { type: 'users', name: 'Users', status: 'required', file: null },
  { type: 'loans', name: 'Loans', status: 'required', file: null },
  { type: 'charges', name: 'Charges', status: 'optional', file: null },
  { type: 'payments', name: 'Payments', status: 'optional', file: null },
  { type: 'documents', name: 'Documents', status: 'optional', file: null },
]

export function Step2VendorDump({ data, onChange, isImportInProgress = false }: Step2VendorDumpProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const browseFileInputRef = useRef<HTMLInputElement | null>(null)

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
    const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'))
    
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
        const usersIndex = updatedFiles.findIndex(f => f.type === 'users')
        if (usersIndex !== -1) updatedFiles[usersIndex].file = file
      } else if (fileName.includes('loans') || fileName.includes('loan')) {
        const loansIndex = updatedFiles.findIndex(f => f.type === 'loans')
        if (loansIndex !== -1) updatedFiles[loansIndex].file = file
      } else if (fileName.includes('charges') || fileName.includes('charge')) {
        const chargesIndex = updatedFiles.findIndex(f => f.type === 'charges')
        if (chargesIndex !== -1) updatedFiles[chargesIndex].file = file
      } else if (fileName.includes('payments') || fileName.includes('payment')) {
        const paymentsIndex = updatedFiles.findIndex(f => f.type === 'payments')
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

    const updatedFiles = data.files.map((f) =>
      f.type === type ? { ...f, file } : f
    )
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

  const handleStartImport = () => {
    // TODO: Implement import functionality
    console.log('Start vendor dump import with files:', data.files, data.zipFile)
  }

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const requiredFilesSelected = data.files.length > 0 && data.files
    .filter(f => f.status === 'required')
    .every(f => f.file !== null)

  const columns: Column<DatasetFile>[] = [
    {
      key: 'name',
      header: 'Dataset',
      render: (item) => (
        <span style={{ fontSize: '12px', fontWeight: 500, color: colors.neutral.dark[500] }}>
          {item.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: item.status === 'required' ? '#EF4444' : colors.gray[500],
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: colors.neutral.dark[500],
            }}
          >
            {item.status === 'required' ? 'Required' : 'Optional'}
          </span>
        </div>
      ),
    },
    {
      key: 'file',
      header: 'File',
      render: (item) => {
        const isDocuments = item.type === 'documents'
        const hasFile = item.file !== null
        
        return (
          <div className="flex items-center gap-2">
            {hasFile ? (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: colors.neutral.dark[500],
                }}
              >
                {item.file?.name} ({formatFileSize(item.file?.size || 0)})
              </span>
            ) : (
              <Button
                variant="outline"
                onClick={() => handleBrowseClick(item.type)}
                disabled={isImportInProgress}
                style={{
                  borderColor: '#888',
                  backgroundColor: '#FFFFFF',
                  color: colors.neutral.dark[500],
                  borderRadius: '9999px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  height: '32px',
                }}
              >
                {isDocuments ? 'Choose ZIP' : 'Choose file'}
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
        Upload raw export from seller.
      </h2>

      {/* Instructions */}
      <p
        className="text-center mb-6"
        style={{
          fontSize: '16px',
          fontWeight: 300,
          color: colors.neutral.dark[500],
          lineHeight: '155%',
          letterSpacing: '-0.32px',
        }}
      >
        Drag the CSVs and contracts folder, or one .zip.
      </p>

      {/* File Upload Drop Zone */}
      <div
        className={cn(
          'relative flex flex-col items-center gap-6 self-stretch rounded-lg border-2 border-dashed p-6 transition-colors',
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300',
          isImportInProgress && 'opacity-50 pointer-events-none'
        )}
        onDragOver={isImportInProgress ? undefined : handleDragOver}
        onDragLeave={isImportInProgress ? undefined : handleDragLeave}
        onDrop={isImportInProgress ? undefined : handleDrop}
        style={{
          padding: '48px 24px',
        }}
      >
        {/* Cloud Icon */}
        <div
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

        <div className="align-self-stretch flex flex-col items-center justify-center gap-4">
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
            Drag & drop files/folder here
          </div>

          {/* Browse File Button */}
          <Button
            variant="outline"
            onClick={() => handleBrowseClick()}
            disabled={isImportInProgress}
            className="flex h-12 flex-col items-center justify-center gap-[10px] rounded-full border border-[#888] px-[20px] py-[12px]"
            style={{
              color: colors.neutral.dark[500],
              fontSize: '14px',
            }}
          >
            Browse File
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
      <div className="mt-6">
        <DataTable
          columns={columns}
          data={data.files}
          emptyMessage="No datasets configured"
        />
      </div>

      {/* Start Import Button */}
      <div className="flex justify-center mt-8">
        <Button
          variant="primary"
          onClick={handleStartImport}
          disabled={!requiredFilesSelected || isImportInProgress}
          style={{
            display: 'flex',
            backgroundColor: requiredFilesSelected && !isImportInProgress ? colors.secondary[800] : colors.gray[200],
            color: requiredFilesSelected && !isImportInProgress ? '#FFFFFF' : colors.gray[600],
            borderRadius: '9999px',
            padding: '4px 4px 4px 24px',
            lineHeight: '150%',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '500',
            gap: '10px',
            height: '48px',
            cursor: requiredFilesSelected && !isImportInProgress ? 'pointer' : 'not-allowed',
          }}
        >
          <span>Start Import</span>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: requiredFilesSelected && !isImportInProgress ? colors.primary[300] : colors.gray[600],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icons.ArrowRight02
              size={24}
              color={requiredFilesSelected && !isImportInProgress ? colors.neutral.dark[500] : colors.gray[500]}
            />
          </div>
        </Button>
      </div>
    </div>
  )
}
