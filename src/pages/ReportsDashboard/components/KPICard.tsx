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
        'flex flex-1 flex-col items-center justify-between self-stretch rounded-xl border border-white bg-white/50 p-6',
        className
      )}
    >
      <div className="flex items-center justify-between self-stretch">
        {/* Title */}
        <span className="text-dark-500 text-[18px] leading-[150%] font-light tracking-[-0.36px]">
          {title}
        </span>
        {/* Icon in top right */}
        <div className="flex items-center gap-2.5 rounded-full bg-white p-2">{getIcon()}</div>
      </div>

      {/* Value and Change */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        {isPercentage && percentage !== undefined ? (
          <div className="relative flex h-30 w-30 items-center justify-center">
            <svg className="h-30 w-30 -rotate-90 transform" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#FFF"
                strokeWidth="10"
                className="shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)] transition-all duration-300"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#A0F229"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.06),inset_0_2px_5px_0_rgba(0,0,0,0.10)] transition-all duration-300"
              />
            </svg>
            <span className="text-dark-500 absolute text-[30px] leading-[129%] font-medium tracking-[-0.6px]">
              {value}
            </span>
          </div>
        ) : (
          <span className="text-dark-500 text-[30px] leading-[129%] font-medium tracking-[-0.6px]">
            {value}
          </span>
        )}

        {!hideTrend && (
          <div className="flex items-center justify-center gap-2">
            {isIncrease ? (
              <Icons.ArrowUp02 size={20} className="text-success-500" />
            ) : (
              <Icons.ArrowDown02 size={20} className="text-error-500" />
            )}
            <span className="text-dark-500 text-sm leading-[150%] tracking-[-0.28px]">
              <span className="font-medium">{change}% </span>
              <span className="font-light">{t('pages.reports.kpi.vs')} </span>
              <span className="font-medium">{getComparisonText()}</span>
            </span>
          </div>
        )}
        {/* View Details Link */}
        {onViewDetails && (
          <LinkButton
            variant="regular-secondary"
            size="sm"
            onClick={onViewDetails}
            rightIcon={<Icons.ArrowRight size={20} />}
          >
            {t('pages.reports.kpi.viewDetails')}
          </LinkButton>
        )}
      </div>
    </div>
  )
}
