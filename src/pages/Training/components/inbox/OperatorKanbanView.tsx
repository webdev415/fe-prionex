import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTransitionAssignment } from '@/features/quality/coaching/hooks'
import type { AssignmentState } from '@/features/quality/coaching/types'
import {
  type InboxAssignmentState,
  type MockInboxRow,
  type ScoreBand,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Kanban view of the Inbox queue (KAN-413 §3.5).
 *
 * Visual layout mirrors the Figma `Kanban View` frame (promoted from the
 * `MockInboxKanbanView`). Cards carry the `assignment.id` returned by the
 * BE so column changes can fire `POST /assignments/{id}/transition`.
 * Double-click promotes a card to the next column — drag-and-drop wiring
 * (dnd-kit) lands with the next round.
 */
export interface OperatorKanbanViewProps {
  rows: MockInboxRow[]
  /** Resolves `operator_id` → `assignment.id` for the transition endpoint. */
  assignmentIdByOperator: Map<number, number | null>
  selectedOperatorId?: number
  onSelect: (operatorId: number) => void
  isLoading?: boolean
}

const COLUMN_ORDER: {
  state: InboxAssignmentState
  label: string
  subtitle: string
  tone: string
}[] = [
  {
    state: 'wait',
    label: 'New',
    subtitle: 'Just arrived',
    tone: 'border-amber-100 bg-amber-50/30',
  },
  {
    state: 'in_progress',
    label: 'In progress',
    subtitle: 'The coach has taken it on',
    tone: 'border-blue-100 bg-blue-50/30',
  },
  {
    state: 'awaiting_training',
    label: 'Awaiting training',
    subtitle: 'Assigned course/drill',
    tone: 'border-violet-100 bg-violet-50/30',
  },
  {
    state: 'scheduled',
    label: 'Scheduled 1-on-1',
    subtitle: 'There is a session in the calendar',
    tone: 'border-indigo-100 bg-indigo-50/30',
  },
  {
    state: 'closed',
    label: 'Closed',
    subtitle: 'With resolution',
    tone: 'border-gray-200 bg-gray-50/60',
  },
]

const SCORE_TRACK: Record<ScoreBand, string> = {
  red: 'stroke-red-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const TAG_TONE: Record<'red' | 'amber' | 'teal', string> = {
  red: 'bg-red-50 text-red-700 border-red-100',
  amber: 'bg-yellow-50 text-amber-800 border-yellow-100',
  teal: 'bg-teal-50 text-teal-700 border-teal-100',
}

export function OperatorKanbanView({
  rows,
  assignmentIdByOperator,
  selectedOperatorId,
  onSelect,
  isLoading,
}: OperatorKanbanViewProps) {
  const { t } = useTranslation('common')
  const transitionMutation = useTransitionAssignment()

  const handleMove = async (operatorId: number, target: InboxAssignmentState) => {
    const assignmentId = assignmentIdByOperator.get(operatorId)
    if (!assignmentId) {
      toast.error(
        t(
          'pages.training.inbox.kanban.noAssignment',
          'No active assignment yet — take charge first.'
        )
      )
      return
    }
    try {
      await transitionMutation.mutateAsync({
        assignmentId,
        payload: { to_state: target as AssignmentState },
      })
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.training.inbox.kanban.transitionFailed', 'Could not move the card.')
      toast.error(detail)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.list.loading', 'Loading queue…')}
      </div>
    )
  }

  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
      {COLUMN_ORDER.map((col) => {
        const colRows = rows.filter((r) => r.state === col.state)
        return (
          <div
            key={col.state}
            className={`flex min-w-[200px] flex-col gap-2 rounded-xl border p-3 ${col.tone}`}
          >
            <div className="px-1">
              <p className="text-xs font-semibold text-[#05040D]">
                {t(`pages.training.inbox.kanbanColumns.${col.state}`, col.label)}
              </p>
              <p className="text-[10px] text-gray-500">{col.subtitle}</p>
              <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {colRows.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {colRows.map((row) => {
                const isSelected = row.operatorId === selectedOperatorId
                const radius = 12
                const circumference = 2 * Math.PI * radius
                const offset = circumference - (row.compositeScore / 100) * circumference
                return (
                  <button
                    key={row.operatorId}
                    type="button"
                    onClick={() => onSelect(row.operatorId)}
                    onDoubleClick={() => {
                      const idx = COLUMN_ORDER.findIndex((c) => c.state === row.state)
                      const next = COLUMN_ORDER[idx + 1]
                      if (next) {
                        void handleMove(row.operatorId, next.state)
                      }
                    }}
                    className={`flex flex-col gap-2 rounded-xl border bg-white p-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#204E4D] ring-1 ring-[#204E4D]/20'
                        : 'border-[#EBECE8] hover:border-[#204E4D]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: row.avatarColor }}
                      >
                        {row.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#05040D]">
                          {row.name.split(' ')[0]} {row.name.split(' ')[1]?.[0]}.
                        </p>
                        <p className="truncate text-[10px] text-gray-500">{row.team}</p>
                      </div>
                      <div className="relative h-8 w-8 flex-shrink-0">
                        <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90">
                          <circle
                            cx="16"
                            cy="16"
                            r={radius}
                            strokeWidth="2.5"
                            fill="none"
                            className="stroke-gray-100"
                          />
                          {row.hasScore !== false ? (
                            <circle
                              cx="16"
                              cy="16"
                              r={radius}
                              strokeWidth="2.5"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={offset}
                              className={SCORE_TRACK[row.scoreBand]}
                            />
                          ) : null}
                        </svg>
                        <span
                          className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold ${
                            row.hasScore !== false ? 'text-gray-700' : 'text-gray-400'
                          }`}
                        >
                          {row.hasScore !== false ? row.compositeScore : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.triggerTags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${TAG_TONE[tag.tone]}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500">{row.cardTimestamp}</p>
                  </button>
                )
              })}
              {colRows.length === 0 ? (
                <div className="rounded-lg bg-white/60 p-3 text-center text-[10px] text-gray-400">
                  {t('pages.training.inbox.kanban.empty', 'Empty')}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default OperatorKanbanView
