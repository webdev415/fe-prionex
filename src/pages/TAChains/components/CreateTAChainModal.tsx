import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { TAChainForm } from './TAChainForm'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const FORM_ID = 'create-ta-chain-form'

export function CreateTAChainModal({ open, onClose, onSuccess }: Props) {
  const { t } = useTranslation('common')

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full">
            <Icons.Add size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.taChains.modals.create.title')}
      />
      <ModalContent>
        <TAChainForm
          formId={FORM_ID}
          onSuccess={() => {
            onSuccess()
            onClose()
          }}
        />
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="flex-1">
          {t('actions.cancel')}
        </Button>
        <Button type="submit" form={FORM_ID} variant="primary" className="flex-1">
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
