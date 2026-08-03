import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { DepartmentSyncSettings, SyncInterval } from '../../../settings/types'
import { SYNC_INTERVAL_OPTIONS } from '../constants'

interface SyncSettingsCardProps {
  syncSettings: DepartmentSyncSettings
  onSyncIntervalChange: (interval: SyncInterval) => Promise<void>
  isSaving?: boolean
  readOnly?: boolean
}

function formatLastSynced(iso: string, t: TFunction<'common'>): string {
  if (!iso) {
    return t('pages.lawyerWorkplace.settings.mailboxes.sync.neverSynced', 'Never')
  }
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) {
    return t('pages.lawyerWorkplace.settings.mailboxes.sync.lastSyncedMinutes', {
      count: minutes,
      defaultValue: `${minutes} min ago`,
    })
  }
  const hours = Math.round(minutes / 60)
  return t('pages.lawyerWorkplace.settings.mailboxes.sync.lastSyncedHours', {
    count: hours,
    defaultValue: `${hours} h ago`,
  })
}

export function SyncSettingsCard({
  syncSettings,
  onSyncIntervalChange,
  isSaving = false,
  readOnly = false,
}: SyncSettingsCardProps) {
  const { t } = useTranslation('common')
  const { isCompact, isWide } = useLawyerWorkplaceLayout()

  const handleIntervalChange = (interval: SyncInterval) => {
    void onSyncIntervalChange(interval)
  }

  return (
    <div className="bg-card/50 rounded-xl p-5 sm:p-6">
      <div
        className={cn(
          'mb-4 flex gap-3',
          isCompact ? 'flex-col' : 'flex-row items-start justify-between'
        )}
      >
        <div className="min-w-0">
          <h2 className="text-foreground text-[15px] font-medium">
            {t('pages.lawyerWorkplace.settings.mailboxes.sync.title', 'Email sync')}
          </h2>
          <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.sync.description',
              'How often the email service pulls new messages from connected mailboxes.'
            )}
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 text-[11px]">
          {t('pages.lawyerWorkplace.settings.mailboxes.sync.lastSynced', 'Last synced')}:{' '}
          <span className="text-foreground font-medium">
            {formatLastSynced(syncSettings.lastSyncedAt, t)}
          </span>
        </span>
      </div>

      <div
        className={cn(
          'grid gap-2',
          isWide
            ? 'grid-cols-5'
            : isCompact
              ? 'grid-cols-1'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
        )}
      >
        {SYNC_INTERVAL_OPTIONS.map((option) => {
          const isActive = syncSettings.interval === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={isSaving || readOnly}
              onClick={() => handleIntervalChange(option.id)}
              className={cn(
                'cursor-pointer rounded-md px-3 py-2.5 text-center text-[12px] transition-colors',
                isActive ? 'bg-secondary-800 text-white' : 'text-foreground hover:bg-muted bg-card'
              )}
            >
              {t(option.labelKey, option.fallback)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
