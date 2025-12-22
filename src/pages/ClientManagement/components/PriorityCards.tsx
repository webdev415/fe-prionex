/**
 * Priority Cards Component
 *
 * Displays four priority overview cards with total debt and client count.
 */

import { useTranslation } from 'react-i18next'

interface PriorityStats {
  Critical: { totalDebt: number; count: number }
  High: { totalDebt: number; count: number }
  Medium: { totalDebt: number; count: number }
  Low: { totalDebt: number; count: number }
}

interface PriorityCardsProps {
  priorityStats: PriorityStats
}

export function PriorityCards({ priorityStats }: PriorityCardsProps) {
  const { t } = useTranslation('common')

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')

    // Format as "540K" if >= 1000
    if (amount >= 1000) {
      const kValue = Math.round(amount / 1000)
      return `${kValue}K`
    }
    return formatted
  }

  const priorityCards = [
    {
      label: t('pages.clients.priorityCards.criticalPriority'),
      badge: t('pages.clients.priorities.critical'),
      totalDebt: priorityStats.Critical.totalDebt,
      clientCount: priorityStats.Critical.count,
      color: 'error' as const,
    },
    {
      label: t('pages.clients.priorityCards.highPriority'),
      badge: t('pages.clients.priorities.high'),
      totalDebt: priorityStats.High.totalDebt,
      clientCount: priorityStats.High.count,
      color: 'warning' as const,
    },
    {
      label: t('pages.clients.priorityCards.mediumPriority'),
      badge: t('pages.clients.priorities.medium'),
      totalDebt: priorityStats.Medium.totalDebt,
      clientCount: priorityStats.Medium.count,
      color: 'success' as const,
    },
    {
      label: t('pages.clients.priorityCards.lowPriority'),
      badge: t('pages.clients.priorities.low'),
      totalDebt: priorityStats.Low.totalDebt,
      clientCount: priorityStats.Low.count,
      color: 'gray' as const,
    },
  ]

  const getColorClasses = (color: 'error' | 'warning' | 'success' | 'gray') => {
    switch (color) {
      case 'error':
        return {
          label: 'bg-error-500 text-white',
          card: 'border-error-500',
        }
      case 'warning':
        return {
          label: 'bg-warning-500 text-white',
          card: 'border-warning-500',
        }
      case 'success':
        return {
          label: 'bg-success-500 text-white',
          card: 'border-success-500',
        }
      case 'gray':
        return {
          label: 'bg-gray-500 text-white',
          card: 'border-gray-500',
        }
    }
  }

  return (
    <div className="flex w-full items-start gap-5">
      {priorityCards.map((card) => {
        const colors = getColorClasses(card.color)
        return (
          <div
            key={card.label}
            className={`flex flex-1 flex-col items-start gap-4 rounded-xl border border-white bg-white/50 p-6 ${colors.card}`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-[25px] items-center rounded-[16px] px-3 py-2 text-center text-xs leading-[140%] font-medium tracking-[-0.24px] text-white ${colors.label}`}
              >
                {card.badge}
              </span>
              <h3 className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {card.label}
              </h3>
            </div>

            <div className="flex items-start justify-between self-stretch">
              <div className="flex flex-row items-start gap-1">
                <p className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-800">
                  {t('pages.clients.priorityCards.totalDebt')}
                </p>
                <p className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {formatCurrency(card.totalDebt)} UAH
                </p>
              </div>
              <div className="flex flex-row items-start gap-1">
                <p className="text-sm leading-[150%] font-light tracking-[-0.28px] text-gray-800">
                  {t('pages.clients.priorityCards.client')}
                </p>
                <p className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {card.clientCount}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
