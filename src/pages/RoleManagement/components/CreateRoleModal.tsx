/**
 * CreateRoleModal Component
 *
 * Modal wrapper for CreateRoleForm using the same structure as CreateUserModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { CreateRoleForm } from '@/features/roles/components/CreateRoleForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface CreateRoleModalProps {
  open: boolean
  projectId: number
  onClose: () => void
  onSuccess: () => void
}

export function CreateRoleModal({ open, projectId, onClose, onSuccess }: CreateRoleModalProps) {
  const { t } = useTranslation('common')

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} color="#05040D" strokeWidth={2} />
          </div>
        }
        title={t('pages.roles.modals.create.title')}
        onClose={onClose}
      />
      <ModalContent>
        <CreateRoleForm projectId={projectId} onSuccess={handleSuccess} onCancel={onClose} />
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="create-role-form"
          variant="primary"
          className="text-dark-500 bg-primary-300 h-[45px] flex-1 rounded-md border-none text-sm font-medium"
        >
          {t('pages.roles.modals.create.createRole')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
