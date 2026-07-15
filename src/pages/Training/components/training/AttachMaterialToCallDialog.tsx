import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCallMonitoring } from '@/features/actionAnalysis'
import { useAttachMaterialToCall } from '@/features/training/hooks/useMaterials'
import type { Material } from '@/features/training/types/materials'

/**
 * Attach a material to a call from the material card. A searchable
 * picker over recent project calls (`useCallMonitoring`, already bounded by the
 * user's view_call_list scope); picking a call writes the material↔call link.
 */
export interface AttachMaterialToCallDialogProps {
  material: Material | null
  onClose: () => void
}

function shortId(callId: string): string {
  return callId.slice(0, 8)
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

export function AttachMaterialToCallDialog({ material, onClose }: AttachMaterialToCallDialogProps) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const filters = useMemo(
    () => ({
      period: 'last_30d' as const,
      sort: 'date_desc' as const,
      phone_number: debounced || undefined,
      limit: 20,
      offset: 0,
    }),
    [debounced]
  )

  const { data, isLoading, isError } = useCallMonitoring(filters, material != null)
  const attach = useAttachMaterialToCall()
  const calls = data?.calls ?? []

  const handleAttach = async (callId: string) => {
    if (!material) return
    try {
      await attach.mutateAsync({ materialId: material.id, callId })
      toast.success(t('pages.training.training.materials.attachSuccess', 'Attached to the call.'))
      onClose()
    } catch {
      toast.error(
        t('pages.training.training.materials.errors.attach', 'Could not attach the material.')
      )
    }
  }

  return (
    <Modal open={material != null} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={t('pages.training.training.materials.attachToCall', 'Attach to a call')}
      />
      <ModalContent>
        <div className="flex flex-col gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'pages.training.training.materials.callSearchPlaceholder',
              'Search by phone number…'
            )}
            className="h-[40px] text-sm"
          />

          {isLoading && (
            <div className="p-4 text-center text-xs text-[#6B7280]">
              {t('pages.training.training.materials.callsLoading', 'Loading calls…')}
            </div>
          )}
          {isError && (
            <div className="rounded-md bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]">
              {t('pages.training.training.materials.callsError', 'Could not load calls.')}
            </div>
          )}
          {!isLoading && !isError && calls.length === 0 && (
            <div className="p-4 text-center text-xs text-[#6B7280]">
              {t('pages.training.training.materials.noCalls', 'No calls found.')}
            </div>
          )}

          <div className="flex max-h-[45vh] flex-col divide-y divide-[#F1F1EE] overflow-y-auto">
            {calls.map((c) => (
              <div key={c.call_id} className="flex items-center gap-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-[#05040D]">
                    {c.customer_number || shortId(c.call_id)}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    {formatWhen(c.initiated_at)} · #{shortId(c.call_id)}
                    {c.agent_extension ? ` · ${c.agent_extension}` : ''}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handleAttach(c.call_id)}
                  disabled={attach.isPending}
                >
                  {t('pages.training.training.materials.attach', 'Attach')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

export default AttachMaterialToCallDialog
