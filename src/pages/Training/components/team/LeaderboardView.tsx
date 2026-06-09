import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useLeaderboard, leaderboardExportUrl } from '@/features/training'
import type { LeaderboardPeriod, LeaderboardRow } from '@/features/training'

const PERIOD_LABELS: { id: LeaderboardPeriod; key: string; fallback: string }[] = [
  { id: 'week', key: 'pages.training.team.leaderboard.period.week', fallback: 'This week' },
  { id: 'month', key: 'pages.training.team.leaderboard.period.month', fallback: 'This month' },
]

/**
 * Team-tab leaderboard view (KAN-411 Feature 3.2).
 *
 * Cached snapshot per UTC day; the refresh button forces recompute via
 * `?refresh=true`. The top 3 rows get a medal column highlight; the
 * rank-change arrow shows the delta vs the prior period (positive =
 * climbed, negative = fell).
 */
export function LeaderboardView() {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<LeaderboardPeriod>('week')
  const [refreshKey, setRefreshKey] = useState(0)

  const { data, isLoading, isError, isFetching, refetch } = useLeaderboard({
    period,
    // The hook key is keyed off `period`, not `refresh`; we toggle a
    // local key so the button gives the trainer a clear "compute again"
    // affordance without changing the cache shape.
    refresh: refreshKey > 0,
  })

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const nameByOp = useMemo(() => {
    const out = new Map<number, string>()
    operators.forEach((o) => out.set(Number(o.id), o.full_name || `#${o.id}`))
    return out
  }, [operators])

  const rows = data?.ranking ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#EBECE8] bg-white p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          {PERIOD_LABELS.map((opt) => {
            const isActive = opt.id === period
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium tracking-[-0.02em] transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {t(opt.key, opt.fallback)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRefreshKey((k) => k + 1)
              refetch()
            }}
            disabled={isFetching}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#DFDFDF] bg-white px-3 text-xs text-[#545454] hover:bg-[#F7F7F7] disabled:opacity-50"
          >
            <Icons.Reload size={12} />
            {isFetching
              ? t('pages.training.team.leaderboard.refreshing', 'Recomputing…')
              : t('pages.training.team.leaderboard.refresh', 'Recompute')}
          </button>
          <a
            href={leaderboardExportUrl(period)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#204E4D] px-3 text-xs font-medium text-white hover:bg-[#1a3f3e]"
          >
            <Icons.Download size={12} className="text-white" />
            {t('pages.training.team.leaderboard.export', 'Export .xlsx')}
          </a>
        </div>
      </div>

      {data ? (
        <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
          <span>
            {t('pages.training.team.leaderboard.window', 'Window')}: {data.period_start} →{' '}
            {data.period_end}
          </span>
          <span>·</span>
          <span>
            {t('pages.training.team.leaderboard.computedAt', 'Computed')}:{' '}
            {new Date(data.computed_at).toLocaleString()}
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-[#6B7280]">
          {t('pages.training.team.leaderboard.loading', 'Computing leaderboard…')}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
          {t('pages.training.team.leaderboard.loadError', 'Could not load the leaderboard.')}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
          {t('pages.training.team.leaderboard.empty', 'No operators ranked yet for this period.')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#EBECE8] bg-white">
          <table className="w-full text-xs">
            <thead className="border-b border-[#F1F1EE] text-[10px] tracking-wide text-[#6B7280] uppercase">
              <tr>
                <th className="w-[60px] px-3 py-2 text-left">
                  {t('pages.training.team.leaderboard.rank', 'Rank')}
                </th>
                <th className="px-3 py-2 text-left">
                  {t('pages.training.team.leaderboard.operator', 'Operator')}
                </th>
                <th className="w-[100px] px-3 py-2 text-right">
                  {t('pages.training.team.leaderboard.score', 'Score')}
                </th>
                <th className="w-[100px] px-3 py-2 text-right">
                  {t('pages.training.team.leaderboard.rankDelta', 'Δ Rank')}
                </th>
                <th className="hidden w-[120px] px-3 py-2 text-right md:table-cell">
                  {t('pages.training.team.leaderboard.components.scorecard', 'Avg scorecard')}
                </th>
                <th className="hidden w-[120px] px-3 py-2 text-right md:table-cell">
                  {t('pages.training.team.leaderboard.components.tasks', 'Tasks on-time')}
                </th>
                <th className="hidden w-[100px] px-3 py-2 text-right lg:table-cell">
                  {t('pages.training.team.leaderboard.components.script', 'Script')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <LeaderboardRowItem
                  key={row.operator_id}
                  row={row}
                  name={nameByOp.get(row.operator_id) ?? `#${row.operator_id}`}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LeaderboardRowItem({ row, name }: { row: LeaderboardRow; name: string }) {
  const isPodium = row.rank <= 3
  const rowTone = isPodium ? 'bg-[#F7FDF7]' : ''
  return (
    <tr className={`border-b border-[#F7F7F7] ${rowTone}`}>
      <td className="px-3 py-2">
        <RankBadge rank={row.rank} />
      </td>
      <td className="px-3 py-2 text-[#05040D]">{name}</td>
      <td className="px-3 py-2 text-right font-semibold text-[#05040D]">{row.score}</td>
      <td className="px-3 py-2 text-right">
        <RankDelta delta={row.rank_change_vs_prior} />
      </td>
      <td className="hidden px-3 py-2 text-right text-[#374151] md:table-cell">
        {formatPct(row.components.avg_scorecard_pct)}
      </td>
      <td className="hidden px-3 py-2 text-right text-[#374151] md:table-cell">
        {formatPct(row.components.task_completion_on_time_pct)}
      </td>
      <td className="hidden px-3 py-2 text-right text-[#374151] lg:table-cell">
        {formatPct(row.components.script_adherence_pct)}
      </td>
    </tr>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? 'bg-amber-100 text-amber-700'
      : rank === 2
        ? 'bg-gray-200 text-gray-700'
        : rank === 3
          ? 'bg-orange-100 text-orange-700'
          : 'bg-[#F3F4F6] text-[#374151]'
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${tone}`}
    >
      {rank}
    </span>
  )
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-[#9CA3AF]">—</span>
  if (delta === 0) return <span className="text-[#9CA3AF]">±0</span>
  const positive = delta > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${
        positive ? 'text-emerald-600' : 'text-[#EF4444]'
      }`}
    >
      {positive ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  )
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Math.round(value)}%`
}

export default LeaderboardView
