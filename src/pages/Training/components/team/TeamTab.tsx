import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MOCK_DEPARTMENTS } from '../../mocks/trainerWorkplaceMocks'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { DepartmentCard } from './DepartmentCard'

type DeptFilter = 'all' | string

/**
 * Team top-tab — Figma `ENG - Training _ Team.svg`
 */
export function TeamTab() {
  const { t } = useTranslation('common')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<DeptFilter>('all')

  const chips = useMemo(
    () => [
      {
        id: 'all' as const,
        label: t('pages.training.team.chips.all', 'All my departments'),
        count: MOCK_DEPARTMENTS.length,
      },
      ...MOCK_DEPARTMENTS.map((d) => ({
        id: d.id,
        label: d.name.split('·')[0]?.trim() ?? d.name,
        count: d.teamCount,
      })),
    ],
    [t]
  )

  const departments = useMemo(() => {
    if (selectedDepartmentId === 'all') return MOCK_DEPARTMENTS
    return MOCK_DEPARTMENTS.filter((d) => d.id === selectedDepartmentId)
  }, [selectedDepartmentId])

  return (
    <div className="flex flex-col gap-4">
      <TrainingSegmentedStrip
        items={chips.map((chip) => ({
          id: chip.id,
          label: chip.label,
          count: chip.count,
        }))}
        activeId={selectedDepartmentId}
        onChange={(id) => setSelectedDepartmentId(id as DeptFilter)}
        showActiveClose
      />

      <div className="flex flex-col gap-4">
        {departments.map((dept) => (
          <DepartmentCard key={dept.id} department={dept} />
        ))}
      </div>
    </div>
  )
}

export default TeamTab
