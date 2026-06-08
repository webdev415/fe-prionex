import type { MockOperator, ScoreBand } from '../../mocks/trainerWorkplaceMocks'
import {
  operatorPresence,
  PRESENCE_DOT,
  PRESENCE_TEXT,
  TEAM_SCORE_RING,
  TEAM_SCORE_TEXT,
} from './teamStyles'

export interface OperatorRowProps {
  operator: MockOperator
  onSelect?: (operatorId: number) => void
}

const PLAN_BAR: Record<ScoreBand, string> = {
  green: '#22C55E',
  amber: '#CA8A04',
  red: '#EF4444',
}

/** Figma operator tile — #F7F7F7 card, lime avatar, daily plan bar, score ring */
export function OperatorRow({ operator, onSelect }: OperatorRowProps) {
  const presence = operatorPresence(operator)
  const planPct = operator.dailyPlanPct ?? 0
  const radius = 17
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (operator.score / 100) * circumference

  return (
    <button
      type="button"
      onClick={() => onSelect?.(operator.id)}
      className="flex items-center gap-3 rounded-lg bg-[#F7F7F7] p-3 text-left transition-colors hover:bg-[#F2F3F0]"
    >
      <div className="relative flex-shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#BBFB5B] text-xs font-semibold tracking-[-0.02em] text-[#05040D]">
          {operator.initials}
        </div>
        <span
          className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
          style={{ backgroundColor: PRESENCE_DOT[presence] }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 font-medium text-[#05040D]">{operator.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className="text-xs leading-4 font-medium"
            style={{ color: PRESENCE_TEXT[presence] }}
          >
            {operator.lastActiveLabel}
          </span>
          {operator.extension ? (
            <span className="text-[10px] leading-[15px] text-[#6B7280]">
              ext {operator.extension}
            </span>
          ) : null}
        </div>
        {operator.dailyPlanPct != null && operator.dailyPlanPct > 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#EBECE8]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${planPct}%`,
                  backgroundColor: PLAN_BAR[operator.scoreBand],
                }}
              />
            </div>
            <span className="text-[10px] leading-[15px] text-[#4B5563]">{planPct}%</span>
          </div>
        ) : null}
      </div>

      <div className="relative h-10 w-10 flex-shrink-0">
        <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
          <circle cx="20" cy="20" r={radius} strokeWidth="2" fill="none" stroke="#EDEDED" />
          <circle
            cx="20"
            cy="20"
            r={radius}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            stroke={TEAM_SCORE_RING[operator.scoreBand]}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
          style={{ color: TEAM_SCORE_TEXT[operator.scoreBand] }}
        >
          {operator.score}
        </span>
      </div>
    </button>
  )
}

export default OperatorRow
