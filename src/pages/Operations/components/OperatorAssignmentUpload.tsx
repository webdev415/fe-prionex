import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadOATemplate } from '@/features/imports/hooks/useOperatorAssignment'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function OperatorAssignmentUpload({ onFileSelected, isUploading }: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.operatorAssignment.upload'
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadOATemplate()

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        return t(`${p}.errors.onlyCsv`)
      }
      if (file.size > MAX_FILE_SIZE) {
        return t(`${p}.errors.fileTooLarge`, {
          size: (file.size / (1024 * 1024)).toFixed(1),
        })
      }
      return null
    },
    [t, p]
  )

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
    [onFileSelected, validateFile]
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
    [onFileSelected, validateFile]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-dark-500 text-lg font-medium">{t(`${p}.sectionTitle`)}</h3>
          <p className="text-sm text-gray-600">{t(`${p}.description`)}</p>
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
          {downloadTemplate.isPending ? t(`${p}.downloading`) : t(`${p}.downloadTemplate`)}
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
            <p className="text-sm text-gray-600">{t(`${p}.validating`)}</p>
          </div>
        ) : (
          <>
            <Icons.CloudDownload size={40} className="text-gray-400" />
            <p className="text-dark-500 mt-2 text-sm">
              <span className="text-secondary-700 font-medium">{t(`${p}.clickToUpload`)}</span>{' '}
              {t(`${p}.orDragAndDrop`)}
            </p>
            <p className="mt-1 text-xs text-gray-500">{t(`${p}.constraints`)}</p>
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
