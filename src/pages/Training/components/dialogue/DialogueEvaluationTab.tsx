import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DIALOGUE_EVALUATION_VIEW_MODES, type DialogueEvaluationViewMode } from '../../types'
import { MOCK_SCORECARD_ROWS } from '../../mocks/trainerWorkplaceMocks'
import { ScorecardListView } from './ScorecardListView'
import { AvgScoreByTypeView } from './AvgScoreByTypeView'

/**
 * Dialogue Evaluation top-tab (KAN-504). Top filter chips (All / New /
 * Average / Risk) + view-mode strip (Scorecard / Calendar / Drafts /
 * Average score / Coach's notes / Closed). The right-side detail panel
 * mounts when a scorecard row is focused.
 */
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

const CATEGORY_CHIPS: { id: CategoryChip; label: string; count?: number }[] = [
  { id: 'all', label: 'All scores', count: 25 },
  { id: 'new', label: 'New', count: 7 },
  { id: 'average', label: 'Average', count: 3 },
  { id: 'risk', label: 'Risk', count: 2 },
]

export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [activeView, setActiveView] = useState<DialogueEvaluationViewMode>('scorecard')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(
    MOCK_SCORECARD_ROWS[0]?.id ?? null
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
      {/* Top category chips + Schedule session button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_CHIPS.map((c) => {
            const isActive = c.id === activeCategory
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {c.label}
                {c.count != null ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={14} className="text-white" />}
          className="h-[36px] rounded-full px-4 text-xs"
        >
          {t('pages.training.dialogue.scheduleSession', 'Schedule a session')}
        </Button>
      </div>

      {/* View-mode strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2">
        {DIALOGUE_EVALUATION_VIEW_MODES.map((v) => {
          const meta = VIEW_MODE_LABELS[v]
          const isActive = activeView === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => setActiveView(v)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(meta.key, meta.fallback)}
            </button>
          )
        })}
      </div>

      {/* Body — left list + right detail panel */}
      {activeView === 'average-score' ? (
        <AvgScoreByTypeView />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
          <ScorecardListView
            rows={filteredRows}
            selectedId={selectedRowId}
            onSelect={setSelectedRowId}
          />
          <ScorecardDetailPanel selectedId={selectedRowId} />
        </div>
      )}
    </div>
  )
}

function ScorecardDetailPanel({ selectedId }: { selectedId: number | null }) {
  const { t } = useTranslation('common')
  const row = MOCK_SCORECARD_ROWS.find((r) => r.id === selectedId)

  if (!row) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs text-gray-500 shadow-sm">
        {t('pages.training.dialogue.detail.empty', 'Select a scorecard to view details')}
      </div>
    )
  }

  const criteria = [
    { label: 'Greeting', score: 5, max: 5 },
    { label: 'Reason for the call', score: 5, max: 5 },
    { label: 'Information gathering', score: 8, max: 10 },
    { label: 'Tone & orientation', score: 9, max: 10 },
    { label: 'Objection handling', score: 18, max: 20 },
    { label: 'Motivation & visualisation', score: 16, max: 20 },
    { label: 'Negotiation', score: 11, max: 15 },
    { label: 'Summary', score: 8, max: 10 },
    { label: 'CRM entry', score: 4, max: 5 },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-gray-700"
          style={{ backgroundColor: row.avatarColor }}
        >
          {row.operatorInitials}
        </div>
        <div className="flex flex-col">
          <span className="text-dark-500 text-sm font-semibold">{row.operatorName}</span>
          <span className="text-[11px] text-gray-500">
            {row.dateLabel} · {row.duration}
          </span>
        </div>
        <span className="bg-primary-50 text-primary-700 ml-auto rounded-full px-3 py-1 text-xs font-semibold">
          {row.score}/{row.scoreOutOf}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
        <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
          {t('pages.training.dialogue.detail.criteria', 'Criteria breakdown')}
        </span>
        {criteria.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="flex-1 text-[11px] text-gray-700">{c.label}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
              <div
                className="bg-primary-500 h-full rounded-full"
                style={{ width: `${(c.score / c.max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-[10px] font-medium text-gray-600">
              {c.score}/{c.max}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 rounded-full text-[11px]">
          {t('pages.training.dialogue.detail.editScore', 'Edit score')}
        </Button>
        <Button variant="primary" size="sm" className="flex-1 rounded-full text-[11px]">
          {t('pages.training.dialogue.detail.assignTask', 'Assign task')}
        </Button>
      </div>
    </div>
  )
}

export default DialogueEvaluationTab
