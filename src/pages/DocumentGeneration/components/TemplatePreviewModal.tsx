/**
 * Full-screen preview for a .docx document template (KAN-403 Tab 2, iteration 2).
 *
 * Modelled on ClientManagement/DocumentPreviewModal: a dark top bar with the
 * file name, a download button and a close button, over a document viewport.
 * The extra affordance here is a segmented switch between the *template* itself
 * ("{{placeholders}}" intact) and the same template *rendered with sample data*
 * — so a lawyer can eyeball whether anything shifts once real values fill in.
 *
 * Each mode is fetched as a SERVER-RENDERED PDF (same LibreOffice pipeline the
 * generation flow uses) and shown in the browser's native viewer — pixel-
 * identical to a generated document. Download always hands out the .docx
 * flavour (that is what lawyers edit).
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  downloadDocumentTemplateFile,
  previewDocumentTemplateFile,
  type DocumentTemplate,
} from '@/features/documents'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { DocumentFileViewer } from './DocumentFileViewer'

export type TemplatePreviewMode = 'template' | 'sample'

interface TemplatePreviewModalProps {
  open: boolean
  onClose: () => void
  template: DocumentTemplate
  /** Which tab to open on first mount (defaults to the raw template). */
  initialMode?: TemplatePreviewMode
}

/** 5 minutes — a template's file changes rarely, and re-open should be instant. */
const PREVIEW_STALE_TIME = 5 * 60 * 1000

/** Insert `-sample` before the file extension for the rendered-with-data download. */
function sampleFileName(base: string): string {
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return `${base}-sample.docx`
  return `${base.slice(0, dot)}-sample${base.slice(dot)}`
}

export function TemplatePreviewModal({
  open,
  onClose,
  template,
  initialMode = 'template',
}: TemplatePreviewModalProps) {
  const { t } = useTranslation('common')
  const [mode, setMode] = useState<TemplatePreviewMode>(initialMode)

  const baseFileName = template.file_name ?? `${template.name}.docx`

  const {
    data: blob,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['document-template-preview', template.id, mode, 'pdf'],
    queryFn: () =>
      mode === 'sample'
        ? previewDocumentTemplateFile(template.id, 'pdf')
        : downloadDocumentTemplateFile(template.id, 'pdf'),
    enabled: open,
    staleTime: PREVIEW_STALE_TIME,
  })

  const handleDownload = async () => {
    // Preview shows the PDF; lawyers edit the .docx — fetch that flavour.
    const docx =
      mode === 'sample'
        ? await previewDocumentTemplateFile(template.id)
        : await downloadDocumentTemplateFile(template.id)
    downloadBlob(docx, mode === 'sample' ? sampleFileName(baseFileName) : baseFileName)
  }

  const modes: { id: TemplatePreviewMode; label: string }[] = [
    {
      id: 'template',
      label: t('pages.documentGeneration.templates.preview.modeTemplate', 'Template'),
    },
    {
      id: 'sample',
      label: t('pages.documentGeneration.templates.preview.modeSample', 'With sample data'),
    },
  ]

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col"
        >
          <DialogPrimitive.Title className="sr-only">
            {t('pages.documentGeneration.templates.preview.title', 'Template preview')}
          </DialogPrimitive.Title>

          {/* Top bar: file name + mode switch + download + close */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-black/60 px-4 py-2 text-white backdrop-blur-sm">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{template.name}</span>

            {/* Segmented switch */}
            <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/20 bg-white/5 p-0.5">
              {modes.map((m) => {
                const isActive = m.id === mode
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    aria-pressed={isActive}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      isActive ? 'bg-white text-neutral-900' : 'text-white/80 hover:bg-white/10'
                    )}
                  >
                    {m.label}
                  </button>
                )
              })}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={!blob}
                className="border-white/30 text-white hover:bg-white/10"
              >
                {t('pages.documentGeneration.templates.form.downloadFile', 'Download file')}
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('actions.close', 'Close')}
                className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Document viewport */}
          <DocumentFileViewer
            title={template.name}
            blob={blob ?? null}
            isLoading={isLoading}
            error={isError}
            className="flex-1"
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
