import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button, PasswordInput } from '@/components/ui'
import { Icons } from '@/lib/icons'
import { getErrorStatus } from '@/lib/errors'
import { useDisableAppLogin } from '../hooks/useAppLogin'
import { passwordRefusalMessage } from '../lib/pairing'

interface AppLoginDisableModalProps {
  open: boolean
  onClose: () => void
  /** Called after the API confirmed the switch-off, before the modal closes. */
  onDisabled?: () => void
}

/** Switching the toggle off unbinds every phone at once, so it asks for the password. */
export function AppLoginDisableModal({ open, onClose, onDisabled }: AppLoginDisableModalProps) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ password?: string; api?: string }>({})
  const disable = useDisableAppLogin()
  const inFlightRef = useRef(false)

  const handleClose = () => {
    setPassword('')
    setErrors({})
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlightRef.current) return
    if (!password) {
      setErrors({ password: t('appLogin.enable.errors.passwordRequired') })
      return
    }
    inFlightRef.current = true
    try {
      await disable.mutateAsync({ password })
      toast.success(t('appLogin.disable.success'))
      onDisabled?.()
      handleClose()
    } catch (err: unknown) {
      const status = getErrorStatus(err)
      setErrors({
        api:
          status === 429
            ? t('appLogin.enable.errors.rateLimited')
            : status === 400 || status === 401 || status === 403
              ? passwordRefusalMessage(err, t('appLogin.enable.errors.wrongCredentials'), {
                  INVALID_CREDENTIALS: t('appLogin.enable.errors.wrongPassword'),
                  APP_LOGIN_IMPERSONATION_FORBIDDEN: t('appLogin.enable.errors.impersonation'),
                })
              : t('appLogin.disable.failed'),
      })
    } finally {
      inFlightRef.current = false
    }
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Warning size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('appLogin.disable.title')}
        onClose={handleClose}
      />

      <ModalContent>
        {/* noValidate: the modal shows its own localized messages instead of the
            browser bubble for the required password. */}
        <form id="app-login-disable-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          <p className="text-sm text-gray-600">{t('appLogin.disable.warning')}</p>
          <PasswordInput
            label={t('appLogin.enable.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required
          />
          {errors.api && (
            <div
              role="alert"
              className="bg-error-50 border-error-500 text-error-600 rounded-md border p-3 text-sm"
            >
              {errors.api}
            </div>
          )}
        </form>
      </ModalContent>

      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={handleClose}
          disabled={disable.isPending}
          className="h-[45px] flex-1 rounded-md"
        >
          {t('appLogin.enable.cancel')}
        </Button>
        <Button
          type="submit"
          form="app-login-disable-form"
          variant="primary"
          isLoading={disable.isPending}
          disabled={disable.isPending}
          className="h-[45px] flex-1 rounded-md"
        >
          {t('appLogin.disable.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AppLoginDisableModal
