import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_SCORECARD_ROWS } from '../../mocks/trainerWorkplaceMocks'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'
import { ScorecardListView } from './ScorecardListView'
import { ScorecardDetailPanel } from './ScorecardDetailPanel'

type CategoryChip = 'all' | 'new' | 'average' | 'risk'

export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(
    MOCK_SCORECARD_ROWS[0]?.id ?? null
  )
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])

  const categoryCounts = useMemo(
    () => ({
      all: MOCK_SCORECARD_ROWS.length,
      new: MOCK_SCORECARD_ROWS.filter((r) => r.category === 'New').length,
      average: MOCK_SCORECARD_ROWS.filter((r) => r.category === 'Average').length,
      risk: MOCK_SCORECARD_ROWS.filter((r) => r.category === 'Risk').length,
    }),
    []
  )

  const categoryChips = useMemo(
    () =>
      (
        [
          { id: 'all' as const, label: t('pages.training.dialogue.chips.all', 'All scores') },
          { id: 'new' as const, label: t('pages.training.dialogue.chips.new', 'New') },
          { id: 'average' as const, label: t('pages.training.dialogue.chips.average', 'Average') },
          { id: 'risk' as const, label: t('pages.training.dialogue.chips.risk', 'Risk') },
        ] as const
      ).map((c) => ({
        id: c.id,
        label: c.label,
        count: categoryCounts[c.id],
      })),
    [t, categoryCounts]
  )

  const filteredRows = MOCK_SCORECARD_ROWS.filter((r) => {
    if (activeCategory === 'all') return true
    if (activeCategory === 'new') return r.category === 'New'
    if (activeCategory === 'average') return r.category === 'Average'
    if (activeCategory === 'risk') return r.category === 'Risk'
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrainingSegmentedStrip
          items={categoryChips}
          activeId={activeCategory}
          onChange={(id) => setActiveCategory(id as CategoryChip)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#BBFB5B] px-4 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#a8e848]"
          >
            <Icons.Add size={14} />
            {t('pages.training.dialogue.scheduleSession', 'Schedule a session')}
          </button>
          <EmployeeMultiSelect value={selectedEmployeeIds} onChange={setSelectedEmployeeIds} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_400px]">
        <ScorecardListView
          rows={filteredRows}
          selectedId={selectedRowId}
          onSelect={setSelectedRowId}
        />
        <ScorecardDetailPanel selectedId={selectedRowId} />
      </div>

      <PendingFeatureDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        titleKey="pages.training.dialogue.scheduleSession"
        titleFallback="Schedule a session"
        descriptionKey="pages.training.dialogue.pending.scheduleSession"
        descriptionFallback="Plan a dialogue evaluation or coaching session with an operator."
        dependsOnIssue="KAN-504"
      />
    </div>
  )
}

export default DialogueEvaluationTab
