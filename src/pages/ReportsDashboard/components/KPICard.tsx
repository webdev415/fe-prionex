/**
 * KPICard Component
 *
 * Reusable KPI card component displaying metrics with change indicators.
 */

import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { LinkButton } from '@/components/ui/LinkButton'
import { cn } from '@/lib/utils'
import type { Period } from '@/features/report'

export interface KPICardProps {
  title: string
  value: string
  change: number
  changeType: 'increase' | 'decrease'
  icon: 'phone' | 'chart' | 'mail' | 'message' | 'payments'
  isPercentage?: boolean
  percentage?: number
  onViewDetails?: () => void
  className?: string
  period?: Period
  /** When true, hides period-over-period trend (e.g. messaging has no dashboard KPI yet). */
  hideTrend?: boolean
}

export function KPICard({
  title,
  value,
  change,
  changeType,
  icon,
  isPercentage = false,
  percentage,
  onViewDetails,
  className,
  period = 'today',
  hideTrend = false,
}: KPICardProps) {
  const { t } = useTranslation('common')
  const isIncrease = changeType === 'increase'

  // Get comparison text based on period
  const getComparisonText = () => {
    switch (period) {
      case 'today':
        return t('pages.reports.kpi.yesterday')
      case 'thisWeek':
        return t('pages.reports.kpi.lastWeek')
      case 'thisMonth':
        return t('pages.reports.kpi.lastMonth')
      default:
        return t('pages.reports.kpi.yesterday')
    }
  }

  const getIcon = () => {
    switch (icon) {
      case 'phone':
        return <Icons.Call02 size={24} className="text-primary-500" strokeWidth={1.5} />
      case 'chart':
        return <Icons.Chart01 size={24} className="text-primary-500" strokeWidth={1.5} />
      case 'mail':
        return <Icons.MailSend01 size={24} className="text-primary-500" strokeWidth={1.5} />
      case 'message':
        return <Icons.MessageMultiple01 size={24} className="text-primary-500" strokeWidth={1.5} />
      case 'payments':
        return <Icons.MoneyReceive01 size={24} className="text-primary-500" strokeWidth={1.5} />
      default:
        return null
    }
  }

  // Calculate circular progress for percentage display
  const circumference = 2 * Math.PI * 45 // radius = 45
  const offset = circumference - (percentage ? (percentage / 100) * circumference : 0)

  return (
    <div
      className={cn(
        'border-border bg-card/50 flex w-full flex-col items-center justify-between gap-4 rounded-xl border p-4 sm:gap-6 sm:p-6',
        className
      )}
    >
      <div className="flex items-center justify-between self-stretch">
        {/* Title */}
        <span className="text-foreground text-base leading-[150%] font-light tracking-[-0.36px] sm:text-[18px]">
          {title}
        </span>
        {/* Icon in top right */}
        <div className="bg-card flex items-center gap-2.5 rounded-full p-2">{getIcon()}</div>
      </div>

      {/* Value and Change */}
      <div className="flex flex-col items-center justify-center gap-3">
        {isPercentage && percentage !== undefined ? (
          <div className="relative flex h-24 w-24 items-center justify-center sm:h-30 sm:w-30">
            <svg className="h-24 w-24 -rotate-90 transform sm:h-30 sm:w-30" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-border shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)] transition-all duration-300"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-primary-400 shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)] transition-all duration-300"
              />
            </svg>
            <span className="text-foreground absolute text-2xl leading-[129%] font-medium tracking-[-0.6px] sm:text-[30px]">
              {value}
            </span>
          </div>
        ) : (
          <span className="text-foreground text-2xl leading-[129%] font-medium tracking-[-0.6px] sm:text-[30px]">
            {value}
          </span>
        )}

        {!hideTrend && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            {isIncrease ? (
              <Icons.ArrowUp02 size={20} className="text-success-500" />
            ) : (
              <Icons.ArrowDown02 size={20} className="text-error-500" />
            )}
            <span className="text-foreground text-sm leading-[150%] tracking-[-0.28px]">
              <span className="font-medium">{change}% </span>
              <span className="font-light">{t('pages.reports.kpi.vs')} </span>
              <span className="font-medium">{getComparisonText()}</span>
            </span>
          </div>
        )}
        {/* View Details Link */}
        {onViewDetails && (
          <LinkButton
            variant="regular-black"
            size="sm"
            onClick={onViewDetails}
            rightIcon={<Icons.ArrowRight size={20} className="text-foreground" />}
          >
            {t('pages.reports.kpi.viewDetails')}
          </LinkButton>
        )}
      </div>
    </div>
  )
}
