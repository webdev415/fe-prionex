import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useTwoFactorStatus } from '../hooks'
import { TwoFactorSetupModal } from './TwoFactorSetupModal'
import { TwoFactorDisableModal } from './TwoFactorDisableModal'
import { TwoFactorRegenerateModal } from './TwoFactorRegenerateModal'

interface TwoFactorSectionProps {
  /** Render inside the Profile Settings right-hand card. */
  className?: string
}

/**
 * Two-Factor Authentication settings block. Sits in Profile Settings under
 * the "Edit User" form. Shows current status and exposes Enable / Disable /
 * Regenerate-codes flows via dialog modals.
 */
export function TwoFactorSection({ className }: TwoFactorSectionProps) {
  const { t } = useTranslation('auth')
  const { data: status, isLoading } = useTwoFactorStatus()
  const [setupOpen, setSetupOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)

  const enabled = status?.enabled ?? false
  const remaining = status?.backup_codes_remaining ?? 0

  return (
    <div
      className={`flex w-full flex-col gap-3 self-stretch border-t border-gray-200 pt-4 sm:gap-4 sm:pt-6 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10 ${
              enabled ? 'bg-primary-300' : 'bg-gray-100'
            }`}
          >
            <Icons.Shield
              size={20}
              className={enabled ? 'text-dark-500' : 'text-gray-500'}
              strokeWidth={2}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-dark-500 text-sm font-medium sm:text-base">
              {t('twoFactor.section.title')}
            </span>
            <span className="text-xs text-gray-500 sm:text-sm">
              {t('twoFactor.section.description')}
            </span>
          </div>
        </div>

        <span
          className={`flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-green-600' : 'bg-gray-400'}`}
          />
          {enabled ? t('twoFactor.section.statusEnabled') : t('twoFactor.section.statusDisabled')}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Icons.Spinner className="h-4 w-4 animate-spin" />
          {t('twoFactor.section.loading')}
        </div>
      ) : enabled ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-600 sm:text-sm">
            {t('twoFactor.section.backupRemaining', { count: remaining })}
            {remaining <= 2 && (
              <span className="ml-1 text-amber-600">{t('twoFactor.section.lowBackupWarning')}</span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRegenerateOpen(true)}
              leftIcon={<Icons.Reload size={18} />}
              className="h-10"
            >
              {t('twoFactor.section.regenerate')}
            </Button>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setDisableOpen(true)}
              className="h-10"
            >
              {t('twoFactor.section.disable')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="primary"
          onClick={() => setSetupOpen(true)}
          leftIcon={<Icons.Shield size={20} />}
          className="h-11 w-full sm:w-auto sm:self-start"
        >
          {t('twoFactor.section.enable')}
        </Button>
      )}

      <TwoFactorSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
      <TwoFactorDisableModal open={disableOpen} onClose={() => setDisableOpen(false)} />
      <TwoFactorRegenerateModal open={regenerateOpen} onClose={() => setRegenerateOpen(false)} />
    </div>
  )
}

export default TwoFactorSection
