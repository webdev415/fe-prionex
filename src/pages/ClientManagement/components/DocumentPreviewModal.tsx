/**
 * Document Preview Modal
 *
 * - Images: dark background, fill viewport, zoom/pan controls overlay
 * - PDF: fullscreen iframe (native viewer)
 * - Other types: download-only prompt
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { documentApi } from '@/features/clients/api/documentApi'
import { useTranslation } from 'react-i18next'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { piiProps } from '@/lib/openreplay/pii'

interface DocumentPreviewModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  documentId: number
  filename: string
  mimeType: string
}

const PREVIEWABLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
])

const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.25
const ZOOM_MAX = 5

export function DocumentPreviewModal({
  open,
  onClose,
  clientId,
  documentId,
  filename,
  mimeType,
}: DocumentPreviewModalProps) {
  const { t } = useTranslation('common')

  const isImage = PREVIEWABLE_IMAGE_TYPES.has(mimeType)
  const isPdf = mimeType === 'application/pdf'
  const canPreview = isImage || isPdf

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const {
    data: blob,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['document-preview', clientId, documentId],
    queryFn: () => documentApi.preview(clientId, documentId),
    enabled: open && canPreview,
    staleTime: 60000,
  })

  // Mint a fresh object URL whenever the blob arrives or changes, and revoke
  // it on unmount/blob change. Caching only the Blob (not the URL) in React
  // Query lets a re-open of the same document produce a new URL instead of
  // reusing one that was already revoked on the previous close.
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => {
    if (!blobUrl) return
    return () => {
      URL.revokeObjectURL(blobUrl)
    }
  }, [blobUrl])

  const handleDownload = () => {
    documentApi.download(clientId, documentId, filename)
  }

  const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))
  const zoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))
  const zoomReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX))
    } else {
      setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN))
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return
      setDragging(true)
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    },
    [zoom, pan]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      setPan({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      })
    },
    [dragging]
  )

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const zoomPercent = Math.round(zoom * 100)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        {/* Full-screen dark overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />

        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col">
          {/* Top bar: filename + controls */}
          <div className="flex shrink-0 items-center justify-between bg-black/60 px-4 py-2 text-white backdrop-blur-sm">
            <span className="truncate text-sm font-medium">{filename}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="border-white/30 text-white hover:bg-white/10"
              >
                {t('pages.clients.modals.documentPreview.download')}
              </Button>
              <button
                onClick={onClose}
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

          {/* Content area */}
          <div className="flex flex-1 items-center justify-center overflow-hidden">
            {loading && (
              <div className="flex items-center gap-2 text-white/60">
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
                {t('pages.clients.modals.documentPreview.loading')}
              </div>
            )}

            {error && (
              <div className="text-red-400">
                {t('pages.clients.modals.documentPreview.loadFailed')}
              </div>
            )}

            {/* Image: dark bg, fill viewport */}
            {!loading && !error && isImage && blobUrl && (
              /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={blobUrl}
                  alt={filename}
                  className="object-contain select-none"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center center',
                    transition: dragging ? 'none' : 'transform 0.15s ease',
                  }}
                  draggable={false}
                />
              </div>
            )}

            {/* PDF: fullscreen iframe */}
            {!loading && !error && isPdf && blobUrl && (
              <iframe
                /* 🔴 The attribute goes on the <iframe> ITSELF, never on a wrapper:
                   `TopObserver` captures a frame when
                   `captureIFrames && !hasOpenreplayAttribute(node, 'obscured')`,
                   reading the attribute off the node in its own callback, so
                   inheritance plays no part. `captureIFrames` defaults to true and
                   is not set in our options, which means the document inside is
                   recorded today (a `blob:` URL inherits our origin). `hidden`
                   would not do instead: attributes of a hidden node are still
                   sent, so `title={filename}` leaked the file name — which is why
                   the title below is a role rather than the name. */
                src={blobUrl}
                title={t('pages.clients.documents.previewFrameTitle', 'Document preview')}
                className="h-full w-full border-0"
                {...piiProps}
              />
            )}

            {/* Non-previewable */}
            {!loading && !error && !canPreview && (
              <div className="flex flex-col items-center gap-4 py-8 text-white/60">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-center">
                  {t('pages.clients.modals.documentPreview.previewNotAvailable')}
                  <br />
                  <span className="text-sm text-white/40">{mimeType}</span>
                </p>
                <Button onClick={handleDownload}>
                  {t('pages.clients.modals.documentPreview.download')}
                </Button>
              </div>
            )}
          </div>

          {/* Bottom zoom controls for images */}
          {!loading && !error && isImage && blobUrl && (
            <div className="flex shrink-0 items-center justify-center gap-3 bg-black/60 py-2 backdrop-blur-sm">
              <button
                onClick={zoomOut}
                className="rounded border border-white/30 px-3 py-1 text-sm text-white hover:bg-white/10"
              >
                −
              </button>
              <button
                onClick={zoomReset}
                className="rounded border border-white/30 px-4 py-1 text-sm text-white hover:bg-white/10"
              >
                {zoomPercent}%
              </button>
              <button
                onClick={zoomIn}
                className="rounded border border-white/30 px-3 py-1 text-sm text-white hover:bg-white/10"
              >
                +
              </button>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
