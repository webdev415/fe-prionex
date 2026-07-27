/**
 * Confirmation modal for admin reset-password (default password applied server-side).
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import type { ApiUser } from '@/features/users/types'
import { useResetPassword } from '@/features/users/hooks'

interface ResetPasswordConfirmModalProps {
  open: boolean
  user: ApiUser
  onClose: () => void
}

export function ResetPasswordConfirmModal({ open, user, onClose }: ResetPasswordConfirmModalProps) {
  const { t } = useTranslation('common')
  const { mutate, isPending, isError, error } = useResetPassword()

  const handleConfirm = () => {
    mutate(user.id, {
      onSuccess: (data) => {
        toast.success(data.message)
        onClose()
      },
      onError: (err: Error) => {
        console.error('Reset password failed:', err)
      },
    })
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.LockSync01 size={18} strokeWidth={1.5} className="text-foreground" />
          </div>
        }
        title={t('pages.users.modals.resetPassword.title')}
      />
      <ModalContent className="space-y-4 sm:space-y-6">
        <div className="space-y-1 text-sm sm:space-y-2">
          <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-foreground text-sm font-medium sm:text-base">
              {t('pages.users.modals.changeStatus.username')}
            </span>
            <span className="text-foreground text-sm font-light break-words sm:text-base">
              {user.username}
            </span>
          </p>
          <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-foreground text-sm font-medium sm:text-base">
              {t('pages.users.modals.changeStatus.email')}
            </span>
            <span className="text-foreground text-sm font-light break-words sm:text-base">
              {user.email || '—'}
            </span>
          </p>
        </div>

        <hr className="border-border border-t" />

        <div className="space-y-2 text-sm sm:space-y-3">
          <p className="text-foreground text-base font-medium sm:text-lg">
            {t('pages.users.modals.resetPassword.confirmTitle')}
          </p>
          <p className="text-foreground text-sm font-light sm:text-base">
            {t('pages.users.modals.resetPassword.confirmBody')}
          </p>
          <p className="text-foreground text-sm font-medium break-all sm:text-base">
            {t('pages.users.modals.resetPassword.confirmDetail', { password: 'Crm_user_123' })}
          </p>
          {isError && (
            <Alert variant="error">
              <p className="text-sm break-words">
                {error?.message || t('pages.users.modals.resetPassword.failed')}
              </p>
            </Alert>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {isPending
            ? t('pages.users.modals.resetPassword.resetting')
            : t('pages.users.actions.resetPassword')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ResetPasswordConfirmModal
