/**
 * EditTargetActionModal — wraps TargetActionForm for the edit flow.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { TargetActionForm } from './TargetActionForm'
import { useTargetAction } from '@/features/targetActions/hooks/useTargetActions'

interface EditTargetActionModalProps {
  open: boolean
  taId: number
  onClose: () => void
  onSuccess: () => void
}

const FORM_ID = 'edit-target-action-form'

export function EditTargetActionModal({
  open,
  taId,
  onClose,
  onSuccess,
}: EditTargetActionModalProps) {
  const { t } = useTranslation('common')
  const { data: ta, isLoading } = useTargetAction(taId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full">
            <Icons.PencilEdit size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.targetActions.modals.edit.title')}
      />
      <ModalContent>
        {isLoading || !ta ? (
          <div className="text-sm text-gray-500">{t('common.loading')}</div>
        ) : (
          <TargetActionForm
            formId={FORM_ID}
            initial={ta}
            onSuccess={() => {
              onSuccess()
              onClose()
            }}
          />
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
          disabled={!ta || ta.usage_count > 0}
          className="flex-1"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
