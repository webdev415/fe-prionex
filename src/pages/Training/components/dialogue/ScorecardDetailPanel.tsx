import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type {
  DialogueCriterionRating,
  DialogueScorecardRow,
} from '../../lib/dialogueScorecardAdapter'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'

const RATING_OPTIONS: {
  id: DialogueCriterionRating
  labelKey: string
  fallback: string
  points: string
  barClass: string
}[] = [
  {
    id: 'not_done',
    labelKey: 'pages.training.dialogue.ratings.notDone',
    fallback: 'Not done',
    points: '+0',
    barClass: 'bg-red-500/50',
  },
  {
    id: 'weak',
    labelKey: 'pages.training.dialogue.ratings.weak',
    fallback: 'Weak',
    points: '+4',
    barClass: 'bg-amber-400/50',
  },
  {
    id: 'normal',
    labelKey: 'pages.training.dialogue.ratings.normal',
    fallback: 'Normal',
    points: '+7',
    barClass: 'bg-blue-500/50',
  },
  {
    id: 'excellent',
    labelKey: 'pages.training.dialogue.ratings.excellent',
    fallback: 'Excellent',
    points: '+10',
    barClass: 'bg-emerald-500/50',
  },
]

function scoreTextColor(score: number): string {
  if (score >= 80) return 'text-[#15803D]'
  if (score >= 60) return 'text-[#D97706]'
  return 'text-[#B91C1C]'
}

export function ScorecardDetailPanel({ row }: { row: DialogueScorecardRow | undefined }) {
  const { t } = useTranslation('common')

  if (!row) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-[#6B7280] shadow-sm">
        {t('pages.training.dialogue.detail.empty', 'Select a scorecard to view details')}
      </div>
    )
  }

  return <ScorecardDetailBody key={row.id} row={row} />
}

function ScorecardDetailBody({ row }: { row: DialogueScorecardRow }) {
  const { t } = useTranslation('common')
  const [pendingAction, setPendingAction] = useState<'edit' | 'task' | null>(null)
  const [playing, setPlaying] = useState(false)

  // Criteria are rendered read-only from the live scorecard (KAN-737). Editing
  // stays behind the "Edit score" pending dialog until KAN-504 wires it.
  const criteria = row.criteria

  const filledCriteria = useMemo(
    () => criteria.filter((c) => c.rating !== 'not_done').length,
    [criteria]
  )

  const openEditPending = () => setPendingAction('edit')

  return (
    <>
      <div className="flex max-h-[847px] w-full flex-col overflow-hidden rounded-xl border border-[#EBECE8] bg-white xl:w-[400px]">
        {/* Header — gradient + operator + total score */}
        <div className="border-b border-[#EBECE8] bg-gradient-to-b from-[#F2F3F0] to-white p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-[#05040D] ring-2 ring-[#BBFB5B]"
                style={{ backgroundColor: row.avatarColor }}
              >
                {row.operatorInitials}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#05040D]">{row.operatorName}</p>
              <p className="text-[11px] text-[#6B7280]">
                {row.dateLabel} · {row.duration} · {row.trigger}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-0.5">
                <span
                  className={`text-2xl font-semibold ${
                    row.hasScore ? scoreTextColor(row.score) : 'text-[#9CA3AF]'
                  }`}
                >
                  {row.hasScore ? row.score : '—'}
                </span>
                <span className="text-xs font-light text-[#6B7280]">/{row.scoreOutOf}</span>
              </div>
              <p className="text-[10px] text-[#6B7280]">
                {filledCriteria}/{criteria.length}{' '}
                {t('pages.training.dialogue.detail.criteriaCount', 'criteria')}
              </p>
            </div>
          </div>
        </div>

        {/* Audio player */}
        <div className="border-b border-[#EBECE8] p-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#1F4242] p-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#BBFB5B]"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <span className="text-[10px] font-bold text-[#05040D]">||</span>
              ) : (
                <Icons.Play size={11} className="text-[#05040D]" />
              )}
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="relative h-2 rounded-full bg-[#236260]">
                <div className="absolute top-1/2 left-[35%] h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#1F4242] bg-[#BBFB5B]" />
              </div>
              <div className="flex justify-between text-[10px] text-[#D5F2ED]">
                <span>0:00</span>
                <span>-{row.audioDuration ?? row.duration}</span>
              </div>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/10"
              aria-label="microphone"
            >
              <Icons.Mic02 size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Criteria */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-[#05040D] uppercase">
              {t('pages.training.dialogue.detail.criteria', 'Criteria breakdown')}
            </span>
            <button
              type="button"
              onClick={openEditPending}
              className="flex items-center gap-1 text-[11px] text-[#7B7B7B] hover:text-[#05040D]"
            >
              <Icons.Reload size={12} />
              {t('pages.training.dialogue.detail.clear', 'Clear')}
            </button>
          </div>

          {criteria.map((criterion) => (
            <div key={criterion.id} className="rounded-lg bg-[#F7F7F7] p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#05040D]">{criterion.label}</p>
                  <p className="text-[10px] text-[#6B7280]">
                    {t('pages.training.dialogue.detail.weight', 'Weight {{n}} pts', {
                      n: criterion.weight,
                    })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#05040D]">
                  {criterion.score} / {criterion.maxScore}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {RATING_OPTIONS.map((opt) => {
                  const selected = criterion.rating === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={openEditPending}
                      className={`relative flex min-h-[69px] flex-col rounded-md bg-white px-2 py-2 text-left transition-shadow ${
                        selected ? 'shadow-[0_0_0_2px_#80D80A,0_1px_2px_rgba(0,0,0,0.05)]' : ''
                      }`}
                    >
                      <span className={`mb-1 h-1.5 w-full rounded-full ${opt.barClass}`} />
                      <span className="text-[10px] leading-tight font-medium text-[#05040D]">
                        {t(opt.labelKey, opt.fallback)}
                      </span>
                      <span className="text-[9px] text-[#6B7280]">{opt.points}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 border-t border-[#EBECE8] p-4">
          <button
            type="button"
            onClick={() => setPendingAction('edit')}
            className="flex-1 rounded-md border border-[#EDEDED] bg-white py-2.5 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('pages.training.dialogue.detail.editScore', 'Edit score')}
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('task')}
            className="flex-1 rounded-md bg-[#204E4D] py-2.5 text-xs font-medium text-white hover:bg-[#1a3f3e]"
          >
            {t('pages.training.dialogue.detail.assignTask', 'Assign task')}
          </button>
        </div>
      </div>

      <PendingFeatureDialog
        open={pendingAction === 'edit'}
        onClose={() => setPendingAction(null)}
        titleKey="pages.training.dialogue.detail.editScore"
        titleFallback="Edit score"
        descriptionKey="pages.training.dialogue.pending.editScore"
        descriptionFallback="Adjust criterion ratings and save an updated scorecard."
        dependsOnIssue="KAN-504"
        operatorName={row.operatorName}
      />
      <PendingFeatureDialog
        open={pendingAction === 'task'}
        onClose={() => setPendingAction(null)}
        titleKey="pages.training.dialogue.detail.assignTask"
        titleFallback="Assign task"
        descriptionKey="pages.training.dialogue.pending.assignTask"
        descriptionFallback="Create a follow-up task from this scorecard review."
        dependsOnIssue="KAN-411"
        operatorName={row.operatorName}
      />
    </>
  )
}

export default ScorecardDetailPanel
