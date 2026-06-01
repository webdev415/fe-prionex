import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { type MockInboxRow, type ScoreBand } from '../../mocks/trainerWorkplaceMocks'

/**
 * Mock-data Grid view — operator tiles in a card grid. Each tile carries
 * avatar + name + score ring + trigger summary + quick action icons.
 */
export interface MockInboxGridViewProps {
  rows: MockInboxRow[]
  onSelect: (operatorId: number) => void
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

const STATE_TONE: Record<string, string> = {
  wait: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_training: 'bg-violet-100 text-violet-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-gray-100 text-gray-600',
}

const STATE_LABEL: Record<string, string> = {
  wait: 'Wait',
  in_progress: 'In progress',
  awaiting_training: 'Awaiting training',
  scheduled: 'Scheduled',
  closed: 'Closed',
}

export function MockInboxGridView({ rows, onSelect }: MockInboxGridViewProps) {
  const { t } = useTranslation('common')

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => {
        const radius = 22
        const circumference = 2 * Math.PI * radius
        const offset = circumference - (row.compositeScore / 100) * circumference
        return (
          <button
            key={row.operatorId}
            type="button"
            onClick={() => onSelect(row.operatorId)}
            className="hover:border-primary-200 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-gray-700"
                  style={{ backgroundColor: row.avatarColor }}
                >
                  {row.initials}
                </div>
                <span
                  className={`absolute -right-0.5 -bottom-0.5 inline-block h-3 w-3 rounded-full border-2 border-white ${
                    row.online ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-dark-500 truncate text-sm font-semibold">{row.name}</span>
                <span className="text-[10px] text-gray-500">{row.team}</span>
              </div>
              <div className="relative h-12 w-12 flex-shrink-0">
                <svg viewBox="0 0 52 52" className="h-12 w-12 -rotate-90">
                  <circle
                    cx="26"
                    cy="26"
                    r={radius}
                    strokeWidth="4"
                    fill="none"
                    className="stroke-gray-100"
                  />
                  <circle
                    cx="26"
                    cy="26"
                    r={radius}
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={SCORE_TRACK[row.scoreBand]}
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-xs font-semibold ${SCORE_TEXT[row.scoreBand]}`}
                >
                  {row.compositeScore}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATE_TONE[row.state]}`}
              >
                {STATE_LABEL[row.state]}
              </span>
              <span className="text-[10px] text-gray-500">{row.lastActiveLabel}</span>
            </div>

            {row.triggers.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-lg bg-red-50/60 p-2">
                {row.triggers.slice(0, 2).map((tr) => (
                  <div key={tr.id} className="flex items-center gap-1.5 text-[10px] text-red-700">
                    <Icons.Warning size={10} className="text-red-600" />
                    <span className="font-medium">{tr.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50/60 p-2 text-[10px] text-emerald-700">
                <Icons.Success size={10} className="text-emerald-600" />
                <span className="font-medium">
                  {t('pages.training.inbox.grid.noTriggers', 'No triggers')}
                </span>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <span className="bg-primary-50 text-primary-700 flex h-7 w-7 items-center justify-center rounded-full">
                <Icons.Phone size={12} />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <Icons.Chat size={12} />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                <Icons.Calendar size={12} />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                <Icons.Brochure size={12} />
              </span>
              <span className="text-primary-600 flex-1 text-right text-[10px] font-medium">
                {t('pages.training.inbox.grid.open', 'Open')} →
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default MockInboxGridView
