/**
 * Server-rendered PDF viewer for document templates.
 *
 * Replaces the former in-browser docx renderer (docx-preview): floating
 * images (letterhead logo, stamp, signature) were approximated by the
 * library and could overlap text, which read as "the template is broken".
 * The backend now renders the template to PDF with the same LibreOffice
 * pipeline the generation flow uses, so this preview is pixel-identical
 * to a generated document. The blob is shown in the browser's native PDF
 * viewer via an <iframe>.
 */

import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface DocumentFileViewerProps {
  /** Server-rendered PDF blob (null while loading / on error). */
  blob: Blob | null | undefined
  isLoading?: boolean
  error?: boolean
  className?: string
  /** Accessible title for the iframe. */
  title: string
}

export function DocumentFileViewer({
  blob,
  isLoading,
  error,
  className,
  title,
}: DocumentFileViewerProps) {
  const { t } = useTranslation('common')

  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => {
    if (!blobUrl) return undefined
    return () => URL.revokeObjectURL(blobUrl)
  }, [blobUrl])

  const showLoading = Boolean(isLoading)
  const showError = !showLoading && Boolean(error)
  const showEmpty = !showLoading && !showError && !blobUrl

  return (
    <div className={cn('relative h-full w-full bg-neutral-200 dark:bg-neutral-900', className)}>
      {blobUrl && !showLoading && !showError && (
        <iframe src={blobUrl} title={title} className="h-full w-full border-0" />
      )}

      {showLoading && (
        <div className="text-secondary-500 absolute inset-0 flex items-center justify-center gap-2 text-sm">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 animate-spin">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {t('pages.documentGeneration.templates.preview.loading', 'Готуємо документ…')}
        </div>
      )}

      {showError && (
        <div className="text-secondary-500 absolute inset-0 flex items-center justify-center text-sm">
          {t('pages.documentGeneration.templates.preview.error', 'Не вдалося завантажити документ')}
        </div>
      )}

      {showEmpty && (
        <div className="text-secondary-500 absolute inset-0 flex items-center justify-center text-sm">
          {t('pages.documentGeneration.templates.preview.empty', 'Немає даних')}
        </div>
      )}
    </div>
  )
}
