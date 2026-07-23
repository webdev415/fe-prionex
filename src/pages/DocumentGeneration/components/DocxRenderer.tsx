/**
 * Renders a .docx Blob into an on-screen A4-style preview (KAN-403 Tab 2).
 *
 * The heavy `docx-preview` engine is imported lazily so it never lands in the
 * main bundle — it loads only when a lawyer actually opens a preview. The library
 * paints white "pages" (with a drop shadow) inside a `.docx-wrapper`; we let that
 * wrapper stay transparent and provide a neutral scroll surface ourselves, so the
 * pages read like a PDF viewer in both light and dark themes.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface DocxRendererProps {
  /** The .docx bytes to render, or null while there is nothing to show. */
  blob: Blob | null
  /** Upstream fetch is in flight (e.g. the useQuery loading the blob). */
  isLoading?: boolean
  /** Upstream fetch failed. */
  error?: boolean
  /** Extra classes for the outer scroll container. */
  className?: string
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-sm">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label}
    </div>
  )
}

export function DocxRenderer({ blob, isLoading, error, className }: DocxRendererProps) {
  const { t } = useTranslation('common')
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Wipe any previous document before drawing the next one.
    container.replaceChildren()
    if (!blob) {
      setRendering(false)
      setRenderError(false)
      return
    }

    let cancelled = false
    setRendering(true)
    setRenderError(false)

    void (async () => {
      try {
        const { renderAsync } = await import('docx-preview')
        if (cancelled) return
        await renderAsync(blob, container, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          useBase64URL: true,
        })
        if (cancelled) container.replaceChildren()
      } catch {
        if (!cancelled) {
          container.replaceChildren()
          setRenderError(true)
        }
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [blob])

  const showLoading = isLoading || rendering
  const showError = error || renderError
  const showEmpty = !showLoading && !showError && !blob

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-y-auto bg-neutral-200 dark:bg-neutral-900',
        // Let our neutral surface show through docx-preview's own grey wrapper;
        // the white "pages" (and their shadow) sit on top unchanged.
        '[&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-4 sm:[&_.docx-wrapper]:p-8',
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn(showLoading || showError || showEmpty ? 'hidden' : '')}
      />

      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner
            label={t('pages.documentGeneration.templates.preview.loading', 'Loading preview…')}
          />
        </div>
      )}

      {showError && (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <p className="text-error-600 text-center text-sm">
            {t(
              'pages.documentGeneration.templates.preview.error',
              'Could not render the document.'
            )}
          </p>
        </div>
      )}

      {showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <p className="text-muted-foreground text-center text-sm">
            {t('pages.documentGeneration.templates.preview.empty', 'Nothing to preview.')}
          </p>
        </div>
      )}
    </div>
  )
}
