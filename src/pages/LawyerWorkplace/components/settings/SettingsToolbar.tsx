import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { SettingsSubTab } from '../../settings/types'
import { SETTINGS_SUB_TABS } from './constants'

interface SettingsToolbarProps {
  activeSubTab: SettingsSubTab
  onSubTabChange: (tab: SettingsSubTab) => void
}

export function SettingsToolbar({ activeSubTab, onSubTabChange }: SettingsToolbarProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()

  return (
    <div
      className={cn('min-w-0 shrink-0 px-4 sm:px-5 lg:px-7', isCompact ? 'pt-3' : 'pt-4 lg:pt-5')}
    >
      <div
        className={cn(
          'mb-4 flex gap-3',
          isCompact ? 'flex-col items-stretch' : 'flex-row items-start justify-between'
        )}
      >
        <div
          className={cn(
            'flex min-w-0 gap-0.5',
            isCompact ? 'flex-col' : 'flex-row items-center gap-3'
          )}
        >
          <h1
            className={cn(
              'text-dark-500 truncate font-light',
              isCompact ? 'text-lg' : 'text-xl lg:text-2xl'
            )}
          >
            {t('pages.lawyerWorkplace.settings.title', 'Settings')}
          </h1>
          <span
            className={cn(
              'font-light whitespace-nowrap text-gray-500',
              isCompact ? 'text-xs' : 'text-sm'
            )}
          >
            {t('pages.lawyerWorkplace.settings.departmentConfig', 'Legal department configuration')}
          </span>
        </div>

        <div
          className={cn(
            'flex shrink-0 flex-wrap gap-1 rounded-md bg-white p-1 shadow-sm',
            isCompact ? 'w-full' : 'ml-auto'
          )}
        >
          {SETTINGS_SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSubTabChange(tab.id)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[12px]',
                  isActive ? 'bg-secondary-800 text-white' : 'text-dark-500 hover:bg-light-100',
                  isCompact && 'flex-1 text-center'
                )}
              >
                {t(tab.labelKey, tab.fallback)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
