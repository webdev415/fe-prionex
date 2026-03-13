import { useCallback, useRef, useState } from 'react'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadOATemplate } from '@/features/imports/hooks/useOperatorAssignment'

interface Props {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function OperatorAssignmentUpload({ onFileSelected, isUploading }: Props) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadOATemplate()

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
      if (file && file.name.toLowerCase().endsWith('.csv')) {
        onFileSelected(file)
      }
    },
    [onFileSelected]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onFileSelected(file)
      }
      // Reset input so same file can be selected again
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
          <h3 className="text-dark-500 text-lg font-medium">Upload CSV File</h3>
          <p className="text-sm text-gray-600">
            CSV with <code className="rounded bg-gray-100 px-1 text-xs">client_id</code> and{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">operator_id</code> columns
          </p>
        </div>
        <Button
          variant="white-secondary"
          size="sm"
          onClick={() => downloadTemplate.mutate()}
          disabled={downloadTemplate.isPending}
          leftIcon={<Icons.Download size={16} />}
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
        className={`relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          dragActive
            ? 'border-secondary-500 bg-secondary-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Icons.Spinner className="h-8 w-8" />
            <p className="text-sm text-gray-600">Validating CSV...</p>
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
