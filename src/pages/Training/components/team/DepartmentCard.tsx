import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockDepartment } from '../../mocks/trainerWorkplaceMocks'
import { TeamCard } from './TeamCard'

/**
 * Collapsible department-level band on the Team tab. Header shows the
 * department name + manager + member count + avg-score badge; body lists
 * member teams as `TeamCard`s.
 */
export interface DepartmentCardProps {
  department: MockDepartment
}

const BAND_BG: Record<MockDepartment['scoreBand'], string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
}

export function DepartmentCard({ department }: DepartmentCardProps) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header band */}
      <div className="bg-primary-700 flex items-center justify-between px-5 py-3 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15"
            aria-label="toggle"
          >
            {expanded ? (
              <Icons.ArrowUp size={14} className="text-white" />
            ) : (
              <Icons.ArrowDown size={14} className="text-white" />
            )}
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{department.name}</span>
            <span className="text-[11px] text-white/70">
              {t('pages.training.team.dept.manager', 'Manager')}: {department.managerName}
              {' · '}
              {department.memberCount} {t('pages.training.team.dept.employees', 'employees')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-white/30 ${BAND_BG[department.scoreBand]}`}
          >
            {department.averageScore}
          </span>
          <span className="text-[11px] text-white/80">/100</span>
        </div>
      </div>

      {/* Teams list */}
      {expanded ? (
        <div className="flex flex-col gap-2 p-3">
          {department.teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default DepartmentCard
