import { useCallback, useRef, useState } from 'react'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadPaymentImportTemplate } from '@/features/imports/hooks/usePaymentImport'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return 'Only CSV files are supported.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File exceeds maximum size of 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
  }
  return null
}

export function PaymentImportUpload({ onFileSelected, isUploading }: Props) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadPaymentImportTemplate()

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      const file = e.dataTransfer.files?.[0]
      if (!file) return
      const error = validateFile(file)
      if (error) {
        toast.error(error)
        return
      }
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        const error = validateFile(file)
        if (error) {
          toast.error(error)
        } else {
          onFileSelected(file)
        }
      }
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    [onFileSelected]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-dark-500 text-lg font-medium">Upload Bank CSV</h3>
          <p className="text-sm text-gray-600">
            Verifies existing pending payments. Required columns:{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">loan_number</code>,{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">payment_amount</code>,{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">payment_date</code>. Optional:{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">payment_method</code>,{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">payment_type</code>
          </p>
        </div>
        <Button
          variant="white-secondary"
          size="sm"
          onClick={() => downloadTemplate.mutate()}
          disabled={downloadTemplate.isPending}
          leftIcon={
            downloadTemplate.isPending ? (
              <Icons.Spinner className="h-4 w-4" />
            ) : (
              <Icons.Download size={16} />
            )
          }
        >
          {downloadTemplate.isPending ? 'Downloading...' : 'Download Template'}
        </Button>
      </div>

      <div
        role="button"
        tabIndex={0}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        className={`focus:ring-secondary-500 relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
          dragActive
            ? 'border-secondary-500 bg-secondary-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Icons.Spinner className="h-8 w-8" />
            <p className="text-sm text-gray-600">Validating CSV and resolving contracts...</p>
          </div>
        ) : (
          <>
            <Icons.CloudDownload size={40} className="text-gray-400" />
            <p className="text-dark-500 mt-2 text-sm">
              <span className="text-secondary-700 font-medium">Click to upload</span> or drag and
              drop
            </p>
            <p className="mt-1 text-xs text-gray-500">CSV only, max 10 MB, max 10,000 rows</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
