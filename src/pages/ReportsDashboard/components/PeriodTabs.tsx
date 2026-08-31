/**
 * PeriodTabs Component
 *
 * Tab selector for choosing time period (Today, This Week, This Month).
 *
 * NOTE: visually identical to the shared SegmentedTabs
 * (src/components/ui/SegmentedTabs.tsx); can migrate onto it in a separate
 * PR — kept as-is here to hold the scope of the processing-report change.
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
    <div className="flex w-full gap-2 sm:w-auto">
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onPeriodChange(period.key)}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:w-[120px] sm:flex-none sm:px-4 sm:text-sm',
            selectedPeriod === period.key
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-card text-muted-foreground hover:bg-muted'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}
