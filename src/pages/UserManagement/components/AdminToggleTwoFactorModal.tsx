/**
 * Confirmation modal for admin disable / re-enable of a user's 2FA.
 *
 * Mode is driven by the user's current ``two_factor_enabled`` flag. When
 * enabled, the modal disables (preserving the secret + backup codes) so
 * the user can log in with password only on the next attempt. When
 * disabled (and a secret is preserved), it re-enables.
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import type { ApiUser } from '@/features/users/types'
import { useAdminDisableTwoFactor, useAdminReenableTwoFactor } from '@/features/users/hooks'

interface AdminToggleTwoFactorModalProps {
  open: boolean
  user: ApiUser
  onClose: () => void
}

export function AdminToggleTwoFactorModal({ open, user, onClose }: AdminToggleTwoFactorModalProps) {
  const { t } = useTranslation('common')

  const isCurrentlyEnabled = user.two_factor_enabled
  const action: 'disable' | 'reenable' = isCurrentlyEnabled ? 'disable' : 'reenable'

  const disable = useAdminDisableTwoFactor()
  const reenable = useAdminReenableTwoFactor()
  const active = action === 'disable' ? disable : reenable

  const handleConfirm = () => {
    active.mutate(user.id, {
      onSuccess: (data) => {
        toast.success(data.message)
        onClose()
      },
      onError: (err: Error) => {
        console.error(`Admin 2FA ${action} failed:`, err)
      },
    })
  }

  const titleKey =
    action === 'disable'
      ? 'pages.users.modals.adminToggleTwoFactor.disableTitle'
      : 'pages.users.modals.adminToggleTwoFactor.reenableTitle'

  const bodyKey =
    action === 'disable'
      ? 'pages.users.modals.adminToggleTwoFactor.disableBody'
      : 'pages.users.modals.adminToggleTwoFactor.reenableBody'

  const confirmLabelKey =
    action === 'disable'
      ? 'pages.users.actions.disableTwoFactor'
      : 'pages.users.actions.reenableTwoFactor'

  const pendingLabelKey =
    action === 'disable'
      ? 'pages.users.modals.adminToggleTwoFactor.disabling'
      : 'pages.users.modals.adminToggleTwoFactor.reenabling'

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Shield size={18} strokeWidth={1.5} className="text-foreground" />
          </div>
        }
        title={t(titleKey)}
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
          <p className="text-foreground text-sm font-light sm:text-base">{t(bodyKey)}</p>
          {active.isError && (
            <Alert variant="error">
              <p className="text-sm break-words">
                {active.error?.message || t('pages.users.modals.adminToggleTwoFactor.failed')}
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
          disabled={active.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={active.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {active.isPending ? t(pendingLabelKey) : t(confirmLabelKey)}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AdminToggleTwoFactorModal
