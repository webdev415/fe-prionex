import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type {
  InboxAssignmentState,
  MockInboxRow,
  ScoreBand,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Mock-data Inbox list view. Left panel rows of operator + state chip +
 * triggers + composite-score ring. Mirrors the Inbox View A Figma frame.
 */
export interface MockInboxListViewProps {
  rows: MockInboxRow[]
  selectedOperatorId: number
  onSelect: (operatorId: number) => void
}

const STATE_TONE: Record<InboxAssignmentState, { label: string; tone: string }> = {
  wait: { label: 'Wait', tone: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In progress', tone: 'bg-blue-100 text-blue-700' },
  awaiting_training: { label: 'Awaiting training', tone: 'bg-violet-100 text-violet-700' },
  scheduled: { label: 'Scheduled', tone: 'bg-indigo-100 text-indigo-700' },
  closed: { label: 'Closed', tone: 'bg-gray-100 text-gray-600' },
}

const SCORE_TRACK: Record<ScoreBand, string> = {
  red: 'stroke-red-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const SCORE_TEXT: Record<ScoreBand, string> = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

export function MockInboxListView({ rows, selectedOperatorId, onSelect }: MockInboxListViewProps) {
  const { t } = useTranslation('common')

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs text-gray-500 shadow-sm">
        {t('pages.training.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  const inProgressCount = rows.filter((r) => r.state === 'in_progress').length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
          {t('pages.training.inbox.list.header', 'In line')}
          <span className="ml-2 text-gray-700">
            {rows.length} {t('pages.training.inbox.list.employees', 'employees')}
          </span>
        </span>
        <span className="text-primary-600 text-[10px] font-medium">
          {t('pages.training.inbox.list.sortByPriority', 'Sort by priority')} ↓
        </span>
      </div>
      {inProgressCount > 0 ? (
        <span className="text-[9px] font-medium tracking-wide text-emerald-700 uppercase">
          {t('pages.training.inbox.list.inProgress', 'In progress')} · {inProgressCount}
        </span>
      ) : null}
      <ul className="flex max-h-[640px] flex-col gap-1.5 overflow-y-auto">
        {rows.map((row) => {
          const isActive = row.operatorId === selectedOperatorId
          const state = STATE_TONE[row.state]
          const radius = 16
          const circumference = 2 * Math.PI * radius
          const offset = circumference - (row.compositeScore / 100) * circumference
          return (
            <li key={row.operatorId}>
              <button
                type="button"
                onClick={() => onSelect(row.operatorId)}
                className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary-400 ring-primary-100 ring-2'
                    : 'hover:border-primary-200 border-gray-100'
                }`}
              >
                {/* Avatar with red-flag dot */}
                <div className="relative flex-shrink-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-gray-700"
                    style={{ backgroundColor: row.avatarColor }}
                  >
                    {row.initials}
                  </div>
                  {row.flagged ? (
                    <span className="absolute -top-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                  ) : null}
                  <span
                    className={`absolute -right-0.5 -bottom-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white ${
                      row.online ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  />
                </div>

                {/* Name + state + triggers */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-dark-500 truncate text-sm font-medium">{row.name}</span>
                    <span className="bg-primary-50 text-primary-700 flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
                      {row.department}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${state.tone}`}
                    >
                      {state.label}
                    </span>
                    <span className="text-[10px] text-gray-500">{row.lastActiveLabel}</span>
                    {row.triggers.length > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-red-600">
                        <Icons.Warning size={10} className="text-red-600" />
                        {row.triggers.length} {t('pages.training.inbox.list.triggers', 'triggers')}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Score ring */}
                <div className="relative h-10 w-10 flex-shrink-0">
                  <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r={radius}
                      strokeWidth="3"
                      fill="none"
                      className="stroke-gray-100"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r={radius}
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className={SCORE_TRACK[row.scoreBand]}
                    />
                  </svg>
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${SCORE_TEXT[row.scoreBand]}`}
                  >
                    {row.compositeScore}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default MockInboxListView
