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
  className?: string
}

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
        'border-border flex w-full flex-col gap-4 self-stretch rounded-xl border bg-gray-50 p-5',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="bg-primary-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icons.LockComputer size={20} className="text-foreground" strokeWidth={1.5} />
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
            enabled ? 'bg-success-100 text-success-700' : 'bg-border/80 text-muted-foreground'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              enabled ? 'bg-success-600' : 'bg-muted-foreground'
            )}
          />
          {enabled ? t('twoFactor.section.statusEnabled') : t('twoFactor.section.statusDisabled')}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm leading-tight font-semibold">
          {t('twoFactor.section.title')}
        </span>
        <span className="text-muted-foreground text-xs leading-snug sm:text-sm">
          {t('twoFactor.section.description')}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t('twoFactor.section.loading')}</span>
          <div className="bg-border h-11 w-full animate-pulse rounded-lg" />
        </div>
      ) : enabled ? (
        <div className="flex flex-col gap-4">
          <div className="text-muted-foreground text-xs sm:text-sm">
            {t('twoFactor.section.backupRemaining', { count: remaining })}
            {remaining <= 2 && (
              <span className="text-warning-600 ml-1">
                {t('twoFactor.section.lowBackupWarning')}
              </span>
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
