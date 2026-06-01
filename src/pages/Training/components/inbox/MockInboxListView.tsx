import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockInboxRow, ScoreBand } from '../../mocks/trainerWorkplaceMocks'

export interface MockInboxListViewProps {
  rows: MockInboxRow[]
  selectedOperatorId: number
  onSelect: (operatorId: number) => void
}

const STATUS_DOT: Record<MockInboxRow['listStatusDot'], string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
}

const SCORE_TRACK: Record<ScoreBand, string> = {
  red: 'stroke-red-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const SCORE_TEXT: Record<ScoreBand, string> = {
  red: 'text-red-500',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

export function MockInboxListView({ rows, selectedOperatorId, onSelect }: MockInboxListViewProps) {
  const { t } = useTranslation('common')

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  const inProgressRows = rows.filter((r) => r.state === 'in_progress' || r.state === 'wait')

  return (
    <div className="flex h-full max-h-[740px] flex-col overflow-hidden rounded-xl border border-[#EBECE8] bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[#EBECE8] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icons.Briefcase01 size={14} className="text-[#204E4D]" />
          <span className="text-[11px] font-semibold tracking-[0.55px] text-[#05040D] uppercase">
            {t('pages.training.inbox.list.inProgress', 'In progress')}
          </span>
        </div>
        <span className="rounded-full bg-[#EDEDED] px-1.5 py-0.5 text-[10px] font-medium text-[#676767]">
          {inProgressRows.length || rows.length}
        </span>
      </div>

      <ul className="flex flex-1 flex-col overflow-y-auto">
        {rows.map((row) => {
          const isActive = row.operatorId === selectedOperatorId
          const radius = 14
          const circumference = 2 * Math.PI * radius
          const offset = circumference - (row.compositeScore / 100) * circumference
          return (
            <li key={row.operatorId}>
              <button
                type="button"
                onClick={() => onSelect(row.operatorId)}
                className={`flex w-full items-center gap-2 border-b border-[#EBECE8]/60 px-3 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-[#F7FFE5]/60' : 'hover:bg-gray-50/80'
                }`}
              >
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[row.listStatusDot]}`}
                />
                <div className="relative flex-shrink-0">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-[#05040D]"
                    style={{ backgroundColor: row.avatarColor }}
                  >
                    {row.initials}
                  </div>
                  <span
                    className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                      row.online ? 'bg-emerald-500' : 'bg-gray-400'
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#05040D]">{row.name}</p>
                  {row.triggers.length > 0 ? (
                    <p className="text-[11px] text-[#676767]">
                      {row.triggers.length} {t('pages.training.inbox.list.triggers', 'triggers')}
                    </p>
                  ) : null}
                </div>
                <div className="relative h-9 w-9 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r={radius}
                      strokeWidth="3"
                      fill="none"
                      className="stroke-[#EDEDED]"
                    />
                    <circle
                      cx="18"
                      cy="18"
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
