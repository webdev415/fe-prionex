import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { api } from '@/lib/api'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import type { AssistantFileKind } from './assistantFiles'
import {
  readAssistantFileErrorCode,
  useAssistantFileBlob,
  type AssistantFileErrorCode,
} from './useAssistantFileBlob'
import { Pii, piiProps } from '@/lib/openreplay/pii'

/** Files the operator can look at without leaving the chat. */
function isPreviewable(kind: AssistantFileKind): boolean {
  return kind === 'image' || kind === 'pdf'
}

/**
 * Locale key for a gateway failure. The gateway's own `message` is Russian
 * prose, and this UI runs in English/Ukrainian, so the `code` is mapped to a
 * translated sentence instead of showing the server's text.
 */
function errorKey(code: AssistantFileErrorCode | undefined, fallback: string): string {
  switch (code) {
    case 'file_not_found':
      return 'pages.aiAssistant.filePreview.errorNotFound'
    case 'file_too_large':
      return 'pages.aiAssistant.filePreview.errorTooLarge'
    case 'brain_unavailable':
      return 'pages.aiAssistant.filePreview.errorBrainUnavailable'
    default:
      return fallback
  }
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
              <Pii>{name}</Pii>
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
                {t(errorKey(state.code, 'pages.aiAssistant.filePreview.loadFailed'))}
              </span>
            )}
            {state.status === 'ready' && kind === 'image' && (
              <img
                src={state.objectUrl}
                // The role, not the file name (KAN-KB-54): `alt` is sent to the
                // recording verbatim, and the name is shown as masked text above.
                alt={t('pages.aiAssistant.attachmentFrameTitle', 'Attachment preview')}
                className="max-h-full max-w-full object-contain"
              />
            )}
            {state.status === 'ready' && kind === 'pdf' && (
              <iframe
                /* 🔴 On the <iframe> itself — see DocumentPreviewModal. */
                src={state.objectUrl}
                title={t('pages.aiAssistant.attachmentFrameTitle', 'Attachment preview')}
                className="h-full w-full border-0"
                {...piiProps}
              />
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
          {state.code
            ? t(errorKey(state.code, ''))
            : t('pages.aiAssistant.filePreview.imageFailed', { name: label })}
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
 * A click this soon after a successful download is read as "I did not see it
 * happen", not as "I want a second copy" (fb28: 17 clicks in 10 s, each one a
 * 200 and a fresh file). Instead of pulling the file again silently, the card
 * points at the browser's downloads and offers an explicit "download again".
 */
export const FILE_REPEAT_GUARD_MS = 15_000

/**
 * A generated export (CSV/XLSX/PDF/…) shown as a card rather than a bare URL.
 * PDFs open in the preview modal; everything else downloads through the
 * authenticated client, because the browser cannot fetch these paths on its own.
 *
 * The browser's own "saved" signal is easy to miss (a closed downloads bubble,
 * a download manager, a policy), so after a successful hand-off the card keeps
 * saying so itself, together with where to look. It says "sent to the browser",
 * not "downloaded": the page only knows the save link was clicked, not that the
 * file reached the disk (an extension, antivirus, policy or OneX's
 * `downloadMode: 'block'` can still drop it).
 *
 * The card's state belongs to one `url`: callers mount it with `key={url}`.
 */
export function AssistantFileCard({ url, name, kind, label }: AssistantFileCardProps) {
  const { t } = useTranslation('common')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [failure, setFailure] = useState<{ code?: AssistantFileErrorCode } | null>(null)
  /** `Date.now()` of the last successful save; null until the first one. */
  const [downloadedAt, setDownloadedAt] = useState<number | null>(null)
  const [repeatHint, setRepeatHint] = useState(false)
  const cardRef = useRef<HTMLButtonElement>(null)
  const previewable = isPreviewable(kind)
  const downloaded = downloadedAt !== null
  // The icon states what the click does, which is the only thing that differs
  // between kinds here: look at it in place, or pull it down.
  const Icon = previewable ? Icons.File : Icons.FileDownload
  const title = label?.trim() || name

  const download = useCallback(async () => {
    setFailure(null)
    setRepeatHint(false)
    setDownloading(true)
    try {
      const response = await api.get<Blob>(url, { responseType: 'blob' })
      downloadBlob(response.data, name)
      setDownloadedAt(Date.now())
    } catch (error) {
      setDownloadedAt(null)
      setFailure({ code: await readAssistantFileErrorCode(error) })
    } finally {
      setDownloading(false)
    }
  }, [url, name])

  const handleClick = useCallback(() => {
    if (previewable) {
      setPreviewOpen(true)
      return
    }
    if (downloadedAt !== null && Date.now() - downloadedAt < FILE_REPEAT_GUARD_MS) {
      setRepeatHint(true)
      return
    }
    void download()
  }, [previewable, downloadedAt, download])

  // "Download again" unmounts together with the hint it lives in, so without
  // this a keyboard or screen-reader user drops to <body> and loses their place
  // in the chat. Focus goes to the card now, and back to it once the download
  // settles unless the user has moved on (a browser may blur the card while it
  // is disabled for the request).
  const downloadAgain = useCallback(() => {
    cardRef.current?.focus()
    void download().then(() => {
      const active = document.activeElement
      if (!active || active === document.body) cardRef.current?.focus()
    })
  }, [download])

  // One live region that is always in the DOM: screen readers often skip a
  // region that appears already filled, and text inside the focused button is
  // not re-read when it changes. Empty while a request runs, so a second
  // successful save announces again. A failure keeps its old in-card text only.
  const announcement =
    downloading || failure
      ? ''
      : repeatHint
        ? t('pages.aiAssistant.filePreview.alreadyDownloaded')
        : downloaded
          ? t('pages.aiAssistant.filePreview.downloaded')
          : ''

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        data-testid="assistant-file-card"
        data-file-kind={kind}
        data-download-state={downloaded ? 'downloaded' : undefined}
        onClick={handleClick}
        disabled={downloading}
        className={cn(
          'bg-card hover:border-primary-300 hover:bg-muted/40 my-1 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
          'focus-visible:ring-primary-400 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60'
        )}
      >
        {downloading ? (
          <Icons.Spinner className="h-4 w-4 shrink-0" />
        ) : downloaded ? (
          <Icons.Success
            size={16}
            strokeWidth={1.5}
            aria-hidden
            className="text-success-600 shrink-0"
          />
        ) : (
          <Icon size={16} strokeWidth={1.5} className="text-primary-600 shrink-0" />
        )}
        <span className="min-w-0">
          <span className="text-foreground block truncate text-[13px] font-medium">{title}</span>
          {failure ? (
            <span className="text-muted-foreground block text-[11px]">
              {t(errorKey(failure.code, 'pages.aiAssistant.filePreview.downloadFailed'))}
            </span>
          ) : downloaded ? (
            <>
              <span
                data-testid="assistant-file-downloaded"
                className="text-success-700 block text-[11px] font-medium"
              >
                {t('pages.aiAssistant.filePreview.downloaded')}
              </span>
              <span className="text-muted-foreground block text-[11px]">
                {t('pages.aiAssistant.filePreview.downloadedHint')}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground block text-[11px]">
              {previewable
                ? t('pages.aiAssistant.filePreview.openPreview')
                : t('pages.aiAssistant.filePreview.download')}
            </span>
          )}
        </span>
      </button>
      <span role="status" data-testid="assistant-file-live" className="sr-only">
        {announcement}
      </span>
      {repeatHint && (
        // A sibling of the card, not a child: a button cannot hold a button.
        // A `span`, because the card sits inside a markdown paragraph. Not a
        // live region itself: the region above announces it.
        <span
          data-testid="assistant-file-repeat-hint"
          className="bg-muted/40 text-muted-foreground my-1 flex max-w-full flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[11px]"
        >
          <span className="min-w-0">{t('pages.aiAssistant.filePreview.alreadyDownloaded')}</span>
          <button
            type="button"
            data-testid="assistant-file-download-again"
            onClick={downloadAgain}
            className="text-primary-600 hover:text-primary-700 inline-flex shrink-0 items-center gap-1 font-medium underline underline-offset-2"
          >
            <Icons.Download size={12} strokeWidth={1.5} aria-hidden />
            {t('pages.aiAssistant.filePreview.downloadAgain')}
          </button>
        </span>
      )}
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
 * A file the assistant says it built, but whose link cannot be resolved —
 * almost always because the model retyped its own answer and dropped the
 * one-time token that scopes the file to this operator.
 *
 * Rendered as a dead card rather than an `<img>`: a request without the token
 * can only 400, and a broken image icon would read as "the CRM is broken"
 * instead of "ask the assistant to send the link again".
 */
export function AssistantUnresolvableRef({ text }: { text?: string }) {
  const { t } = useTranslation('common')
  const label = text?.trim()
  return (
    <span
      data-testid="assistant-unresolvable-ref"
      className="text-muted-foreground bg-muted/40 my-1 inline-flex max-w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left"
    >
      <Icons.FileRemove size={16} strokeWidth={1.5} className="shrink-0" />
      <span className="min-w-0">
        {label && (
          <span className="text-foreground block truncate text-[13px] font-medium">{label}</span>
        )}
        <span className="block text-[11px]">{t('pages.aiAssistant.filePreview.linkLost')}</span>
      </span>
    </span>
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
