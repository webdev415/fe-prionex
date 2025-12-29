/**
 * UnlockAccountModal (User Management)
 *
 * Confirmation modal for unlocking a locked user account.
 * Uses the global Modal component for consistent styling.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import type { ApiUser } from '@/features/users/types'
import { useAdminUnlockAccount } from '@/features/users/hooks'
import { HugeiconsIcon } from '@hugeicons/react'
import { LockedIcon } from '@hugeicons/core-free-icons'

interface UnlockAccountModalProps {
  open: boolean
  user: ApiUser
  onClose: () => void
}

export function UnlockAccountModal({ open, user, onClose }: UnlockAccountModalProps) {
  const { t } = useTranslation('common')
  const { mutate, isPending, isError, error } = useAdminUnlockAccount()

  const failedAttempts = user.failed_login_attempts
  const lockedUntil = user.locked_until ? new Date(user.locked_until) : null

  // Backend lockout duration is 18 minutes; derive lockedAt from auto-unlock time
  const LOCKOUT_MINUTES = 18
  const autoUnlockAt = lockedUntil
  const lockedAt =
    autoUnlockAt !== null ? new Date(autoUnlockAt.getTime() - LOCKOUT_MINUTES * 60 * 1000) : null

  // Remaining minutes should be derived from props; compute once per render from lockedUntil.
  const remainingMinutes =
    autoUnlockAt !== null
      ? Math.max(0, Math.ceil((autoUnlockAt.getTime() - new Date().getTime()) / 60000))
      : null

  const handleUnlock = () => {
    if (!user.username) return

    mutate(
      { userId: user.id, username: user.username },
      {
        onSuccess: () => {
          onClose()
        },
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <HugeiconsIcon icon={LockedIcon} size={20} color="#05040D" />
          </div>
        }
        title={
          <span className="flex items-baseline gap-2">
            <span>{t('pages.users.modals.unlock.title')}</span>
            <span className="text-error-500">{t('pages.users.modals.unlock.locked')}</span>
          </span>
        }
      />
      <ModalContent className="space-y-6">
        {/* Account summary */}
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-dark-500 text-base font-medium">
              {t('pages.users.modals.unlock.unlockAccount')}
            </span>{' '}
            <span className="text-dark-500 text-base font-light">{user.username}</span>
          </p>
          <p>
            <span className="text-dark-500 text-base font-light">
              {t('pages.users.modals.unlock.failedAttempts')}
            </span>{' '}
            <span className="text-dark-500 text-base font-medium">{failedAttempts}</span>
          </p>
          {lockedAt && (
            <p>
              <span className="text-dark-500 text-base font-light">
                {t('pages.users.modals.unlock.lockedAt')}
              </span>{' '}
              <span className="text-dark-500 text-base font-medium">
                {lockedAt.toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </p>
          )}
          {autoUnlockAt && (
            <p>
              <span className="text-dark-500 text-base font-light">
                {t('pages.users.modals.unlock.autoUnlockAt')}
              </span>{' '}
              <span className="text-dark-500 text-base font-medium">
                {autoUnlockAt.toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {remainingMinutes !== null && remainingMinutes > 0 && (
                <span className="text-dark-500 ml-1 text-sm font-light">{`(${remainingMinutes} ${t('pages.users.modals.unlock.minRemaining')})`}</span>
              )}
            </p>
          )}
        </div>

        <hr className="border-light-50 border-t" />

        {/* Confirmation copy */}
        <div className="space-y-3 text-sm">
          <p className="text-dark-500 text-lg font-medium">
            {t('pages.users.modals.unlock.confirmTitle')}
          </p>
          <div className="space-y-2">
            <p className="text-dark-500 text-base font-light">
              {t('pages.users.modals.unlock.thisWill')}
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icons.ArrowRight size={14} className="text-dark-500" strokeWidth={1.5} />
                <span className="text-dark-500 text-base font-light">
                  {t('pages.users.modals.unlock.restoreAccess')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.ArrowRight size={14} className="text-dark-500" strokeWidth={1.5} />
                <span className="text-dark-500 text-base font-light">
                  {t('pages.users.modals.unlock.resetCounter')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.ArrowRight size={14} className="text-dark-500" strokeWidth={1.5} />
                <span className="text-dark-500 text-base font-light">
                  {t('pages.users.modals.unlock.recordAudit')}
                </span>
              </div>
            </div>
          </div>

          {isError && (
            <Alert variant="error">
              <p className="text-sm">
                {error?.message || t('pages.users.modals.unlock.failedToUnlock')}
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
          onClick={handleUnlock}
          disabled={isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {isPending
            ? t('pages.users.modals.unlock.unlocking')
            : t('pages.users.modals.unlock.unlockAccountButton')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default UnlockAccountModal
