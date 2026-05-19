/**
 * ScoreDynamicsChart — operator score-over-time line chart (KAN-410, Feature 2.4).
 *
 * Recharts line chart with:
 * - Operator line (primary)
 * - Team-average line (faded, dashed) so the trainer can compare at a glance
 * - Reference dots clickable to open the underlying scorecard (TODO follow-up)
 *
 * The component is a pure presentation layer — data comes from `useOperatorDynamics`.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DynamicsResponse } from '../types'

interface ScoreDynamicsChartProps {
  data: DynamicsResponse
  onPointClick?: (scorecardIds: number[]) => void
}

interface ChartRow {
  bucket_start: string
  bucket_label: string
  operator: number | null
  team: number | null
  count: number
  scorecard_ids: number[]
}

export function ScoreDynamicsChart({ data, onPointClick }: ScoreDynamicsChartProps) {
  const { t } = useTranslation('common')

  const rows: ChartRow[] = useMemo(() => {
    const byBucket = new Map<string, ChartRow>()
    for (const p of data.points) {
      byBucket.set(p.bucket_start, {
        bucket_start: p.bucket_start,
        bucket_label: formatBucket(p.bucket_start, data.granularity),
        operator: p.avg_score,
        team: null,
        count: p.scorecard_count,
        scorecard_ids: p.scorecard_ids,
      })
    }
    for (const t of data.team_benchmark) {
      const row = byBucket.get(t.bucket_start)
      if (row) {
        row.team = t.team_avg_score
      } else {
        byBucket.set(t.bucket_start, {
          bucket_start: t.bucket_start,
          bucket_label: formatBucket(t.bucket_start, data.granularity),
          operator: null,
          team: t.team_avg_score,
          count: 0,
          scorecard_ids: [],
        })
      }
    }
    return Array.from(byBucket.values()).sort((a, b) =>
      a.bucket_start.localeCompare(b.bucket_start)
    )
  }, [data])

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
        {t('pages.actionAnalysis.dynamics.empty', 'No completed scorecards in this range.')}
      </div>
    )
  }

  return (
    <div className="h-72 w-full rounded-xl bg-white p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
          onClick={(state) => {
            if (!onPointClick) return
            // Recharts surfaces `activePayload` on click. Cast loosely since
            // the typed surface for chart-level click is partial.
            const payload = (state as { activePayload?: Array<{ payload: ChartRow }> })
              .activePayload?.[0]?.payload
            if (payload && payload.scorecard_ids.length > 0) {
              onPointClick(payload.scorecard_ids)
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="bucket_label" stroke="#6b7280" fontSize={12} />
          <YAxis domain={[0, 5]} stroke="#6b7280" fontSize={12} />
          <Tooltip formatter={(v: number | null) => (v == null ? '—' : v.toFixed(2))} />
          <Legend />
          {data.period_avg != null ? (
            <ReferenceLine
              y={Number(data.period_avg)}
              stroke="#94a3b8"
              strokeDasharray="2 4"
              label={{
                value: t('pages.actionAnalysis.dynamics.periodAvg', 'Period avg'),
                position: 'insideTopLeft',
                fontSize: 10,
                fill: '#64748b',
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="operator"
            name={t('pages.actionAnalysis.dynamics.operator', 'Operator')}
            stroke="#0ea5e9"
            strokeWidth={2}
            connectNulls
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="team"
            name={t('pages.actionAnalysis.dynamics.teamAvg', 'Team average')}
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            connectNulls
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatBucket(iso: string, granularity: string): string {
  // The backend already sends YYYY-MM-DD for the bucket start. For week /
  // month granularity we keep the start date as the label — adding format
  // logic per locale here would duplicate the i18next plumbing for a chart
  // axis. Good enough for v1.
  if (granularity === 'month') return iso.slice(0, 7) // YYYY-MM
  return iso
}
