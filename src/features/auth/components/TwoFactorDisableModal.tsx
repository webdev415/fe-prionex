import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button, Input, PasswordInput } from '@/components/ui'
import { Icons } from '@/lib/icons'
import { useTwoFactorDisable } from '../hooks'
import { normalizeTwoFactorInput, looksLikeBackupCode } from '../codeInput'

interface TwoFactorDisableModalProps {
  open: boolean
  onClose: () => void
  onDisabled?: () => void
}

export function TwoFactorDisableModal({ open, onClose, onDisabled }: TwoFactorDisableModalProps) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ password?: string; code?: string; api?: string }>({})

  const disableMutation = useTwoFactorDisable()
  // React Query's `isPending` flag flips on the next render; without a
  // synchronous guard, two clicks within ~16 ms can both pass the disabled
  // check and fire two POSTs. The first consumes the backup code and disables
  // 2FA, the second arrives with a now-consumed code and surfaces a spurious
  // "Invalid or expired" error.
  const inFlightRef = useRef(false)

  const handleClose = () => {
    setPassword('')
    setCode('')
    setErrors({})
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlightRef.current) return
    const next: typeof errors = {}
    if (!password) next.password = t('twoFactor.disable.errors.passwordRequired')
    if (!code) next.code = t('twoFactor.disable.errors.codeRequired')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const normalized = normalizeTwoFactorInput(code)
    inFlightRef.current = true
    try {
      await disableMutation.mutateAsync({ password, code: normalized })
      toast.success(t('twoFactor.disable.success'))
      handleClose()
      onDisabled?.()
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: { code?: string; message?: string } | string } }
      }
      const detail = e.response?.data?.detail
      const detailObj = typeof detail === 'object' ? detail : null
      const baseMessage =
        detailObj?.message ??
        (typeof detail === 'string' ? detail : null) ??
        t('twoFactor.disable.errors.failed')
      // Backend collapses "wrong code" and "already-used backup code" into a
      // single INVALID_TWO_FACTOR_CODE response. When the input clearly isn't
      // a 6-digit TOTP, surface a hint that an already-used backup code looks
      // the same.
      const showBackupHint =
        detailObj?.code === 'INVALID_TWO_FACTOR_CODE' && looksLikeBackupCode(normalized)
      setErrors({
        api: showBackupHint
          ? `${baseMessage} ${t('twoFactor.disable.errors.backupAlreadyUsedHint')}`
          : baseMessage,
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
        title={t('twoFactor.disable.title')}
        onClose={handleClose}
      />

      <ModalContent>
        <form id="two-factor-disable-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm whitespace-pre-line text-gray-600">
            {t('twoFactor.disable.warning')}
          </p>

          <PasswordInput
            label={t('twoFactor.disable.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
            required
          />

          <Input
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            label={t('twoFactor.disable.codeLabel')}
            placeholder={t('twoFactor.disable.codePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={errors.code}
            maxLength={32}
          />

          {errors.api && (
            <div className="bg-error-50 border-error-500 text-error-600 rounded-md border p-3 text-sm">
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
          disabled={disableMutation.isPending}
          className="h-[45px] flex-1 rounded-md"
        >
          {t('twoFactor.disable.cancel')}
        </Button>
        <Button
          type="submit"
          form="two-factor-disable-form"
          variant="primary"
          isLoading={disableMutation.isPending}
          disabled={disableMutation.isPending}
          className="h-[45px] flex-1 rounded-md"
        >
          {t('twoFactor.disable.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default TwoFactorDisableModal
