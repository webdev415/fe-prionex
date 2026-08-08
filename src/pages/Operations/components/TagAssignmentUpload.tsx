import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useDownloadTagAssignmentTemplate } from '@/features/imports/hooks/useTagAssignment'
import { useFileDropzone } from '@/features/imports/hooks/useFileDropzone'
import type { TagAssignmentMode } from '@/features/imports/types/tagAssignment'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface Props {
  mode: TagAssignmentMode
  onModeChange: (mode: TagAssignmentMode) => void
  onFileSelected: (file: File) => void
  isUploading: boolean
}

export function TagAssignmentUpload({ mode, onModeChange, onFileSelected, isUploading }: Props) {
  const { t } = useTranslation('common')
  const p = 'pages.imports.tagAssignment.upload'
  const inputRef = useRef<HTMLInputElement>(null)
  const downloadTemplate = useDownloadTagAssignmentTemplate()

  // Shared with the contact-tag upload panel: the accepted extensions and the
  // size limit are one rule, so they live in one place.
  const { dragActive, handleDrag, handleDrop, handleFileChange } = useFileDropzone({
    accept: ['.csv', '.xlsx'],
    maxBytes: MAX_FILE_SIZE,
    onFileSelected,
    errorScope: p,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-foreground text-lg font-medium">
            {t(`${p}.sectionTitle`, 'Upload tag assignment CSV')}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t(
              `${p}.description`,
              'Each row: tax_id, tags (comma-separated tag names). Operation applies to all listed tags.'
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
              mode === 'assign'
                ? 'bg-secondary-700 text-secondary-foreground'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            {t(`${p}.modeAssign`, 'Assign tags')}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('remove')}
            disabled={isUploading}
            className={`border-border border-l px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'remove' ? 'bg-error-100 text-error-700' : 'text-foreground hover:bg-muted'
            }`}
          >
            {t(`${p}.modeRemove`, 'Remove tags')}
          </button>
        </div>
        <p className="text-muted-foreground text-xs">
          {mode === 'assign'
            ? t(
                `${p}.modeAssignHint`,
                'Listed tags will be added to each client. Tags already present are skipped.'
              )
            : t(
                `${p}.modeRemoveHint`,
                "Listed tags will be removed from each client. Protected tags can't be removed via bulk."
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
