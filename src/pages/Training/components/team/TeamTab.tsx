import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_DEPARTMENTS } from '../../mocks/trainerWorkplaceMocks'
import { DepartmentCard } from './DepartmentCard'

/**
 * Team top-tab (KAN-414). Department â†’ Team â†’ Operator hierarchy with
 * department filter chips, online/offline state per operator, mini composite
 * scores. Clicking an operator opens the shared Operator Detail Panel
 * (placeholder until KAN-413 promotion lands).
 *
 * Mock data variant: real `useTeamRoster` hook ships with KAN-414.
 */
export function TeamTab() {
  const { t } = useTranslation('common')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | 'all'>('all')

  const departments = useMemo(() => {
    if (selectedDepartmentId === 'all') return MOCK_DEPARTMENTS
    return MOCK_DEPARTMENTS.filter((d) => d.id === selectedDepartmentId)
  }, [selectedDepartmentId])

  const chips = [
    { id: 'all' as const, label: t('pages.training.team.chips.all', 'All my departments') },
    ...MOCK_DEPARTMENTS.map((d) => ({
      id: d.id,
      label: `${t('pages.training.team.chips.dept', 'Dept')} ${d.name.split('Â·')[0].replace('Department ', '').trim()}: ${d.name.split('Â·')[1]?.trim() ?? ''}`,
    })),
    {
      id: 'restructuring' as const,
      label: t('pages.training.team.chips.restructuring', '2. Restructuring'),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Department filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const isActive = chip.id === selectedDepartmentId
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSelectedDepartmentId(chip.id as string)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {chip.label}
              {isActive ? <Icons.Close size={12} className="text-white" /> : null}
            </button>
          )
        })}
      </div>

      {/* Department panels */}
      <div className="flex flex-col gap-4">
        {departments.map((dept) => (
          <DepartmentCard key={dept.id} department={dept} />
        ))}
      </div>
    </div>
  )
}

export default TeamTab
