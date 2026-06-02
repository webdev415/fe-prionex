import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MOCK_DEPARTMENTS } from '../../mocks/trainerWorkplaceMocks'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { DepartmentCard } from './DepartmentCard'

/** Figma — `In norm / Behind / In queue` dot legend shown to the right of the
 *  department filter chips. Explains the operator-row status indicators. */
const STATUS_LEGEND = [
  {
    id: 'in_norm',
    dot: 'bg-[#22C55E]',
    key: 'pages.training.team.workStatus.inNorm',
    fallback: 'In norm',
  },
  {
    id: 'behind',
    dot: 'bg-[#CA8A04]',
    key: 'pages.training.team.workStatus.behind',
    fallback: 'Behind',
  },
  {
    id: 'in_queue',
    dot: 'bg-[#EF4444]',
    key: 'pages.training.team.workStatus.inQueue',
    fallback: 'In queue',
  },
] as const

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="flex items-center gap-4">
          {STATUS_LEGEND.map((item) => (
            <span
              key={item.id}
              className="flex items-center gap-1.5 text-xs font-medium text-[#05040D]"
            >
              <span className={`inline-block h-2 w-2 rounded-full ${item.dot}`} />
              {t(item.key, item.fallback)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {departments.map((dept) => (
          <DepartmentCard key={dept.id} department={dept} />
        ))}
      </div>
    </div>
  )
}

export default TeamTab
