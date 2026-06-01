import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockTeam } from '../../mocks/trainerWorkplaceMocks'
import { OperatorRow } from './OperatorRow'

/**
 * Per-team band on the Team tab. Header summarises team manager, member
 * count, online count and avg-score band; body lists operators.
 */
export interface TeamCardProps {
  team: MockTeam
}

const BAND_BG: Record<MockTeam['scoreBand'], string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
}

export function TeamCard({ team }: TeamCardProps) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)

  const onlineCount = team.operators.filter((o) => o.online).length

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="bg-primary-100 text-primary-700 flex h-6 w-6 items-center justify-center rounded-full"
            aria-label="toggle"
          >
            {expanded ? <Icons.ArrowUp size={12} /> : <Icons.ArrowDown size={12} />}
          </button>
          <span className="text-dark-500 text-sm font-medium">{team.name}</span>
          <span className="text-[11px] text-gray-500">
            {team.managerName} Â· {team.memberCount}{' '}
            {t('pages.training.team.dept.employees', 'employees')}
          </span>
          <span className="text-primary-600 text-[11px] font-medium">
            {onlineCount} {t('pages.training.team.team.online', 'online')}
          </span>
        </div>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ${BAND_BG[team.scoreBand]}`}
        >
          {team.averageScore}
        </span>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {team.operators.map((op) => (
            <OperatorRow key={op.id} operator={op} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default TeamCard
