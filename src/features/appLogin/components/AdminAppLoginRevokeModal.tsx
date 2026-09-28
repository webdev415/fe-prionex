/**
 * Admin: unbind every phone of another user (`edit_users`), next to the admin
 * 2FA actions in «Керування користувачами». The bound phones lose their
 * IP-whitelist exemption and their mobile session at once.
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'
import { useAdminAppLoginStatus, useAdminRevokeAllAppLogin } from '../hooks/useAppLogin'
import {
  activeDevices,
  appLoginErrorMessage,
  isFeatureAvailable,
  isFeatureOffError,
} from '../lib/pairing'
import { AppLoginDeviceList } from './AppLoginDeviceList'

interface AdminAppLoginRevokeModalProps {
  open: boolean
  user: { id: number; username: string; email?: string | null }
  onClose: () => void
}

export function AdminAppLoginRevokeModal({ open, user, onClose }: AdminAppLoginRevokeModalProps) {
  const { t } = useTranslation('common')
  const status = useAdminAppLoginStatus(user.id, open)
  const revokeAll = useAdminRevokeAllAppLogin()

  const featureOff =
    isFeatureOffError(status.error) ||
    (status.data !== undefined && !isFeatureAvailable(status.data))
  const devices = activeDevices(status.data)

  const handleConfirm = () => {
    revokeAll.mutate(user.id, {
      onSuccess: () => {
        toast.success(t('pages.users.modals.appLoginRevoke.success'))
        onClose()
      },
    })
  }

  let body: React.ReactNode
  if (status.isLoading) {
    body = (
      <div className="bg-border h-11 w-full animate-pulse rounded-lg" aria-busy="true">
        <span className="sr-only">{t('pages.users.modals.appLoginRevoke.loading')}</span>
      </div>
    )
  } else if (featureOff) {
    body = (
      <p className="text-muted-foreground text-sm">
        {t('pages.users.modals.appLoginRevoke.featureOff')}
      </p>
    )
  } else if (status.isError) {
    body = (
      <Alert variant="error">
        <p className="text-sm break-words">
          {appLoginErrorMessage(status.error, t('pages.users.modals.appLoginRevoke.failed'))}
        </p>
      </Alert>
    )
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-foreground text-sm font-light sm:text-base">
          {t('pages.users.modals.appLoginRevoke.body')}
        </p>
        <AppLoginDeviceList devices={devices} />
      </div>
    )
  }

  const canRevoke = !status.isLoading && !featureOff && !status.isError && devices.length > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Phone size={18} strokeWidth={1.5} className="text-foreground" />
          </div>
        }
        title={t('pages.users.modals.appLoginRevoke.title')}
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
        </div>

        <hr className="border-border border-t" />

        {body}

        {revokeAll.isError && (
          <Alert variant="error">
            <p className="text-sm break-words">
              {appLoginErrorMessage(revokeAll.error, t('pages.users.modals.appLoginRevoke.failed'))}
            </p>
          </Alert>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={revokeAll.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!canRevoke || revokeAll.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {revokeAll.isPending
            ? t('pages.users.modals.appLoginRevoke.revoking')
            : t('pages.users.actions.revokeAppLogin')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AdminAppLoginRevokeModal
