import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@/components/ui'
import { Icons } from '@/lib/icons'
import { normalizeTwoFactorInput } from '@/features/auth/codeInput'

interface TwoFactorCodeCardProps {
  username?: string | null
  onSubmit: (code: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
  /**
   * Set when `/login` listed `'app'` in `two_factor_methods`: offers going back
   * to the confirmation on the bound phone (Epic 19).
   */
  onUseApp?: () => void
}

/**
 * Shown after a successful password step when the account has Google
 * Authenticator enabled. Accepts either a 6-digit TOTP code or a backup
 * code (`xxxx-xxxx`) — the same field handles both.
 */
export function TwoFactorCodeCard({
  username,
  onSubmit,
  onCancel,
  isLoading = false,
  error,
  onUseApp,
}: TwoFactorCodeCardProps) {
  const { t } = useTranslation('auth')
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [useBackupCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    // Backup codes copy-pasted from PDFs / rich-text editors / email clients
    // can pick up smart-dashes (U+2013/U+2014) or zero-width characters that
    // are invisible but break the bcrypt match. normalizeTwoFactorInput is the same
    // helper the disable / regenerate modals use, so all three backup-code
    // entry points behave identically.
    const submitted = useBackupCode ? normalizeTwoFactorInput(code) : code.trim()
    if (useBackupCode) {
      if (submitted.length < 8) {
        setLocalError(t('twoFactor.errors.backupTooShort'))
        return
      }
    } else if (!/^\d{6}$/.test(submitted)) {
      setLocalError(t('twoFactor.errors.codeFormat'))
      return
    }

    await onSubmit(submitted)
  }

  const handleToggleMode = () => {
    setUseBackupCode((v) => !v)
    setCode('')
    setLocalError(null)
  }

  const displayedError = error || localError

  return (
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <div className="bg-primary-300 mb-3 flex h-12 w-12 items-center justify-center rounded-full sm:mb-4">
          <Icons.Shield size={24} className="text-primary-foreground" strokeWidth={2} />
        </div>
        <h1 className="text-foreground text-2xl font-medium md:text-[30px]">
          {t('twoFactor.title')}
        </h1>
        <p className="text-muted-foreground mt-1.5 px-2 text-sm font-light sm:mt-2 sm:px-0 sm:text-base">
          {useBackupCode ? t('twoFactor.subtitleBackup') : t('twoFactor.subtitle')}
        </p>
        {username && (
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {t('twoFactor.signedInAs', { username })}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4" noValidate>
        <Input
          ref={inputRef}
          type="text"
          inputSize="xl"
          inputMode={useBackupCode ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useBackupCode ? 32 : 6}
          label={useBackupCode ? t('twoFactor.backupCodeLabel') : t('twoFactor.codeLabel')}
          placeholder={
            useBackupCode ? t('twoFactor.backupCodePlaceholder') : t('twoFactor.codePlaceholder')
          }
          value={code}
          onChange={(e) => {
            const v = useBackupCode ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(v)
          }}
          disabled={isLoading}
          className={`text-sm sm:text-base ${useBackupCode ? '' : 'text-center font-mono tracking-[0.5em]'}`}
        />

        {displayedError && (
          <div className="bg-error-50 border-error-500 text-body-xs sm:text-body-sm text-error-600 rounded-md border p-2.5 sm:rounded-lg sm:p-3">
            {displayedError}
          </div>
        )}

        <Button
          type="submit"
          size="xl"
          className="mt-4 w-full text-sm sm:mt-6 sm:text-base md:mt-8"
          isLoading={isLoading}
          disabled={isLoading || code.length === 0}
        >
          {t('twoFactor.submit')}
        </Button>

        <Button
          type="button"
          variant="light"
          size="xl"
          className="w-full text-sm sm:text-base"
          onClick={handleToggleMode}
          disabled={isLoading}
        >
          {useBackupCode ? t('twoFactor.useAuthenticatorApp') : t('twoFactor.useBackupCode')}
        </Button>

        {onUseApp && (
          <Button
            type="button"
            variant="light"
            size="xl"
            className="w-full text-sm sm:text-base"
            onClick={onUseApp}
            disabled={isLoading}
          >
            {t('appLogin.approval.useApp')}
          </Button>
        )}

        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="text-primary-600 hover:text-primary-700 mt-2 w-full text-center text-xs underline-offset-2 hover:underline disabled:opacity-50 sm:text-sm"
        >
          {t('twoFactor.backToLogin')}
        </button>
      </form>
    </div>
  )
}

export default TwoFactorCodeCard
