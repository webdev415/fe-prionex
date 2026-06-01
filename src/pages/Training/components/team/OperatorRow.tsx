import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockOperator } from '../../mocks/trainerWorkplaceMocks'

/**
 * Single-operator row inside a TeamCard. Shows: avatar with online dot,
 * name, ext/title, last-active label, mini score ring, three quick-action
 * icons (call / chat / open detail panel).
 */
export interface OperatorRowProps {
  operator: MockOperator
  onSelect?: (operatorId: number) => void
}

const SCORE_RING: Record<MockOperator['scoreBand'], string> = {
  red: 'ring-red-300 text-red-600',
  amber: 'ring-amber-300 text-amber-600',
  green: 'ring-emerald-300 text-emerald-600',
}

const SCORE_TRACK: Record<MockOperator['scoreBand'], string> = {
  red: 'stroke-red-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

export function OperatorRow({ operator, onSelect }: OperatorRowProps) {
  const { t } = useTranslation('common')
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (operator.score / 100) * circumference

  return (
    <button
      type="button"
      onClick={() => onSelect?.(operator.id)}
      className="hover:border-primary-200 flex items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-2 text-left transition-colors"
    >
      {/* Avatar with online dot */}
      <div className="relative flex-shrink-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-gray-700"
          style={{ backgroundColor: operator.avatarColor }}
        >
          {operator.initials}
        </div>
        <span
          className={`absolute -right-0.5 -bottom-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white ${
            operator.online ? 'bg-emerald-500' : 'bg-gray-300'
          }`}
        />
      </div>

      {/* Name + meta */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-dark-500 truncate text-sm font-medium">{operator.name}</span>
          <span className="text-[10px] text-gray-400">ext. {operator.extension}</span>
        </div>
        <span className="text-[11px] text-gray-500">{operator.lastActiveLabel}</span>
      </div>

      {/* Quick actions */}
      <div className="hidden items-center gap-1 sm:flex">
        <span className="bg-primary-50 text-primary-700 flex h-7 w-7 items-center justify-center rounded-full">
          <Icons.Phone size={14} />
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          <Icons.Chat size={14} />
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
          <Icons.UserCircle02Icon size={14} />
        </span>
      </div>

      {/* Score ring */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <div className="relative h-10 w-10">
          <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
            <circle
              cx="20"
              cy="20"
              r={radius}
              strokeWidth="3"
              fill="none"
              className="stroke-gray-100"
            />
            <circle
              cx="20"
              cy="20"
              r={radius}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={SCORE_TRACK[operator.scoreBand]}
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${SCORE_RING[operator.scoreBand]}`}
          >
            {operator.score}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {t('pages.training.team.team.outOf100', '/100')}
        </span>
      </div>
    </button>
  )
}

export default OperatorRow
