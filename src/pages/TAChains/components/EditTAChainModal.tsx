import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { TAChainForm } from './TAChainForm'
import { EditTAChainFormSkeleton } from './EditTAChainFormSkeleton'
import { useTAChain } from '@/features/taChains/hooks/useTAChains'

interface Props {
  open: boolean
  chainId: number
  onClose: () => void
  onSuccess: () => void
}

const FORM_ID = 'edit-ta-chain-form'

export function EditTAChainModal({ open, chainId, onClose, onSuccess }: Props) {
  const { t } = useTranslation('common')
  const { data: chain, isPending } = useTAChain(chainId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full">
            <Icons.PencilEdit size={18} className="text-primary-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.taChains.modals.edit.title')}
      />
      <ModalContent>
        {isPending ? (
          <EditTAChainFormSkeleton />
        ) : chain ? (
          <TAChainForm
            formId={FORM_ID}
            initial={chain}
            onSuccess={() => {
              onSuccess()
              onClose()
            }}
          />
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t('pages.taChains.modals.edit.notFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="flex-1">
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          variant="primary"
          disabled={isPending || !chain}
          className="flex-1"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
