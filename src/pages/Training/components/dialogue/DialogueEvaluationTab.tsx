import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { DIALOGUE_EVALUATION_VIEW_MODES, type DialogueEvaluationViewMode } from '../../types'
import { MOCK_SCORECARD_ROWS } from '../../mocks/trainerWorkplaceMocks'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { TrainingFilterChips } from '../training/TrainingToolbar'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { ScorecardListView } from './ScorecardListView'
import { ScorecardDetailPanel } from './ScorecardDetailPanel'
import { AvgScoreByTypeView } from './AvgScoreByTypeView'

const VIEW_MODE_LABELS: Record<DialogueEvaluationViewMode, { key: string; fallback: string }> = {
  scorecard: { key: 'pages.training.dialogue.viewModes.scorecard', fallback: 'Scorecard' },
  calendar: { key: 'pages.training.dialogue.viewModes.calendar', fallback: 'Calendar' },
  drafts: { key: 'pages.training.dialogue.viewModes.drafts', fallback: 'Drafts' },
  'average-score': {
    key: 'pages.training.dialogue.viewModes.averageScore',
    fallback: 'Average score',
  },
  'coach-notes': {
    key: 'pages.training.dialogue.viewModes.coachNotes',
    fallback: "Coach's notes",
  },
  closed: { key: 'pages.training.dialogue.viewModes.closed', fallback: 'Closed' },
}

type CategoryChip = 'all' | 'new' | 'average' | 'risk'

export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [activeView, setActiveView] = useState<DialogueEvaluationViewMode>('scorecard')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(
    MOCK_SCORECARD_ROWS[0]?.id ?? null
  )
  const [scheduleOpen, setScheduleOpen] = useState(false)

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

  const viewModes = useMemo(
    () =>
      DIALOGUE_EVALUATION_VIEW_MODES.map((v) => {
        const meta = VIEW_MODE_LABELS[v]
        return { id: v, label: t(meta.key, meta.fallback) }
      }),
    [t]
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
        <button
          type="button"
          onClick={() => setScheduleOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#BBFB5B] px-4 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#a8e848]"
        >
          <Icons.Add size={14} />
          {t('pages.training.dialogue.scheduleSession', 'Schedule a session')}
        </button>
      </div>

      <TrainingFilterChips
        items={viewModes}
        activeId={activeView}
        onChange={(id) => setActiveView(id as DialogueEvaluationViewMode)}
      />

      {activeView === 'average-score' ? (
        <AvgScoreByTypeView />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_400px]">
          <ScorecardListView
            rows={filteredRows}
            selectedId={selectedRowId}
            onSelect={setSelectedRowId}
          />
          <ScorecardDetailPanel selectedId={selectedRowId} />
        </div>
      )}

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
