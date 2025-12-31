/**
 * Priority Badge Component
 *
 * Displays priority badge with dots visualization and text label.
 * - Critical: 3 red dots
 * - High: 2 orange dots
 * - Medium: 1 green dot
 * - Low: 1 grey dot
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { Priority } from '../types'

interface PriorityBadgeProps {
  priority: Priority
  className?: string
  variant?: 'default' | 'compact'
}

export function PriorityBadge({ priority, className, variant = 'default' }: PriorityBadgeProps) {
  const { t } = useTranslation('common')

  const priorityConfig = {
    Critical: {
      dots: 3,
      dotColor: '#DC2626',
      bgColor: 'bg-[#FCEAEA]',
      borderColor: 'border-error-600',
    },
    High: {
      dots: 2,
      dotColor: '#FF9D00',
      bgColor: 'bg-[#FFF6E6]',
      borderColor: 'border-[#FF9D00]',
    },
    Medium: {
      dots: 1,
      dotColor: '#80D80A',
      bgColor: 'bg-[#F0F7E6]',
      borderColor: 'border-primary-600',
    },
    Low: {
      dots: 0,
      dotColor: '#DFDFDF',
      bgColor: 'bg-[#F8F8F8]',
      borderColor: 'border-gray-200',
    },
  }

  const config = priorityConfig[priority]

  const renderDots = () => {
    return Array.from({ length: config.dots }, (_, index) => (
      //   <span
      //     key={index}
      //     className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)}
      //   />
      //   <Icons.Fire02 key={index} size={12} className={cn('', config.dotColor)} strokeWidth={1.5} />
      <svg key={index} xmlns="http://www.w3.org/2000/svg" width="9" height="11" viewBox="0 0 8 10">
        <path
          d="M2.2994 0.0998407C2.21512 0.0367024 2.11306 0.00178465 2.00777 6.6584e-05C1.90248 -0.00165148 1.79933 0.0299178 1.71304 0.0902729C1.62675 0.150628 1.56171 0.236687 1.52721 0.33618C1.49271 0.435673 1.4905 0.543519 1.5209 0.644341C1.6083 0.935937 1.61812 1.24529 1.5494 1.54184C1.48091 1.83664 1.33606 2.10823 1.1294 2.32934C1.11563 2.34421 1.10277 2.35991 1.0909 2.37634C0.7929 2.78484 -0.8891 5.17634 0.6204 7.75734L0.635401 7.78184C1.00208 8.3333 1.5043 8.78129 2.0939 9.08284C2.67639 9.3811 3.32603 9.52388 3.9799 9.49734C4.67517 9.50951 5.36175 9.34156 5.9729 9.00984C6.59467 8.67171 7.11833 8.17837 7.4929 7.57784C8.1434 6.47784 8.0849 5.29984 7.7869 4.35734C7.4954 3.43334 6.9469 2.65034 6.4834 2.30634C6.41058 2.25242 6.32447 2.2193 6.23428 2.21052C6.14409 2.20175 6.05321 2.21764 5.97136 2.25652C5.88951 2.29539 5.81976 2.35577 5.76957 2.43122C5.71937 2.50666 5.69063 2.59433 5.6864 2.68484C5.6529 3.40034 5.5049 3.96034 5.2894 4.40034C5.1784 3.19684 4.7259 2.30234 4.1774 1.63834C3.6039 0.943341 2.8954 0.488341 2.5159 0.244341C2.44254 0.198592 2.37051 0.150739 2.2999 0.100841L2.2994 0.0998407Z"
          fill={config.dotColor}
        />
      </svg>
    ))
  }

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-flex h-[25px] w-[90px] items-center justify-center gap-1.5 rounded-[16px] border px-3 py-1 text-xs font-medium',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        {priority !== 'Low' && (
          <span className="flex items-center justify-center gap-0.5">{renderDots()}</span>
        )}
        <span>{t(`pages.clients.priorities.${priority.toLowerCase()}`)}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex h-[25px] w-[90px] items-center justify-center gap-1.5 rounded-[16px] border px-3 py-2 text-center text-xs font-medium tracking-[-0.24px]',
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {priority !== 'Low' && <span className="flex items-center gap-0.5">{renderDots()}</span>}
      <span className="text-dark-500 leading-[200%] tracking-[-0.24px]">
        {t(`pages.clients.priorities.${priority.toLowerCase()}`)}
      </span>
    </span>
  )
}
