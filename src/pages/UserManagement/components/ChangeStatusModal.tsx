/**
 * ChangeStatusModal (User Management)
 *
 * Confirmation modal for changing a user's account status (active/inactive).
 * Uses the global Modal component for consistent styling.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import type { ApiUser } from '@/features/users/types'
import { useUpdateUser } from '@/features/users/hooks'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserIcon } from '@hugeicons/core-free-icons'

interface ChangeStatusModalProps {
  open: boolean
  user: ApiUser
  newStatus: 'active' | 'inactive'
  onClose: () => void
}

export function ChangeStatusModal({ open, user, newStatus, onClose }: ChangeStatusModalProps) {
  const { t } = useTranslation('common')
  const { mutate, isPending, isError, error } = useUpdateUser()

  const isActivating = newStatus === 'active'
  const currentStatus = user.status

  const handleChangeStatus = () => {
    mutate(
      {
        userId: user.id,
        data: { status: newStatus },
      },
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
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <HugeiconsIcon icon={UserIcon} size={18} color="#05040D" />
          </div>
        }
        title={
          isActivating
            ? t('pages.users.modals.changeStatus.activateTitle')
            : t('pages.users.modals.changeStatus.deactivateTitle')
        }
      />
      <ModalContent className="space-y-4 sm:space-y-6">
        {/* Account summary */}
        <div className="space-y-1 text-sm sm:space-y-2">
          <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-dark-500 text-sm font-medium sm:text-base">
              {t('pages.users.modals.changeStatus.username')}
            </span>
            <span className="text-dark-500 text-sm font-light break-words sm:text-base">
              {user.username}
            </span>
          </p>
          <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-dark-500 text-sm font-medium sm:text-base">
              {t('pages.users.modals.changeStatus.email')}
            </span>
            <span className="text-dark-500 text-sm font-light break-words sm:text-base">
              {user.email}
            </span>
          </p>
          <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-dark-500 text-sm font-medium sm:text-base">
              {t('pages.users.modals.changeStatus.currentStatus')}
            </span>
            <span className="text-dark-500 text-sm font-medium break-words sm:text-base">
              {currentStatus === 'active'
                ? t('pages.users.status.active')
                : t('pages.users.status.inactive')}
            </span>
          </p>
          <p className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-dark-500 text-sm font-medium sm:text-base">
              {t('pages.users.modals.changeStatus.newStatus')}
            </span>
            <span
              className={`text-sm font-medium break-words sm:text-base ${
                isActivating ? 'text-success-500' : 'text-error-500'
              }`}
            >
              {newStatus === 'active'
                ? t('pages.users.status.active')
                : t('pages.users.status.inactive')}
            </span>
          </p>
        </div>

        <hr className="border-light-50 border-t" />

        {/* Confirmation copy */}
        <div className="space-y-2 text-sm sm:space-y-3">
          <p className="text-dark-500 text-base font-medium sm:text-lg">
            {isActivating
              ? t('pages.users.modals.changeStatus.activateConfirmTitle')
              : t('pages.users.modals.changeStatus.deactivateConfirmTitle')}
          </p>
          <div className="space-y-2">
            <p className="text-dark-500 text-sm font-light sm:text-base">
              {isActivating
                ? t('pages.users.modals.changeStatus.activateWillAllow')
                : t('pages.users.modals.changeStatus.deactivateWillPrevent')}
            </p>
            <div className="space-y-1">
              {isActivating ? (
                <>
                  <div className="flex items-start gap-2 sm:items-center">
                    <Icons.ArrowRight
                      size={14}
                      className="text-dark-500 mt-0.5 shrink-0 sm:mt-0"
                      strokeWidth={1.5}
                    />
                    <span className="text-dark-500 text-sm font-light break-words sm:text-base">
                      {t('pages.users.modals.changeStatus.allowLogin')}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 sm:items-center">
                    <Icons.ArrowRight
                      size={14}
                      className="text-dark-500 mt-0.5 shrink-0 sm:mt-0"
                      strokeWidth={1.5}
                    />
                    <span className="text-dark-500 text-sm font-light break-words sm:text-base">
                      {t('pages.users.modals.changeStatus.accessSystem')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 sm:items-center">
                    <Icons.ArrowRight
                      size={14}
                      className="text-dark-500 mt-0.5 shrink-0 sm:mt-0"
                      strokeWidth={1.5}
                    />
                    <span className="text-dark-500 text-sm font-light break-words sm:text-base">
                      {t('pages.users.modals.changeStatus.preventLogin')}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 sm:items-center">
                    <Icons.ArrowRight
                      size={14}
                      className="text-dark-500 mt-0.5 shrink-0 sm:mt-0"
                      strokeWidth={1.5}
                    />
                    <span className="text-dark-500 text-sm font-light break-words sm:text-base">
                      {t('pages.users.modals.changeStatus.terminateSessions')}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-start gap-2 sm:items-center">
                <Icons.ArrowRight
                  size={14}
                  className="text-dark-500 mt-0.5 shrink-0 sm:mt-0"
                  strokeWidth={1.5}
                />
                <span className="text-dark-500 text-sm font-light break-words sm:text-base">
                  {t('pages.users.modals.changeStatus.recordAudit')}
                </span>
              </div>
            </div>
          </div>

          {isError && (
            <Alert variant="error">
              <p className="text-sm break-words">
                {error?.message || t('pages.users.modals.changeStatus.failedToChange')}
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
          onClick={handleChangeStatus}
          disabled={isPending}
          className="h-[45px] flex-1 text-sm"
          variant={isActivating ? 'primary' : 'danger'}
        >
          {isPending
            ? t('pages.users.modals.changeStatus.changing')
            : isActivating
              ? t('pages.users.modals.changeStatus.activateButton')
              : t('pages.users.modals.changeStatus.deactivateButton')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ChangeStatusModal
