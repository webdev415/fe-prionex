import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button, Input, PasswordInput } from '@/components/ui'
import { Icons } from '@/lib/icons'
import { getErrorStatus } from '@/lib/errors'
import { useTwoFactorStatus } from '@/features/auth/hooks/useTwoFactor'
import { normalizeTwoFactorInput } from '@/features/auth/codeInput'
import { useEnableAppLogin } from '../hooks/useAppLogin'
import { passwordRefusalMessage, refusalCode } from '../lib/pairing'
import type { AppLoginPairing } from '../types'

interface AppLoginEnableModalProps {
  open: boolean
  onClose: () => void
  /** Called with the fresh pairing code once the password (and 2FA code) is accepted. */
  onPairingIssued: (pairing: AppLoginPairing) => void
}

/**
 * «Підтвердіть, що це ви» — the password (plus the Google Authenticator code
 * when 2FA is on) before a pairing code is issued. Used both for the first
 * phone and for «Прив'язати ще один телефон».
 */
export function AppLoginEnableModal({ open, onClose, onPairingIssued }: AppLoginEnableModalProps) {
  const { t } = useTranslation('auth')
  // Until 2FA status is known the form cannot tell whether the code is needed.
  const { data: twoFactor, isLoading: twoFactorLoading } = useTwoFactorStatus(open)
  // The server is the judge: a cached 2FA status can be stale (2FA switched on
  // in another tab), and then the API answers TWO_FACTOR_CODE_REQUIRED — the
  // field must appear instead of a dead end.
  const [serverWantsCode, setServerWantsCode] = useState(false)
  const needsCode = twoFactor?.enabled === true || serverWantsCode

  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ password?: string; code?: string; api?: string }>({})
  const enable = useEnableAppLogin()
  // Same double-click guard as the 2FA modals: `isPending` flips a render late.
  const inFlightRef = useRef(false)

  const reset = () => {
    setPassword('')
    setCode('')
    setErrors({})
    setServerWantsCode(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlightRef.current) return
    const next: typeof errors = {}
    if (!password) next.password = t('appLogin.enable.errors.passwordRequired')
    if (needsCode && !code) next.code = t('appLogin.enable.errors.codeRequired')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    inFlightRef.current = true
    try {
      const pairing = await enable.mutateAsync({
        password,
        ...(needsCode ? { code: normalizeTwoFactorInput(code) } : {}),
      })
      reset()
      onPairingIssued(pairing)
    } catch (err: unknown) {
      const status = getErrorStatus(err)
      if (refusalCode(err) === 'TWO_FACTOR_CODE_REQUIRED') {
        setServerWantsCode(true)
        setErrors({ code: t('appLogin.enable.errors.codeRequired') })
        return
      }
      setErrors({
        api:
          status === 429
            ? t('appLogin.enable.errors.rateLimited')
            : status === 400 || status === 401 || status === 403
              ? passwordRefusalMessage(err, t('appLogin.enable.errors.wrongCredentials'), {
                  INVALID_CREDENTIALS: t('appLogin.enable.errors.wrongCredentials'),
                  INVALID_TWO_FACTOR_CODE: t('appLogin.enable.errors.wrongCredentials'),
                  APP_LOGIN_IMPERSONATION_FORBIDDEN: t('appLogin.enable.errors.impersonation'),
                })
              : t('appLogin.enable.errors.failed'),
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
            <Icons.Shield size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('appLogin.enable.title')}
        onClose={handleClose}
      />

      <ModalContent>
        {/* noValidate: the modal shows its own localized messages instead of the
            browser bubble for the required password. */}
        <form id="app-login-enable-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          <p className="text-sm text-gray-600">{t('appLogin.enable.intro')}</p>

          <PasswordInput
            label={t('appLogin.enable.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required
          />

          {needsCode && (
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              label={t('appLogin.enable.codeLabel')}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={errors.code}
              maxLength={32}
            />
          )}

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
          disabled={enable.isPending}
          className="h-[45px] flex-1 rounded-md"
        >
          {t('appLogin.enable.cancel')}
        </Button>
        <Button
          type="submit"
          form="app-login-enable-form"
          variant="primary"
          isLoading={enable.isPending}
          disabled={enable.isPending || twoFactorLoading === true}
          className="h-[45px] flex-1 rounded-md"
        >
          {t('appLogin.enable.submit')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AppLoginEnableModal
