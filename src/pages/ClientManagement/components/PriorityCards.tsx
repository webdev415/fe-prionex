/**
 * Priority Cards Component
 *
 * Displays four priority overview cards with total debt and client count.
 * Now supports multi-select filtering - click cards to filter by priority.
 */

import { useTranslation } from 'react-i18next'
import { PriorityBadge } from './PriorityBadge'
import type { Priority } from '../types'

interface PriorityStats {
  Critical: { totalDebt: string | number; count: number }
  High: { totalDebt: string | number; count: number }
  Medium: { totalDebt: string | number; count: number }
  Low: { totalDebt: string | number; count: number }
}

interface PriorityCardsProps {
  priorityStats: PriorityStats
  /** Selected priority filters (multi-select) */
  selected?: Priority[]
  /** Callback when priority card is toggled */
  onToggle?: (priority: Priority) => void
}

export function PriorityCards({ priorityStats, selected = [], onToggle }: PriorityCardsProps) {
  const { t } = useTranslation('common')

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0'
    const formatted = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')

    // Format as "540K" if >= 1000
    if (num >= 1000) {
      const kValue = Math.round(num / 1000)
      return `${kValue}K`
    }
    return formatted
  }

  const priorityCards: Array<{
    label: string
    priority: Priority
    totalDebt: string | number
    clientCount: number
    color: 'error' | 'warning' | 'success' | 'gray'
  }> = [
    {
      label: t('pages.clients.priorityCards.criticalPriority'),
      priority: 'Critical',
      totalDebt: priorityStats.Critical.totalDebt,
      clientCount: priorityStats.Critical.count,
      color: 'error' as const,
    },
    {
      label: t('pages.clients.priorityCards.highPriority'),
      priority: 'High',
      totalDebt: priorityStats.High.totalDebt,
      clientCount: priorityStats.High.count,
      color: 'warning' as const,
    },
    {
      label: t('pages.clients.priorityCards.mediumPriority'),
      priority: 'Medium',
      totalDebt: priorityStats.Medium.totalDebt,
      clientCount: priorityStats.Medium.count,
      color: 'success' as const,
    },
    {
      label: t('pages.clients.priorityCards.lowPriority'),
      priority: 'Low',
      totalDebt: priorityStats.Low.totalDebt,
      clientCount: priorityStats.Low.count,
      color: 'gray' as const,
    },
  ]

  const getColorClasses = (
    color: 'error' | 'warning' | 'success' | 'gray',
    isSelected: boolean
  ) => {
    // Keep original color-specific border, add matching color shadow when selected
    switch (color) {
      case 'error':
        return {
          card: `border-error-500 hover:bg-gray-50 ${isSelected ? 'shadow-[0_0_0_4px_rgba(239,68,68,0.25)] ring-2 ring-error-400/40' : ''}`,
          text: 'text-dark-500',
        }
      case 'warning':
        return {
          card: `border-warning-500 hover:bg-gray-50 ${isSelected ? 'shadow-[0_0_0_4px_rgba(245,158,11,0.25)] ring-2 ring-warning-400/40' : ''}`,
          text: 'text-dark-500',
        }
      case 'success':
        return {
          card: `border-success-500 hover:bg-gray-50 ${isSelected ? 'shadow-[0_0_0_4px_rgba(34,197,94,0.25)] ring-2 ring-success-400/40' : ''}`,
          text: 'text-dark-500',
        }
      case 'gray':
        return {
          card: `border-gray-500 hover:bg-gray-50 ${isSelected ? 'shadow-[0_0_0_4px_rgba(107,114,128,0.25)] ring-2 ring-gray-400/40' : ''}`,
          text: 'text-dark-500',
        }
    }
  }

  const handleCardClick = (priority: Priority) => {
    if (onToggle) {
      onToggle(priority)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent, priority: Priority) => {
    // Handle Enter and Space keys for accessibility
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick(priority)
    }
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
      {priorityCards.map((card) => {
        const isSelected = selected.includes(card.priority)
        const colors = getColorClasses(card.color, isSelected)
        const isClickable = !!onToggle

        return (
          <div
            key={card.label}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-pressed={isClickable ? isSelected : undefined}
            aria-label={`${card.label}: ${card.clientCount} clients, ${formatCurrency(card.totalDebt)} UAH total debt${isSelected ? ' (selected)' : ''}`}
            onClick={() => isClickable && handleCardClick(card.priority)}
            onKeyDown={(e) => isClickable && handleKeyDown(e, card.priority)}
            className={`flex flex-1 flex-col items-start gap-3 rounded-xl border-2 bg-white/50 p-4 transition-all duration-200 sm:gap-4 sm:p-5 xl:p-6 ${colors.card} ${isClickable ? 'cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none' : ''} `}
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <PriorityBadge priority={card.priority} />
              <h3
                className={`text-sm leading-[155%] font-medium tracking-[-0.28px] sm:text-base sm:tracking-[-0.32px] ${colors.text}`}
              >
                {card.label}
              </h3>
            </div>

            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:justify-between sm:gap-0">
              <div className="flex flex-row items-start gap-1">
                <p className="text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-800 sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.clients.priorityCards.totalDebt')}
                </p>
                <p
                  className={`text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px] ${colors.text}`}
                >
                  {formatCurrency(card.totalDebt)} UAH
                </p>
              </div>
              <div className="flex flex-row items-start gap-1">
                <p className="text-xs leading-[150%] font-light tracking-[-0.24px] text-gray-800 sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.clients.priorityCards.client')}
                </p>
                <p
                  className={`text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px] ${colors.text}`}
                >
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
