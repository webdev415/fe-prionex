/**
 * UnlockAccountModal (User Management)
 *
 * Confirmation modal for unlocking a locked user account.
 * Uses the global Modal component for consistent styling.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[400] }}
          >
            <HugeiconsIcon icon={LockedIcon} size={20} color={colors.neutral.dark[500]} />
          </div>
        }
        title={
          <span className="flex items-baseline gap-2">
            <span>Account Status:</span>
            <span style={{ color: '#EF4444' }}>Locked</span>
          </span>
        }
      />
      <ModalContent className="space-y-6">
        {/* Account summary */}
        <div className="space-y-1 text-sm">
          <p>
            <span
              style={{
                fontWeight: 500,
                fontSize: '16px',
                color: colors.neutral.dark[500],
              }}
            >
              Unlock Account:
            </span>{' '}
            <span
              style={{
                fontWeight: 300,
                fontSize: '16px',
                color: colors.neutral.dark[500],
              }}
            >
              {user.username}
            </span>
          </p>
          <p>
            <span
              style={{
                fontWeight: 300,
                fontSize: '16px',
                color: colors.neutral.dark[500],
              }}
            >
              Failed Attempts:
            </span>{' '}
            <span
              style={{
                fontWeight: 500,
                fontSize: '16px',
                color: colors.neutral.dark[500],
              }}
            >
              {failedAttempts}
            </span>
          </p>
          {lockedAt && (
            <p>
              <span
                style={{
                  fontWeight: 300,
                  fontSize: '16px',
                  color: colors.neutral.dark[500],
                }}
              >
                Locked At:
              </span>{' '}
              <span
                style={{
                  fontWeight: 500,
                  fontSize: '16px',
                  color: colors.neutral.dark[500],
                }}
              >
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
              <span
                style={{
                  fontWeight: 300,
                  fontSize: '16px',
                  color: colors.neutral.dark[500],
                }}
              >
                Auto-Unlock At:
              </span>{' '}
              <span
                style={{
                  fontWeight: 500,
                  fontSize: '16px',
                  color: colors.neutral.dark[500],
                }}
              >
                {autoUnlockAt.toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {remainingMinutes !== null && remainingMinutes > 0 && (
                <span
                  style={{
                    fontWeight: 300,
                    fontSize: '14px',
                    color: colors.neutral.dark[500],
                    marginLeft: '4px',
                  }}
                >{`(${remainingMinutes} min remaining)`}</span>
              )}
            </p>
          )}
        </div>

        <hr className="border-t" style={{ borderColor: colors.light[100] }} />

        {/* Confirmation copy */}
        <div className="space-y-3 text-sm">
          <p
            className="font-medium"
            style={{ color: colors.neutral.dark[500], fontSize: '18px', fontWeight: 500 }}
          >
            Are you sure you want to unlock this account?
          </p>
          <div className="space-y-2">
            <p className="font-light" style={{ color: colors.neutral.dark[500], fontSize: '16px' }}>
              This will:
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icons.ArrowRight size={14} color={colors.neutral.dark[500]} strokeWidth={1.5} />
                <span
                  className="font-light"
                  style={{ color: colors.neutral.dark[500], fontSize: '16px' }}
                >
                  Immediately restore login access
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.ArrowRight size={14} color={colors.neutral.dark[500]} strokeWidth={1.5} />
                <span
                  className="font-light"
                  style={{ color: colors.neutral.dark[500], fontSize: '16px' }}
                >
                  Reset failed attempt counter
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Icons.ArrowRight size={14} color={colors.neutral.dark[500]} strokeWidth={1.5} />
                <span
                  className="font-light"
                  style={{ color: colors.neutral.dark[500], fontSize: '16px' }}
                >
                  Be recorded in the audit log
                </span>
              </div>
            </div>
          </div>

          {isError && (
            <Alert variant="error">
              <p className="text-sm">{error?.message || 'Failed to unlock account'}</p>
            </Alert>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          className="flex-1"
          style={{
            border: 'none',
            backgroundColor: colors.gray[500],
            color: '#FFFFFF',
            height: '45px',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleUnlock}
          disabled={isPending}
          className="flex-1"
          style={{
            border: 'none',
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            borderRadius: '8px',
            fontWeight: 500,
            height: '45px',
            fontSize: '14px',
          }}
        >
          {isPending ? 'Unlocking...' : 'Unlock Account'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default UnlockAccountModal
