import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Icons } from '@/lib/icons'
import { useDeleteTAChain } from '@/features/taChains/hooks/useTAChains'
import type { TAChain } from '@/features/taChains/api/types'
import { getErrorMessage } from '@/lib/errors'

export interface DeleteTAChainModalProps {
  open: boolean
  chain: TAChain | null
  onClose: () => void
  onSuccess?: () => void
}

export function DeleteTAChainModal({ open, chain, onClose, onSuccess }: DeleteTAChainModalProps) {
  const { t } = useTranslation('common')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteMut = useDeleteTAChain()

  const handleClose = () => {
    if (deleteMut.isPending) return
    setConfirmDelete(false)
    onClose()
  }

  const handleConfirm = async () => {
    if (!chain || !confirmDelete) return
    try {
      await deleteMut.mutateAsync(chain.id)
      toast.success(t('pages.taChains.toasts.deleted'))
      setConfirmDelete(false)
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const chainTypeLabel = chain ? t(`pages.taChains.chainTypes.${chain.chain_type}`) : ''

  return (
    <Modal open={open} onClose={handleClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.taChains.modals.delete.title')}
        className="pb-6"
      />
      <ModalContent>
        <div className="border-error-200 bg-error-50 mb-4 flex w-full items-start gap-3 rounded-xl border px-6 py-3">
          <Icons.Warning size={28} className="text-error-500 flex-shrink-0" strokeWidth={2} />
          <span className="text-error-500 text-left text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.taChains.modals.delete.warning')}
          </span>
        </div>

        {chain && (
          <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
            <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
              {t('pages.taChains.modals.delete.chainDetails')}
            </span>
            <div className="flex flex-col items-start justify-center gap-3 self-stretch rounded-xl border border-white bg-white/50 px-4 py-4 sm:px-6 sm:py-5">
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.taChains.table.name')}: <span className="font-medium">{chain.name}</span>
              </span>
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.taChains.table.steps')}:{' '}
                <span className="font-medium">{chain.step_count}</span>
              </span>
              <span className="text-dark-500 text-xs leading-[150%] font-light tracking-[-0.28px] sm:text-sm">
                {t('pages.taChains.table.type')}:{' '}
                <span className="font-medium">{chainTypeLabel}</span>
              </span>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-col items-start gap-2 self-stretch">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.taChains.modals.delete.whatHappensTitle')}
          </span>
          <ul className="text-dark-500 list-disc space-y-2 pl-5 text-xs sm:text-sm">
            <li>{t('pages.taChains.modals.delete.bulletRemoveRow')}</li>
            <li>{t('pages.taChains.modals.delete.bulletRefusedIfUsed')}</li>
            <li>{t('pages.taChains.modals.delete.bulletCascadeChildren')}</li>
          </ul>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <Checkbox
            id="confirm-delete-ta-chain"
            checked={confirmDelete}
            onCheckedChange={(checked) => setConfirmDelete(checked as boolean)}
            disabled={deleteMut.isPending}
            className="mt-1"
          />
          <label
            htmlFor="confirm-delete-ta-chain"
            className="text-dark-500 cursor-pointer text-sm leading-[150%] font-medium"
          >
            {t('pages.taChains.modals.delete.acknowledge')}
          </label>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={deleteMut.isPending}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirm}
          disabled={!confirmDelete || deleteMut.isPending}
          {...(deleteMut.isPending && { loading: true })}
        >
          {deleteMut.isPending
            ? t('pages.taChains.modals.delete.deleting')
            : t('pages.taChains.actions.delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
