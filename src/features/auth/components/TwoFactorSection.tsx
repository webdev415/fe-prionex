import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useTwoFactorStatus } from '../hooks'
import { TwoFactorSetupModal } from './TwoFactorSetupModal'
import { TwoFactorDisableModal } from './TwoFactorDisableModal'
import { TwoFactorRegenerateModal } from './TwoFactorRegenerateModal'

interface TwoFactorSectionProps {
  /** Profile sidebar card (Account Security); bordered panel layout. */
  className?: string
}

/**
 * Two-Factor Authentication settings block. Used on Profile Settings (left
 * column under “Account Security”). Enable / Disable / Regenerate via modals.
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
      className={cn(
        'flex w-full flex-col gap-4 self-stretch rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-primary-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <Icons.LockComputer size={20} className="text-dark-500" strokeWidth={1.5} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-dark-500 text-sm leading-tight font-semibold">
              {t('twoFactor.section.title')}
            </span>
            <span className="text-xs leading-snug text-gray-600 sm:text-sm">
              {t('twoFactor.section.description')}
            </span>
          </div>
        </div>

        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
            enabled ? 'bg-green-100 text-green-700' : 'bg-gray-200/80 text-gray-700'
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', enabled ? 'bg-green-600' : 'bg-gray-500')}
          />
          {enabled ? t('twoFactor.section.statusEnabled') : t('twoFactor.section.statusDisabled')}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t('twoFactor.section.loading')}</span>
          <div className="h-4 w-[80%] max-w-xs animate-pulse rounded bg-gray-200" />
          <div className="h-11 w-full animate-pulse rounded-lg bg-gray-200" />
        </div>
      ) : enabled ? (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-gray-600 sm:text-sm">
            {t('twoFactor.section.backupRemaining', { count: remaining })}
            {remaining <= 2 && (
              <span className="ml-1 text-amber-600">{t('twoFactor.section.lowBackupWarning')}</span>
            )}
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRegenerateOpen(true)}
              leftIcon={<Icons.Reload size={18} className="shrink-0" />}
              className="h-auto min-h-11 w-full rounded-md px-3 py-2.5 text-center leading-snug whitespace-normal"
            >
              {t('twoFactor.section.regenerate')}
            </Button>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setDisableOpen(true)}
              className="h-auto min-h-11 w-full rounded-md px-3 py-2.5 text-center leading-snug whitespace-normal"
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
          className="h-11 w-full rounded-md"
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
