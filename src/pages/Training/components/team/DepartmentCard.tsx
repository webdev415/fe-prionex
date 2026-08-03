import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { TeamDepartmentRow } from '../../mocks/trainerWorkplaceMocks'
import { TEAM_SCORE_TEXT } from './teamStyles'
import { TeamCard } from './TeamCard'

export interface DepartmentCardProps {
  department: TeamDepartmentRow
  onSelectOperator?: (operatorId: number) => void
}

function StatColumn({
  label,
  value,
  suffix,
  valueClassName,
}: {
  label: string
  value: string | number
  suffix?: string
  valueClassName?: string
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-medium tracking-[0.05em] text-[#6B7280] uppercase">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className={`text-base font-semibold ${valueClassName ?? 'text-[#05040D]'}`}>
          {value}
        </span>
        {suffix ? <span className="text-xs text-[#6B7280]">{suffix}</span> : null}
      </div>
    </div>
  )
}

/** Figma department band — white card, #204E4D manager tile, avg + in-queue stats */
export function DepartmentCard({ department, onSelectOperator }: DepartmentCardProps) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#EBECE8] px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#204E4D] text-xs font-semibold text-[#BBFB5B]"
          aria-label={
            expanded
              ? t('pages.training.team.collapseDepartment', 'Collapse department')
              : t('pages.training.team.expandDepartment', 'Expand department')
          }
        >
          {/* Fall back to a generic department glyph when no manager is set so
              the tile doesn't render as a dash. */}
          {department.managerInitials && department.managerInitials !== '—' ? (
            department.managerInitials
          ) : (
            <Icons.UserMultiple02 size={16} className="text-[#BBFB5B]" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-6 font-semibold text-[#05040D]">{department.name}</h2>
          <p className="text-xs leading-4 text-[#4B5563]">
            {department.managerName && department.managerName !== '—' ? (
              <>
                {t('pages.training.team.dept.manager', 'Manager')}: {department.managerName}
                {' · '}
              </>
            ) : null}
            {department.memberCount} {t('pages.training.team.dept.employees', 'employees')}
            {' · '}
            {department.teamCount} {t('pages.training.team.dept.teams', 'teams')}
          </p>
        </div>

        <div className="flex items-start gap-3">
          <StatColumn
            label={t('pages.training.team.dept.average', 'Average')}
            value={department.averageScore}
            suffix="/100"
            valueClassName={TEAM_SCORE_TEXT[department.scoreBand]}
          />
          <StatColumn
            label={t('pages.training.team.dept.inQueue', 'In queue')}
            value={department.queueCount}
            valueClassName="text-[#B91C1C]"
          />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#676767] hover:bg-[#F7F7F7]"
          aria-hidden
        >
          {expanded ? <Icons.ArrowUp size={14} /> : <Icons.ArrowDown size={14} />}
        </button>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-0 bg-white">
          {department.teams.map((team) => (
            <TeamCard key={team.id} team={team} onSelectOperator={onSelectOperator} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default DepartmentCard
