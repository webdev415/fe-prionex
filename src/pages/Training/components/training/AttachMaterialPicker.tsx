import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAttachMaterialToCall, useMaterials } from '@/features/training/hooks/useMaterials'

/**
 * Pick a material (by name) to attach to a call, from the call recording view
 * Attach is idempotent server-side, so re-picking is harmless.
 */
export interface AttachMaterialPickerProps {
  callId: string
  open: boolean
  onClose: () => void
  /** Material ids already attached to this call — shown as "Attached". */
  attachedIds: ReadonlySet<number>
}

export function AttachMaterialPicker({
  callId,
  open,
  onClose,
  attachedIds,
}: AttachMaterialPickerProps) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const filters = useMemo(() => ({ q: debounced || undefined, limit: 30, offset: 0 }), [debounced])
  const { data, isLoading, isError } = useMaterials(filters, open)
  const attach = useAttachMaterialToCall()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const materials = data?.data ?? []

  const handleAttach = async (materialId: number) => {
    setPendingId(materialId)
    try {
      await attach.mutateAsync({ materialId, callId })
      toast.success(t('pages.training.training.materials.attachSuccess', 'Attached to the call.'))
    } catch {
      toast.error(
        t('pages.training.training.materials.errors.attach', 'Could not attach the material.')
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={t('pages.training.training.materials.attachMaterial', 'Attach material')}
      />
      <ModalContent>
        <div className="flex flex-col gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.training.training.materials.searchPlaceholder', 'Search...')}
            className="h-[40px] text-sm"
          />

          {isLoading && (
            <div className="p-4 text-center text-xs text-[#6B7280]">
              {t('pages.training.training.materials.loading', 'Loading materials...')}
            </div>
          )}
          {isError && (
            <div className="rounded-md bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]">
              {t('pages.training.training.materials.loadError', 'Failed to load materials.')}
            </div>
          )}
          {!isLoading && !isError && materials.length === 0 && (
            <div className="p-4 text-center text-xs text-[#6B7280]">
              {t('pages.training.training.materials.empty', 'No materials yet.')}
            </div>
          )}

          <div className="flex max-h-[45vh] flex-col divide-y divide-[#F1F1EE] overflow-y-auto">
            {materials.map((m) => {
              const already = attachedIds.has(m.id)
              return (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-[#05040D]">{m.title}</span>
                  {already ? (
                    <span className="text-[10px] font-medium text-[#15803D]">
                      {t('pages.training.training.materials.attached', 'Attached')}
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleAttach(m.id)}
                      disabled={pendingId === m.id}
                    >
                      {t('pages.training.training.materials.attach', 'Attach')}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

export default AttachMaterialPicker
