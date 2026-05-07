import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { Icons } from '@/lib/icons'
import { useTwoFactorEnable, useTwoFactorSetup } from '../hooks'
import type { TwoFactorSetupResponse } from '@/types/api'
import { BackupCodesPanel } from './BackupCodesPanel'

interface TwoFactorSetupModalProps {
  open: boolean
  onClose: () => void
  /** Called once the user clicks Done after seeing backup codes. */
  onComplete?: () => void
}

type Step = 'qr' | 'verify' | 'backup'

export function TwoFactorSetupModal({ open, onClose, onComplete }: TwoFactorSetupModalProps) {
  const { t } = useTranslation('auth')
  const [step, setStep] = useState<Step>('qr')
  const [code, setCode] = useState('')
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const setupMutation = useTwoFactorSetup()
  const enableMutation = useTwoFactorEnable()
  const verifyInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('qr')
    setCode('')
    setSetupData(null)
    setBackupCodes([])
    setAcknowledged(false)
    setSecretCopied(false)
    setVerifyError(null)
  }

  // Kick off /setup as soon as the modal opens. Reset/state-init runs in a
  // microtask so the effect itself stays free of synchronous setState (lint:
  // react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      reset()
      setupMutation
        .mutateAsync()
        .then((data) => {
          if (!cancelled) setSetupData(data)
        })
        .catch(() => {
          if (!cancelled) toast.error(t('twoFactor.setup.errors.cannotStart'))
        })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Focus the TOTP input when the verify step is shown — replaces autoFocus
  // (jsx-a11y/no-autofocus).
  useEffect(() => {
    if (step !== 'verify') return
    verifyInputRef.current?.focus()
  }, [step])

  const handleClose = () => {
    // Block closing while we're still showing one-time backup codes — the
    // user has to acknowledge they've saved them.
    if (step === 'backup' && !acknowledged) {
      toast.error(t('twoFactor.setup.errors.mustSaveCodes'))
      return
    }
    reset()
    onClose()
  }

  const handleCopySecret = async () => {
    if (!setupData?.secret) return
    try {
      await navigator.clipboard.writeText(setupData.secret)
      setSecretCopied(true)
      window.setTimeout(() => setSecretCopied(false), 2000)
    } catch {
      toast.error(t('twoFactor.backupCodes.copyFailed'))
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifyError(null)
    if (!/^\d{6}$/.test(code)) {
      setVerifyError(t('twoFactor.errors.codeFormat'))
      return
    }
    try {
      const result = await enableMutation.mutateAsync({ code })
      setBackupCodes(result.backup_codes)
      setStep('backup')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: { message?: string } | string } } }
      const detail = e.response?.data?.detail
      const message =
        typeof detail === 'object'
          ? detail?.message
          : (detail as string) || t('twoFactor.errors.verifyFailed')
      setVerifyError(message ?? t('twoFactor.errors.verifyFailed'))
    }
  }

  const handleDone = () => {
    reset()
    onComplete?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="xl" preventOutsideClose nonModal>
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Shield size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={step === 'backup' ? t('twoFactor.setup.backupTitle') : t('twoFactor.setup.title')}
        onClose={handleClose}
      />

      <ModalContent>
        {step === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('twoFactor.setup.qrInstructions')}</p>

            {!setupData ? (
              <div className="flex h-64 items-center justify-center">
                <Icons.Spinner className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${setupData.qr_png_base64}`}
                    alt={t('twoFactor.setup.qrAlt')}
                    className="h-48 w-48 rounded-md border border-gray-200 sm:h-56 sm:w-56"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-gray-500 sm:text-sm">
                    {t('twoFactor.setup.manualEntry')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-light-100 text-dark-500 flex-1 rounded border border-gray-300 px-3 py-2 font-mono text-xs break-all sm:text-sm">
                      {setupData.secret}
                    </code>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleCopySecret}
                      className="h-10 px-3"
                      aria-label={t('twoFactor.setup.copySecret')}
                    >
                      <Icons.Success size={18} />
                      <span className="ml-1 hidden sm:inline">
                        {secretCopied
                          ? t('twoFactor.backupCodes.copied')
                          : t('twoFactor.setup.copySecret')}
                      </span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'verify' && (
          <form id="two-factor-verify-form" onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-gray-600">{t('twoFactor.setup.verifyInstructions')}</p>
            <Input
              ref={verifyInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              label={t('twoFactor.codeLabel')}
              placeholder={t('twoFactor.codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={verifyError ?? undefined}
              className="text-center font-mono tracking-[0.5em]"
            />
          </form>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('twoFactor.setup.backupIntro')}</p>
            <BackupCodesPanel codes={backupCodes} />
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
        )}
      </ModalContent>

      <ModalFooter>
        {step === 'qr' && (
          <>
            <Button
              type="button"
              variant="cancel"
              onClick={handleClose}
              className="h-[45px] flex-1 rounded-md"
            >
              {t('twoFactor.setup.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setStep('verify')}
              disabled={!setupData}
              className="h-[45px] flex-1 rounded-md"
            >
              {t('twoFactor.setup.next')}
            </Button>
          </>
        )}

        {step === 'verify' && (
          <>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setStep('qr')}
              disabled={enableMutation.isPending}
              className="h-[45px] flex-1 rounded-md"
            >
              {t('twoFactor.setup.back')}
            </Button>
            <Button
              type="submit"
              form="two-factor-verify-form"
              variant="primary"
              disabled={enableMutation.isPending || code.length !== 6}
              isLoading={enableMutation.isPending}
              className="h-[45px] flex-1 rounded-md"
            >
              {t('twoFactor.setup.verifyAndEnable')}
            </Button>
          </>
        )}

        {step === 'backup' && (
          <Button
            type="button"
            variant="primary"
            onClick={handleDone}
            disabled={!acknowledged}
            className="h-[45px] w-full rounded-md"
          >
            {t('twoFactor.setup.done')}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}

export default TwoFactorSetupModal
