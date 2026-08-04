import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { api } from '@/lib/api'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import type { AssistantFileKind } from './assistantFiles'
import { useAssistantFileBlob } from './useAssistantFileBlob'

/** Files the operator can look at without leaving the chat. */
function isPreviewable(kind: AssistantFileKind): boolean {
  return kind === 'image' || kind === 'pdf'
}

type PreviewModalProps = {
  onClose: () => void
  url: string
  name: string
  kind: AssistantFileKind
}

/**
 * Full-screen look at one assistant file: images fill the viewport, PDFs get
 * the browser's own viewer in an iframe.
 *
 * Callers mount this only while it is open, so every open starts from a clean
 * fetch and the object URL is revoked on close. That is also why it takes no
 * `open` prop — being mounted *is* being open.
 */
function AssistantFilePreviewModal({ onClose, url, name, kind }: PreviewModalProps) {
  const { t } = useTranslation('common')
  const state = useAssistantFileBlob(url)

  const handleDownload = useCallback(() => {
    if (state.status === 'ready') downloadBlob(state.blob, name)
  }, [state, name])

  return (
    <DialogPrimitive.Root open onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          data-testid="assistant-file-preview-modal"
          className="fixed inset-0 z-50 flex flex-col"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 bg-black/60 px-4 py-2 text-white backdrop-blur-sm">
            <DialogPrimitive.Title className="truncate text-sm font-medium">
              {name}
            </DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={state.status !== 'ready'}
                className="inline-flex items-center gap-1.5 rounded border border-white/30 px-2.5 py-1 text-xs text-white transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <Icons.Download size={14} strokeWidth={1.5} />
                {t('pages.aiAssistant.filePreview.download')}
              </button>
              <DialogPrimitive.Close
                aria-label={t('pages.aiAssistant.filePreview.close')}
                className="rounded p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icons.Close size={20} strokeWidth={1.5} />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
            {state.status === 'loading' && (
              <span className="flex items-center gap-2 text-sm text-white/60">
                <Icons.Spinner className="h-[18px] w-[18px]" />
                {t('pages.aiAssistant.filePreview.loading')}
              </span>
            )}
            {state.status === 'error' && (
              <span className="text-danger-400 text-sm">
                {t('pages.aiAssistant.filePreview.loadFailed')}
              </span>
            )}
            {state.status === 'ready' && kind === 'image' && (
              <img
                src={state.objectUrl}
                alt={name}
                className="max-h-full max-w-full object-contain"
              />
            )}
            {state.status === 'ready' && kind === 'pdf' && (
              <iframe src={state.objectUrl} title={name} className="h-full w-full border-0" />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

type AssistantImageProps = {
  url: string
  name: string
  /** `alt` from the markdown; falls back to the file name when the model omits it. */
  alt?: string
}

/**
 * A chart the assistant drew, shown inline in the answer bubble. Capped in
 * height so a tall plot cannot push the rest of the answer off-screen; click
 * (or Enter/Space) opens it full-size.
 */
export function AssistantImage({ url, name, alt }: AssistantImageProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const state = useAssistantFileBlob(url)
  const label = alt?.trim() || name

  if (state.status === 'error') {
    return (
      <span
        data-testid="assistant-image-placeholder"
        className="text-muted-foreground bg-muted/40 my-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs"
      >
        <Icons.Error size={14} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate">
          {t('pages.aiAssistant.filePreview.imageFailed', { name: label })}
        </span>
      </span>
    )
  }

  if (state.status !== 'ready') {
    return (
      <span
        data-testid="assistant-image-loading"
        className="bg-muted/40 text-muted-foreground my-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
      >
        <Icons.Spinner className="h-3.5 w-3.5" />
        {t('pages.aiAssistant.filePreview.loading')}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        data-testid="assistant-image"
        onClick={() => setOpen(true)}
        aria-label={t('pages.aiAssistant.filePreview.openFull', { name: label })}
        className="focus-visible:ring-primary-400 my-2 block cursor-zoom-in overflow-hidden rounded-lg border transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
      >
        <img
          src={state.objectUrl}
          alt={label}
          loading="lazy"
          className="max-h-72 w-auto max-w-full object-contain"
        />
      </button>
      {open && (
        <AssistantFilePreviewModal
          onClose={() => setOpen(false)}
          url={url}
          name={name}
          kind="image"
        />
      )}
    </>
  )
}

type AssistantFileCardProps = {
  url: string
  name: string
  kind: AssistantFileKind
  /** Link text from the markdown, when the model wrote something better than the file name. */
  label?: string
}

/**
 * A generated export (CSV/XLSX/PDF/…) shown as a card rather than a bare URL.
 * PDFs open in the preview modal; everything else downloads through the
 * authenticated client, because the browser cannot fetch these paths on its own.
 */
export function AssistantFileCard({ url, name, kind, label }: AssistantFileCardProps) {
  const { t } = useTranslation('common')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [failed, setFailed] = useState(false)
  const previewable = isPreviewable(kind)
  // The icon states what the click does, which is the only thing that differs
  // between kinds here: look at it in place, or pull it down.
  const Icon = previewable ? Icons.File : Icons.FileDownload
  const title = label?.trim() || name

  const handleClick = useCallback(async () => {
    if (previewable) {
      setPreviewOpen(true)
      return
    }
    setFailed(false)
    setDownloading(true)
    try {
      const response = await api.get<Blob>(url, { responseType: 'blob' })
      downloadBlob(response.data, name)
    } catch {
      setFailed(true)
    } finally {
      setDownloading(false)
    }
  }, [previewable, url, name])

  return (
    <>
      <button
        type="button"
        data-testid="assistant-file-card"
        data-file-kind={kind}
        onClick={handleClick}
        disabled={downloading}
        className={cn(
          'bg-card hover:border-primary-300 hover:bg-muted/40 my-1 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
          'focus-visible:ring-primary-400 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'
        )}
      >
        {downloading ? (
          <Icons.Spinner className="h-4 w-4 shrink-0" />
        ) : (
          <Icon size={16} strokeWidth={1.5} className="text-primary-600 shrink-0" />
        )}
        <span className="min-w-0">
          <span className="text-foreground block truncate text-[13px] font-medium">{title}</span>
          <span className="text-muted-foreground block text-[11px]">
            {failed
              ? t('pages.aiAssistant.filePreview.downloadFailed')
              : previewable
                ? t('pages.aiAssistant.filePreview.openPreview')
                : t('pages.aiAssistant.filePreview.download')}
          </span>
        </span>
      </button>
      {previewOpen && (
        <AssistantFilePreviewModal
          onClose={() => setPreviewOpen(false)}
          url={url}
          name={name}
          kind={kind}
        />
      )}
    </>
  )
}

/**
 * An `http(s)` reference the model produced. It is never loaded automatically —
 * an `<img>` pointing at someone else's host would tell that host who read the
 * message and when, and the model's output is not a trusted source for that
 * decision. The operator sees where the link goes and decides.
 */
export function AssistantExternalRef({ href, text }: { href: string; text?: string }) {
  const { t } = useTranslation('common')
  return (
    <a
      href={href}
      data-testid="assistant-external-link"
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={href}
      className="text-primary-600 hover:text-primary-700 mx-0.5 inline-flex max-w-full items-center gap-1 align-baseline underline decoration-dotted underline-offset-2"
    >
      <Icons.Info size={12} strokeWidth={1.5} className="shrink-0" />
      <span className="truncate">{text?.trim() || href}</span>
      <span className="text-muted-foreground shrink-0 text-[11px]">
        ({t('pages.aiAssistant.filePreview.externalLink')})
      </span>
    </a>
  )
}

/**
 * A reference that is neither a bridge file nor a plain web link (`data:`,
 * `javascript:`, a path trying to climb out of the bridge). Nothing is
 * rendered as a target — only a note that something was dropped, so the
 * operator is not left wondering why the answer looks incomplete.
 */
export function AssistantBlockedRef({ text }: { text?: string }) {
  const { t } = useTranslation('common')
  return (
    <span
      data-testid="assistant-blocked-ref"
      className="text-muted-foreground bg-muted/40 mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]"
    >
      <Icons.Warning size={12} strokeWidth={1.5} className="shrink-0" />
      {text?.trim() || t('pages.aiAssistant.filePreview.blocked')}
    </span>
  )
}
