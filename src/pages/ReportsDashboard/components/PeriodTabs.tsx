/**
 * PeriodTabs Component
 *
 * Tab selector for choosing time period (Today, This Week, This Month).
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { Period } from '../types'

export interface PeriodTabsProps {
  selectedPeriod: Period
  onPeriodChange: (period: Period) => void
}

export function PeriodTabs({ selectedPeriod, onPeriodChange }: PeriodTabsProps) {
  const { t } = useTranslation('common')

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: t('pages.reports.periods.today') },
    { key: 'thisWeek', label: t('pages.reports.periods.thisWeek') },
    { key: 'thisMonth', label: t('pages.reports.periods.thisMonth') },
  ]

  return (
    <div className="flex gap-2">
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onPeriodChange(period.key)}
          className={cn(
            'flex w-[120px] cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            selectedPeriod === period.key
              ? 'bg-secondary-800 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
