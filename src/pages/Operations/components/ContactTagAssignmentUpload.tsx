import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadContactTagAssignmentTemplate } from '@/features/imports/hooks/useContactTagAssignment'
import { useFileDropzone } from '@/features/imports/hooks/useFileDropzone'
import type { ContactTagAssignmentMode } from '@/features/imports/types/contactTagAssignment'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB, mirrors MAX_CONTACT_TAG_FILE_SIZE
// Module scope, not an inline literal at the call site: a fresh array
// each render makes useFileDropzone's useCallback deps change every
// time, so the memo it wraps never actually holds.
const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx']

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
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadContactTagAssignmentTemplate()

  // Shared with the client-tag upload panel: the accepted extensions and the
  // size limit are one rule, so they live in one place.
  const { dragActive, handleDrag, handleDrop, handleFileChange } = useFileDropzone({
    accept: ACCEPTED_EXTENSIONS,
    maxBytes: MAX_FILE_SIZE,
    onFileSelected,
    errorScope: p,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-medium">
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
        <label className="text-foreground text-sm font-medium">
          {t(`${p}.modeLabel`, 'Operation')}
        </label>
        <div className="border-border bg-card inline-flex w-full overflow-hidden rounded-lg border sm:w-fit">
          <button
            type="button"
            onClick={() => onModeChange('assign')}
            disabled={isUploading}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'assign' ? 'bg-secondary-700 text-white' : 'text-foreground hover:bg-muted'
            }`}
          >
            {t(`${p}.modeAssign`, 'Assign values')}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('remove')}
            disabled={isUploading}
            className={`border-border border-l px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'remove' ? 'bg-error-600 text-white' : 'text-foreground hover:bg-muted'
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
            : 'border-border bg-muted/50 hover:bg-muted'
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
            <p className="text-foreground mt-2 text-sm">
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
