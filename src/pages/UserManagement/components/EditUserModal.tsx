/**
 * EditUserModal Component
 *
 * Modal wrapper for EditUserForm.
 * Uses the same Modal structure as CreateUserModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { EditUserForm } from '@/features/users/components/EditUserForm'
import { useUser } from '@/features/users/hooks/useUser'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface EditUserModalProps {
  open: boolean
  userId: number
  onClose: () => void
  onSuccess: () => void
}

export function EditUserModal({ open, userId, onClose, onSuccess }: EditUserModalProps) {
  const { t } = useTranslation('common')
  const { data: user, isLoading } = useUser(userId)

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.users.modals.edit.title')}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">
              {t('pages.users.modals.edit.loadingUserData')}
            </span>
          </div>
        ) : user ? (
          <EditUserForm user={user} onSuccess={handleSuccess} onCancel={onClose} />
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.users.modals.edit.userNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="h-[45px] flex-1 rounded-lg border-none bg-gray-500 text-sm font-medium text-white"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-user-form"
          variant="primary"
          className="text-dark-500 bg-primary-300 h-[45px] flex-1 rounded-lg border-none text-sm font-medium"
        >
          {t('pages.users.modals.edit.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
