import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { previewMaterial } from '@/features/training/api/materialsService'
import { isPreviewable, type Material } from '@/features/training/types/materials'

/**
 * In-CRM preview for PDFs and video. Fetches the file with auth
 * (a raw `<iframe src=apiUrl>` can't send the Bearer token) and renders it from
 * an object URL — PDF in an `<iframe>`, video in `<video>`. No download.
 */
export interface MaterialPreviewModalProps {
  material: Material | null
  onClose: () => void
}

export function MaterialPreviewModal({ material, onClose }: MaterialPreviewModalProps) {
  const { t } = useTranslation('common')
  const materialId = material?.id ?? null

  const {
    data: objectUrl,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['material-preview', materialId],
    queryFn: async () => {
      const blob = await previewMaterial(materialId as number)
      return URL.createObjectURL(blob)
    },
    enabled: materialId != null,
    staleTime: 0,
    gcTime: 0,
  })

  // Revoke the object URL when it changes or the modal unmounts.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  return (
    <Modal open={material != null} onClose={onClose} maxWidth="xl">
      <ModalHeader
        title={material?.title ?? t('pages.training.training.materials.preview', 'Preview')}
      />
      <ModalContent>
        <div className="flex min-h-[60vh] items-center justify-center">
          {isLoading && (
            <span className="text-xs text-[#6B7280]">
              {t('pages.training.training.materials.previewLoading', 'Loading preview…')}
            </span>
          )}
          {isError && (
            <span className="text-xs text-[#B91C1C]">
              {t('pages.training.training.materials.previewError', 'Could not load the preview.')}
            </span>
          )}
          {!isLoading && !isError && objectUrl && material?.type === 'pdf' && (
            <iframe
              src={objectUrl}
              title={material.title}
              className="h-[70vh] w-full rounded-md border border-[#EBECE8]"
            />
          )}
          {!isLoading && !isError && objectUrl && material?.type === 'video' && (
            <video src={objectUrl} controls className="max-h-[70vh] w-full rounded-md">
              <track kind="captions" />
            </video>
          )}
          {material != null && !isPreviewable(material.type) && (
            <span className="text-xs text-[#6B7280]">
              {t(
                'pages.training.training.materials.previewUnsupported',
                'Preview is available for PDFs and video only. Download the file to view it.'
              )}
            </span>
          )}
        </div>
      </ModalContent>
    </Modal>
  )
}

export default MaterialPreviewModal
