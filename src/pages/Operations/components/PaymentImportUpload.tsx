import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadPaymentImportTemplate } from '@/features/imports/hooks/usePaymentImport'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function PaymentImportUpload({ onFileSelected, isUploading }: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.bulkPaymentVerification.upload'
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadPaymentImportTemplate()

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
          <h3 className="text-foreground text-lg font-medium">{t(`${p}.sectionTitle`)}</h3>
          <p className="text-muted-foreground text-sm">
            {t(`${p}.descriptionIntro`)}{' '}
            <code className="bg-muted rounded px-1 text-xs">loan_number</code>,{' '}
            <code className="bg-muted rounded px-1 text-xs">tin</code>,{' '}
            <code className="bg-muted rounded px-1 text-xs">payment_amount</code>,{' '}
            <code className="bg-muted rounded px-1 text-xs">payment_date</code>.{' '}
            {t(`${p}.optionalIntro`)}{' '}
            <code className="bg-muted rounded px-1 text-xs">payment_method</code>,{' '}
            <code className="bg-muted rounded px-1 text-xs">payment_type</code>
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
        className={`focus:ring-primary-500 focus:ring-offset-card relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
          dragActive ? 'border-primary-500 bg-muted' : 'border-border hover:bg-muted/50'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Icons.Spinner className="h-8 w-8" />
            <p className="text-muted-foreground text-sm">{t(`${p}.validating`)}</p>
          </div>
        ) : (
          <>
            <Icons.CloudDownload size={40} className="text-muted-foreground" />
            <p className="text-foreground mt-2 text-sm">
              <span className="text-primary-600 font-medium">{t(`${p}.clickToUpload`)}</span>{' '}
              {t(`${p}.orDragAndDrop`)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{t(`${p}.constraints`)}</p>
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
