import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadSaleNotesTemplate } from '@/features/imports/hooks/useSaleNotes'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function SaleNotesUpload({ onFileSelected, isUploading }: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.saleNotes.upload'
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadSaleNotesTemplate()

  const validateFile = useCallback(
    (file: File): string | null => {
      const lower = file.name.toLowerCase()
      if (!(lower.endsWith('.csv') || lower.endsWith('.xlsx'))) {
        return t(`${p}.errors.onlyCsvOrXlsx`, 'Only CSV or Excel (.xlsx) files are accepted.')
      }
      if (file.size > MAX_FILE_SIZE) {
        return t(`${p}.errors.fileTooLarge`, {
          defaultValue: 'File too large ({{size}} MB). Maximum is 10 MB.',
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
          <h3 className="text-foreground text-lg font-medium">
            {t(`${p}.sectionTitle`, 'Upload sale notes CSV')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t(
              `${p}.description`,
              'Each row: client_id, sale_date (DD.MM.YYYY), comment (HTML allowed). One note per row, appended to client_sale_notes.'
            )}
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
          {downloadTemplate.isPending
            ? t(`${p}.downloading`, 'Downloading…')
            : t(`${p}.downloadTemplate`, 'Download Template')}
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
        className={`focus:ring-primary-500 focus:ring-offset-card relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
          dragActive ? 'border-primary-500 bg-muted' : 'border-border hover:bg-muted/50'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Icons.Spinner className="h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              {t(`${p}.validating`, 'Validating file…')}
            </p>
          </div>
        ) : (
          <>
            <Icons.CloudDownload size={40} className="text-muted-foreground" />
            <p className="text-foreground mt-2 text-sm">
              <span className="text-primary-600 font-medium">
                {t(`${p}.clickToUpload`, 'Click to upload')}
              </span>{' '}
              {t(`${p}.orDragAndDrop`, 'or drag and drop')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t(`${p}.constraints`, 'CSV or Excel (.xlsx). 10 MB max, 10,000 rows.')}
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
