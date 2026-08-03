/**
 * EditTargetActionModal — wraps TargetActionForm for the edit flow.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { TargetActionForm } from './TargetActionForm'
import { EditTargetActionFormSkeleton } from './EditTargetActionFormSkeleton'
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
  const { data: ta, isPending } = useTargetAction(taId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full">
            <Icons.PencilEdit size={18} className="text-primary-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.targetActions.modals.edit.title')}
      />
      <ModalContent>
        {isPending ? (
          <EditTargetActionFormSkeleton />
        ) : ta ? (
          <TargetActionForm
            formId={FORM_ID}
            initial={ta}
            onSuccess={() => {
              onSuccess()
              onClose()
            }}
          />
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {t('pages.targetActions.modals.edit.notFound')}
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
          disabled={!ta || ta.usage_count > 0}
          className="flex-1"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
