import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockTeam } from '../../mocks/trainerWorkplaceMocks'
import { TEAM_SCORE_TEXT } from './teamStyles'
import { OperatorRow } from './OperatorRow'

export interface TeamCardProps {
  team: MockTeam
}

export function TeamCard({ team }: TeamCardProps) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border-b border-[#EBECE8] last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[#FAFAFA]"
      >
        <Icons.ArrowUp
          size={14}
          className={`flex-shrink-0 text-[#676767] transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 font-semibold text-[#05040D]">{team.name}</p>
          <p className="text-[11px] leading-4 text-[#4B5563]">
            {t('pages.training.team.team.teamLead', 'Team Lead')}: {team.teamLeadName}
            {' · '}
            {team.memberCount} {t('pages.training.team.dept.employees', 'employees')}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium tracking-[0.05em] text-[#6B7280] uppercase">
              {t('pages.training.team.dept.average', 'Average')}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: TEAM_SCORE_TEXT[team.scoreBand] }}
            >
              {team.averageScore}
            </span>
          </div>
          {team.queueCount > 0 ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-medium tracking-[0.05em] text-[#6B7280] uppercase">
                {t('pages.training.team.dept.inQueue', 'In queue')}
              </span>
              <span className="text-sm font-semibold text-[#B91C1C]">{team.queueCount}</span>
            </div>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <div className="grid grid-cols-1 gap-3 px-5 pb-4 md:grid-cols-2 xl:grid-cols-3">
          {team.operators.map((op) => (
            <OperatorRow key={op.id} operator={op} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default TeamCard
