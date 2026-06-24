import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useScorecardAggregate } from '@/features/quality'
import type { AggregateGroupBy, AggregateRow } from '@/features/quality'

/**
 * Score Aggregation View (KAN-504). Average score per scorecard type
 * (Client / Third Party) over a selected period, grouped by operator /
 * team / all, with a trend vs the prior equal-length window. Wired to
 * GET /api/v1/quality/scorecards/aggregate.
 */

const PERIODS = ['today', 'yesterday', 'last_7d', 'last_30d'] as const
type Period = (typeof PERIODS)[number]

const GROUP_BYS: AggregateGroupBy[] = ['operator', 'team', 'all']

export function AvgScoreByTypeView({ operatorIds }: { operatorIds?: number[] }) {
  const { t } = useTranslation('common')
  const [period, setPeriod] = useState<Period>('last_7d')
  const [groupBy, setGroupBy] = useState<AggregateGroupBy>('operator')

  const { data, isLoading, isError } = useScorecardAggregate({
    period,
    group_by: groupBy,
    operator_id: operatorIds && operatorIds.length > 0 ? operatorIds : undefined,
  })

  const rows = data?.rows ?? []

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[#EBECE8] bg-white p-6 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#05040D]">
            {t('pages.training.dialogue.avgByType.title', 'Average score by dialogue type')}
          </h3>
          <p className="text-xs text-[#6B7280]">
            {t(
              'pages.training.dialogue.avgByType.subtitle',
              'Average client vs third-party scorecard score over the selected period.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            label={t('pages.training.dialogue.avgByType.groupBy', 'Group by')}
            value={groupBy}
            onChange={(v) => setGroupBy(v as AggregateGroupBy)}
            options={GROUP_BYS.map((g) => ({
              value: g,
              label: t(`pages.training.dialogue.avgByType.group.${g}`, g),
            }))}
          />
          <Select
            label={t('pages.training.dialogue.avgByType.period', 'Period')}
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({
              value: p,
              label: t(`pages.training.dialogue.avgByType.periods.${p}`, p),
            }))}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-[#6B7280]">
          {t('common.loading', 'Loading…')}
        </div>
      ) : isError ? (
        <div className="py-10 text-center text-sm text-red-500">
          {t('pages.training.dialogue.avgByType.error', 'Failed to load aggregation')}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#6B7280]">
          {t('pages.training.dialogue.avgByType.empty', 'No scored calls in this period.')}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#EBECE8] text-left text-xs font-medium text-[#6B7280]">
              <th className="py-2 pr-3">
                {groupBy === 'team'
                  ? t('pages.training.dialogue.avgByType.col.team', 'Team')
                  : groupBy === 'all'
                    ? t('pages.training.dialogue.avgByType.col.scope', 'Scope')
                    : t('pages.training.dialogue.avgByType.col.operator', 'Operator')}
              </th>
              <th className="px-3 py-2 text-right">
                {t('pages.training.dialogue.avgByType.col.client', 'Avg Client')}
              </th>
              <th className="px-3 py-2 text-right">
                {t('pages.training.dialogue.avgByType.col.thirdParty', 'Avg Third Party')}
              </th>
              <th className="px-3 py-2 text-right">
                {t('pages.training.dialogue.avgByType.col.calls', '# Calls')}
              </th>
              <th className="py-2 pl-3 text-right">
                {t('pages.training.dialogue.avgByType.col.trend', 'Trend')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AggregateTableRow key={`${row.entity_id ?? 'all'}-${row.entity_name}`} row={row} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AggregateTableRow({ row }: { row: AggregateRow }) {
  return (
    <tr className="border-b border-[#F3F4F1] last:border-0">
      <td className="py-2.5 pr-3 font-medium text-[#05040D]">{row.entity_name}</td>
      <td className="px-3 py-2.5 text-right text-[#05040D] tabular-nums">
        {formatScore(row.avg_client)}
      </td>
      <td className="px-3 py-2.5 text-right text-[#05040D] tabular-nums">
        {formatScore(row.avg_third_party)}
      </td>
      <td className="px-3 py-2.5 text-right text-[#6B7280] tabular-nums">{row.calls_scored}</td>
      <td className="py-2.5 pl-3 text-right">
        <TrendBadge value={row.trend_vs_prior} />
      </td>
    </tr>
  )
}

function TrendBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-[#9CA3AF]">—</span>
  const up = value > 0
  const flat = value === 0
  const color = flat ? 'text-[#6B7280]' : up ? 'text-[#16A34A]' : 'text-[#DC2626]'
  const sign = up ? '+' : ''
  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>
      {flat ? '0' : `${sign}${value}`}
    </span>
  )
}

function formatScore(value: number | null): string {
  return value == null ? '—' : value.toFixed(1)
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[#6B7280]">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-[#EBECE8] bg-white px-2 text-xs text-[#05040D] focus:ring-1 focus:ring-[#204E4D] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default AvgScoreByTypeView
