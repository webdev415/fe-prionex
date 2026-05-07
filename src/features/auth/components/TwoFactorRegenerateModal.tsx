import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button, Input, PasswordInput } from '@/components/ui'
import { Icons } from '@/lib/icons'
import { useTwoFactorRegenerateBackupCodes } from '../hooks'
import { normalizeTwoFactorInput, looksLikeBackupCode } from '../codeInput'
import { BackupCodesPanel } from './BackupCodesPanel'

interface TwoFactorRegenerateModalProps {
  open: boolean
  onClose: () => void
}

export function TwoFactorRegenerateModal({ open, onClose }: TwoFactorRegenerateModalProps) {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState<{ password?: string; code?: string; api?: string }>({})
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)

  const regenerateMutation = useTwoFactorRegenerateBackupCodes()
  // Synchronous guard against double-submit; see TwoFactorDisableModal for
  // the full rationale (React Query's isPending flips on next render).
  const inFlightRef = useRef(false)

  const reset = () => {
    setPassword('')
    setCode('')
    setErrors({})
    setNewCodes(null)
    setAcknowledged(false)
  }

  const handleClose = () => {
    if (newCodes && !acknowledged) {
      toast.error(t('twoFactor.setup.errors.mustSaveCodes'))
      return
    }
    reset()
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
      const result = await regenerateMutation.mutateAsync({ password, code: normalized })
      setNewCodes(result.backup_codes)
      toast.success(t('twoFactor.regenerate.success'))
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { detail?: { code?: string; message?: string } | string } }
      }
      const detail = e.response?.data?.detail
      const detailObj = typeof detail === 'object' ? detail : null
      const baseMessage =
        detailObj?.message ??
        (typeof detail === 'string' ? detail : null) ??
        t('twoFactor.regenerate.errors.failed')
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
    <Modal open={open} onClose={handleClose} maxWidth="xl" preventOutsideClose={!!newCodes}>
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Reload size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('twoFactor.regenerate.title')}
        onClose={handleClose}
      />

      <ModalContent>
        {newCodes ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('twoFactor.regenerate.successIntro')}</p>
            <BackupCodesPanel codes={newCodes} warning={null} />
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>{t('twoFactor.setup.acknowledge')}</span>
            </label>
          </div>
        ) : (
          <form id="two-factor-regenerate-form" onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600">{t('twoFactor.regenerate.intro')}</p>

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
        )}
      </ModalContent>

      <ModalFooter>
        {newCodes ? (
          <Button
            type="button"
            variant="primary"
            onClick={handleClose}
            disabled={!acknowledged}
            className="h-[45px] w-full rounded-md"
          >
            {t('twoFactor.setup.done')}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="cancel"
              onClick={handleClose}
              disabled={regenerateMutation.isPending}
              className="h-[45px] flex-1 rounded-md"
            >
              {t('twoFactor.disable.cancel')}
            </Button>
            <Button
              type="submit"
              form="two-factor-regenerate-form"
              variant="primary"
              isLoading={regenerateMutation.isPending}
              disabled={regenerateMutation.isPending}
              className="h-[45px] flex-1 rounded-md"
            >
              {t('twoFactor.regenerate.confirm')}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  )
}

export default TwoFactorRegenerateModal
