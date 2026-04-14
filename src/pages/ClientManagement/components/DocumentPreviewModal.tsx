/**
 * Document Preview Modal
 *
 * - Images: zoom in/out with buttons + mouse wheel, drag to pan
 * - PDF: fullscreen iframe
 * - Other types: download-only prompt
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal, ModalHeader, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { documentApi } from '@/features/clients/api/documentApi'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  const isImage = PREVIEWABLE_IMAGE_TYPES.has(mimeType)
  const isPdf = mimeType === 'application/pdf'
  const canPreview = isImage || isPdf

  // Zoom + pan state for images
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // zoom/pan reset handled by parent via key prop on this component

  const {
    data: previewData,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['document-preview', clientId, documentId],
    queryFn: () => documentApi.preview(clientId, documentId),
    enabled: open && canPreview,
    staleTime: 60000,
  })

  const blobUrl = previewData?.url ?? null

  useEffect(() => {
    return () => {
      if (previewData?.url) URL.revokeObjectURL(previewData.url)
    }
  }, [previewData?.url])

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
    <Modal open={open} onClose={onClose} maxWidth={canPreview ? 'full' : 'sm'}>
      <ModalHeader title={filename} onClose={onClose} />

      <div className="flex min-h-[300px] flex-col items-center justify-center overflow-hidden p-2">
        {loading && (
          <div className="text-secondary-500 flex items-center gap-2">
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
            Loading...
          </div>
        )}

        {error && <div className="text-red-500">Failed to load document</div>}

        {/* Image preview with zoom + pan */}
        {!loading && !error && isImage && blobUrl && (
          <>
            {/* Zoom controls */}
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={zoomOut}
                className="text-secondary-600 hover:bg-secondary-100 rounded border px-2 py-1 text-sm"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={zoomReset}
                className="text-secondary-600 hover:bg-secondary-100 rounded border px-3 py-1 text-sm"
                title="Reset zoom"
              >
                {zoomPercent}%
              </button>
              <button
                onClick={zoomIn}
                className="text-secondary-600 hover:bg-secondary-100 rounded border px-2 py-1 text-sm"
                title="Zoom in"
              >
                +
              </button>
            </div>

            {/* Image container — eslint-disable for interactive image viewer */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
              ref={containerRef}
              className="relative max-h-[80vh] w-full overflow-hidden rounded-lg"
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
                className="mx-auto block select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: 'center center',
                  maxHeight: '80vh',
                  transition: dragging ? 'none' : 'transform 0.15s ease',
                }}
                draggable={false}
              />
            </div>
          </>
        )}

        {/* PDF preview — fullscreen iframe */}
        {!loading && !error && isPdf && blobUrl && (
          <iframe src={blobUrl} title={filename} className="h-[85vh] w-full rounded-lg border-0" />
        )}

        {/* Non-previewable files */}
        {!loading && !error && !canPreview && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="text-secondary-400 text-5xl">
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
            </div>
            <p className="text-secondary-600 text-center">
              Preview not available for this file type.
              <br />
              <span className="text-secondary-400 text-sm">{mimeType}</span>
            </p>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close', 'Close')}
        </Button>
        <Button onClick={handleDownload}>{t('common.download', 'Download')}</Button>
      </ModalFooter>
    </Modal>
  )
}
