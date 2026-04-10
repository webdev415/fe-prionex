/**
 * Document Preview Modal
 *
 * Full-screen modal for previewing documents:
 * - Images (jpeg, png, gif, bmp, webp): rendered as <img>
 * - PDF: rendered in <iframe>
 * - Other types: download-only prompt
 */

import { useEffect } from 'react'
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

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewData?.url) URL.revokeObjectURL(previewData.url)
    }
  }, [previewData?.url])

  const handleDownload = () => {
    documentApi.download(clientId, documentId, filename)
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth={canPreview ? '2xl' : 'sm'}>
      <ModalHeader title={filename} onClose={onClose} />

      <div className="flex min-h-[200px] items-center justify-center p-4">
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

        {!loading && !error && isImage && blobUrl && (
          <img
            src={blobUrl}
            alt={filename}
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
          />
        )}

        {!loading && !error && isPdf && blobUrl && (
          <iframe src={blobUrl} title={filename} className="h-[70vh] w-full rounded-lg border-0" />
        )}

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
