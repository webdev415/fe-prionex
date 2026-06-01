import { useTranslation } from 'react-i18next'
import {
  type InboxAssignmentState,
  type MockInboxRow,
  type ScoreBand,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Mock-data Kanban view — 5 columns matching the Inbox states. Mirrors the
 * Kanban Figma frame.
 */
export interface MockInboxKanbanViewProps {
  rows: MockInboxRow[]
  onSelect: (operatorId: number) => void
}

const COLUMN_ORDER: { state: InboxAssignmentState; label: string; tone: string }[] = [
  { state: 'wait', label: 'Wait', tone: 'border-amber-200 bg-amber-50/40' },
  { state: 'in_progress', label: 'In progress', tone: 'border-blue-200 bg-blue-50/40' },
  {
    state: 'awaiting_training',
    label: 'Awaiting training',
    tone: 'border-violet-200 bg-violet-50/40',
  },
  { state: 'scheduled', label: 'Scheduled', tone: 'border-indigo-200 bg-indigo-50/40' },
  { state: 'closed', label: 'Closed', tone: 'border-gray-200 bg-gray-50/60' },
]

const SCORE_BG: Record<ScoreBand, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
}

export function MockInboxKanbanView({ rows, onSelect }: MockInboxKanbanViewProps) {
  const { t } = useTranslation('common')

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {COLUMN_ORDER.map((col) => {
        const colRows = rows.filter((r) => r.state === col.state)
        return (
          <div key={col.state} className={`flex flex-col gap-2 rounded-2xl border p-3 ${col.tone}`}>
            <div className="flex items-center justify-between px-1">
              <span className="text-dark-500 text-xs font-semibold">
                {t(`pages.training.inbox.kanbanColumns.${col.state}`, col.label)}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">
                {colRows.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {colRows.map((row) => (
                <button
                  key={row.operatorId}
                  type="button"
                  onClick={() => onSelect(row.operatorId)}
                  className="hover:border-primary-200 flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2.5 text-left transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-semibold text-gray-700"
                      style={{ backgroundColor: row.avatarColor }}
                    >
                      {row.initials}
                    </div>
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 inline-block h-2 w-2 rounded-full border-2 border-white ${
                        row.online ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-dark-500 truncate text-xs font-medium">{row.name}</span>
                    <span className="text-[10px] text-gray-500">{row.team}</span>
                  </div>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${SCORE_BG[row.scoreBand]}`}
                  >
                    {row.compositeScore}
                  </span>
                </button>
              ))}
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

export default MockInboxKanbanView
