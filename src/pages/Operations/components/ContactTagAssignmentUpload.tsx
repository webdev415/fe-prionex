import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadContactTagAssignmentTemplate } from '@/features/imports/hooks/useContactTagAssignment'
import type { ContactTagAssignmentMode } from '@/features/imports/types/contactTagAssignment'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB, mirrors MAX_CONTACT_TAG_FILE_SIZE

interface Props {
  mode: ContactTagAssignmentMode
  onModeChange: (mode: ContactTagAssignmentMode) => void
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function ContactTagAssignmentUpload({
  mode,
  onModeChange,
  onFileSelected,
  isUploading,
}: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.contactTagAssignment.upload'
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadContactTagAssignmentTemplate()

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
          <h3 className="text-dark-500 text-lg font-medium">
            {t(`${p}.sectionTitle`, 'Upload contact tag file')}
          </h3>
          <p className="text-sm text-gray-600">
            {t(
              `${p}.description`,
              'Each row: tin, contact_value, category, tag. The tag cell may hold several comma-separated values, all belonging to that row’s category.'
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

      {/* Mode toggle */}
      <div className="flex flex-col gap-2">
        <label className="text-dark-500 text-sm font-medium">
          {t(`${p}.modeLabel`, 'Operation')}
        </label>
        <div className="inline-flex w-full overflow-hidden rounded-lg border border-gray-200 bg-white sm:w-fit">
          <button
            type="button"
            onClick={() => onModeChange('assign')}
            disabled={isUploading}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'assign' ? 'bg-secondary-700 text-white' : 'text-dark-500 hover:bg-gray-50'
            }`}
          >
            {t(`${p}.modeAssign`, 'Assign values')}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('remove')}
            disabled={isUploading}
            className={`border-l border-gray-200 px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'remove' ? 'bg-error-600 text-white' : 'text-dark-500 hover:bg-gray-50'
            }`}
          >
            {t(`${p}.modeRemove`, 'Remove values')}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {mode === 'assign'
            ? t(
                `${p}.modeAssignHint`,
                'Multi-select categories add the listed values to what is already there. Single-select categories replace the existing value.'
              )
            : t(
                `${p}.modeRemoveHint`,
                'Only the listed values are removed. Other values in the same category are left untouched.'
              )}
        </p>
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
            <p className="text-sm text-gray-600">{t(`${p}.validating`, 'Validating file…')}</p>
          </div>
        ) : (
          <>
            <Icons.CloudDownload size={40} className="text-gray-400" />
            <p className="text-dark-500 mt-2 text-sm">
              <span className="text-secondary-700 font-medium">
                {t(`${p}.clickToUpload`, 'Click to upload')}
              </span>{' '}
              {t(`${p}.orDragAndDrop`, 'or drag and drop')}
            </p>
            <p className="mt-1 text-xs text-gray-500">
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
