/**
 * UserDetailModal Component
 *
 * Modal wrapper for viewing user details.
 * Uses the same Modal structure as CreateUserModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { ViewUserForm } from '@/features/users/components/ViewUserForm'
import { useUser } from '@/features/users/hooks/useUser'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface UserDetailModalProps {
  open: boolean
  userId: number
  onClose: () => void
}

export function UserDetailModal({ open, userId, onClose }: UserDetailModalProps) {
  const { t } = useTranslation('common')
  const { data: user, isLoading } = useUser(userId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.View size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.users.modals.view.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : user ? (
          <ViewUserForm user={user} />
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.users.modals.view.userNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
