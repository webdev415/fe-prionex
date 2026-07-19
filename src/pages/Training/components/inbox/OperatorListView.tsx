import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InboxCardRow, ScoreBand } from '../../mocks/trainerWorkplaceMocks'

/**
 * Inbox view — Figma View B (confirmed by PM).
 *
 * Promoted from `MockInboxListView` so the Figma-faithful card style stays
 * authoritative while the data source switches to the BE-derived
 * `InboxCardRow` shape produced by [`inboxRowAdapter`](../../lib/inboxRowAdapter.ts).
 *
 * Pairs with the right Details / Event Feed panel; click → focuses the
 * operator in the right detail panel via `onSelect`.
 */
export interface OperatorListViewProps {
  rows: InboxCardRow[]
  selectedOperatorId: number
  onSelect: (operatorId: number) => void
  isLoading?: boolean
}

type SortMode = 'priority' | 'name' | 'score'

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

const TAG_TONE: Record<'red' | 'amber' | 'teal', string> = {
  red: 'bg-red-50 text-red-700 border-red-100',
  amber: 'bg-yellow-50 text-amber-800 border-yellow-100',
  teal: 'bg-teal-50 text-teal-700 border-teal-100',
}

const PRIORITY_RANK: Record<InboxCardRow['priority'], number> = {
  critical: 0,
  average: 1,
  low: 2,
}

function formatPresence(row: InboxCardRow, t: (key: string, fallback: string) => string): string {
  if (row.lastActiveLabel === 'In call') {
    return t('pages.training.inbox.list.onCall', 'On the call')
  }
  if (row.online) {
    return t('pages.training.inbox.detail.online', 'Online')
  }
  return row.lastActiveLabel
}

function ScoreRing({
  score,
  band,
  hasScore = true,
}: {
  score: number
  band: ScoreBand
  hasScore?: boolean
}) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = hasScore ? circumference - (score / 100) * circumference : circumference
  return (
    <div className="relative h-11 w-11 flex-shrink-0">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          strokeWidth="3"
          fill="none"
          className="stroke-[#EDEDED]"
        />
        {hasScore ? (
          <circle
            cx="22"
            cy="22"
            r={radius}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={SCORE_TRACK[band]}
          />
        ) : null}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${
          hasScore ? SCORE_TEXT[band] : 'text-gray-400'
        }`}
      >
        {hasScore ? score : '—'}
      </span>
    </div>
  )
}

export function OperatorListView({
  rows,
  selectedOperatorId,
  onSelect,
  isLoading,
}: OperatorListViewProps) {
  const { t } = useTranslation('common')
  const [sort, setSort] = useState<SortMode>('priority')

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    if (sort === 'name') {
      copy.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'score') {
      copy.sort((a, b) => a.compositeScore - b.compositeScore)
    } else {
      copy.sort((a, b) => {
        const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        if (p !== 0) return p
        return a.compositeScore - b.compositeScore
      })
    }
    return copy
  }, [rows, sort])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.list.loading', 'Loading queue…')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <h2 className="text-sm font-semibold text-[#05040D]">
          {t('pages.training.inbox.list.employeesInLine', '{{count}} employees in line', {
            count: rows.length,
          })}
        </h2>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <span>{t('pages.training.inbox.list.sortLabel', 'Sorting')}:</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-lg border border-[#EBECE8] bg-white px-2 py-1 text-xs text-[#05040D] outline-none"
          >
            <option value="priority">
              {t('pages.training.inbox.list.sortByPriority', 'by priority')}
            </option>
            <option value="score">{t('pages.training.inbox.list.sortByScore', 'by score')}</option>
            <option value="name">{t('pages.training.inbox.list.sortByName', 'by name')}</option>
          </select>
        </label>
      </div>

      <ul className="flex max-h-[min(720px,calc(100vh-280px))] flex-col gap-2 overflow-y-auto pr-1">
        {sortedRows.map((row) => {
          const isSelected = row.operatorId === selectedOperatorId
          return (
            <li key={row.operatorId}>
              <button
                type="button"
                onClick={() => onSelect(row.operatorId)}
                className={`flex w-full flex-col gap-3 rounded-xl border bg-white p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-[#204E4D] ring-1 ring-[#204E4D]/20'
                    : 'border-[#EBECE8] hover:border-[#204E4D]/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-[#05040D]"
                      style={{ backgroundColor: row.avatarColor }}
                    >
                      {row.initials}
                    </div>
                    <span
                      className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white ${
                        row.online ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[#05040D]">{row.name} </span>
                    <span className="text-[11px] text-gray-500">
                      {row.team} · {row.segment}
                      {row.extension
                        ? ` · ${t('pages.training.team.ext', 'ext')} ${row.extension}`
                        : ''}
                    </span>
                    <span className="text-[11px] text-gray-600">{formatPresence(row, t)}</span>
                    <p className="text-xs leading-relaxed text-[#05040D]">{row.cardSummary}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ScoreRing
                      score={row.compositeScore}
                      band={row.scoreBand}
                      hasScore={row.hasScore !== false}
                    />
                    <span className="text-[10px] text-gray-500">{row.cardTimestamp}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {row.triggerTags.map((tag) => (
                    <span
                      key={tag.label}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${TAG_TONE[tag.tone]}`}
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default OperatorListView
