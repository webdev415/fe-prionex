import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { safeHttpUrl } from '@/lib/safeUrl'
import { useHasPermission } from '@/hooks'
import { downloadMaterial } from '@/features/training/api/materialsService'
import {
  useDetachMaterialFromCall,
  useMaterialsForCall,
} from '@/features/training/hooks/useMaterials'
import {
  isPreviewable,
  materialSubtitle,
  type Material,
  type MaterialType,
} from '@/features/training/types/materials'
import { MaterialPreviewModal } from './MaterialPreviewModal'
import { AttachMaterialPicker } from './AttachMaterialPicker'

/**
 * Materials attached to a call, shown on the call recording view.
 * Read gates view_materials; attach/detach gate manage_materials. Detach removes
 * the link only. Renders nothing when the viewer lacks view_materials or the
 * call has no id.
 */
export interface CallMaterialsPanelProps {
  callId: string | null | undefined
}

const TYPE_LABEL: Record<MaterialType, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  video: 'VIDEO',
  audio: 'AUDIO',
  link: 'LINK',
  other: 'FILE',
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function CallMaterialsPanel({ callId }: CallMaterialsPanelProps) {
  const { t } = useTranslation('common')
  const canView = useHasPermission('view_materials')
  const canManage = useHasPermission('manage_materials')

  const { data } = useMaterialsForCall(callId, canView)
  const detach = useDetachMaterialFromCall()
  const [previewTarget, setPreviewTarget] = useState<Material | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const materials = data?.data ?? []
  const attachedIds = useMemo(() => new Set((data?.data ?? []).map((m) => m.id)), [data])

  if (!canView || !callId) return null

  const handleDownload = async (m: Material) => {
    if (m.kind === 'link') {
      // No file behind it: the download endpoint answers 409. Opening the url is
      // the equivalent action, and safeHttpUrl is what keeps a stored
      // `javascript:` out of window.open.
      const href = safeHttpUrl(m.url)
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    setDownloadingId(m.id)
    try {
      const blob = await downloadMaterial(m.id)
      triggerBlobDownload(blob, m.original_filename ?? m.title)
    } catch {
      toast.error(
        t('pages.training.training.materials.errors.download', 'Could not download the file.')
      )
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDetach = (m: Material) => {
    detach.mutate(
      { materialId: m.id, callId },
      {
        onError: () =>
          toast.error(
            t('pages.training.training.materials.errors.detach', 'Could not detach the material.')
          ),
      }
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#EBECE8] bg-white p-3 text-left">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#05040D]">
          {t('pages.training.training.materials.attachedTitle', 'Attached materials')}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[#EBECE8] px-2 py-1 text-xs text-[#204E4D] hover:bg-[#F0FDF4]"
          >
            <Icons.Add size={14} />
            {t('pages.training.training.materials.attachMaterial', 'Attach material')}
          </button>
        )}
      </div>

      {materials.length === 0 ? (
        <span className="py-2 text-xs text-[#6B7280]">
          {t('pages.training.training.materials.noneAttached', 'No materials attached yet.')}
        </span>
      ) : (
        <div className="flex flex-col divide-y divide-[#F1F1EE]">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-[#05040D]">{m.title}</span>
                <span className="text-[10px] text-[#6B7280]">
                  {TYPE_LABEL[m.type]} · {materialSubtitle(m)}
                </span>
              </div>
              {isPreviewable(m.type) && (
                <button
                  type="button"
                  onClick={() => setPreviewTarget(m)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F7F7F7]"
                  aria-label={t('pages.training.training.materials.preview', 'Preview')}
                >
                  <Icons.Eye size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownload(m)}
                disabled={downloadingId === m.id}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0FDF4] text-[#204E4D] hover:bg-[#BBFB5B]/40 disabled:opacity-50"
                aria-label={t('actions.download', 'Download')}
              >
                <Icons.Download size={16} />
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleDetach(m)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F7F7F7] hover:text-[#B91C1C]"
                  aria-label={t('pages.training.training.materials.detach', 'Detach')}
                >
                  <Icons.Delete size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <MaterialPreviewModal material={previewTarget} onClose={() => setPreviewTarget(null)} />
      {canManage && (
        <AttachMaterialPicker
          callId={callId}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          attachedIds={attachedIds}
        />
      )}
    </div>
  )
}

export default CallMaterialsPanel
