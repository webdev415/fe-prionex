/**
 * Scoring v3 — Shadow-run monitoring (KAN-794).
 *
 * The review surface the sign-off decision is made from. Deliberately NOT gated
 * by the per-brand cutover switch: the whole point is to read these numbers
 * WHILE operators still cannot see v3. Gated by permission only.
 *
 * Answers the four questions the sign-off asks:
 *   1. Is the split sane?      -> bucket distribution + EXIT rate
 *   2. Is tau right?           -> AVG share vs the ~25% design target
 *   3. Does the model work?    -> calibration: does actual pay rate rise with predicted
 *   4. Is it stable?           -> drift vs the previous month
 *
 * Charting follows the house rules: bucket counts are ONE series so they get one
 * hue (colour here would be decoration, not encoding — the bucket name is on the
 * axis and the coloured badge lives in the table below). Calibration is two
 * series in the same unit, so one y-axis, two hues validated for colour-vision
 * deficiency (primary-700 vs information-700). Paint values are read from live
 * CSS vars so charts follow data-theme / data-accent.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PermissionGuard } from '@/components/auth'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { useConfirm } from '@/components/ui/useConfirm'
import { useHasPermission } from '@/hooks'
import { V3BucketBadge } from '@/pages/OperatorWorkList/components/V3BucketBadge'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useActiveProjectId,
  useV3Calibration,
  useV3Drift,
  useV3Monitoring,
  useV3ScoredMonths,
  useV3UiEnabled,
  useTriggerV3Scoring,
  useSetV3UiEnabled,
} from '@/features/scoring/hooks/useV3Scores'
import type { V3Bucket } from '@/features/scoring/api/types'
import { useThemeStore } from '@/stores/themeStore'
import { isDarkBase } from '@/theme/constants'
import { ScoringV3MonitoringPageSkeleton } from './ScoringV3MonitoringPageSkeleton'

// Severity order — never sorted by value, so the shape is comparable month to month.
const BUCKET_ORDER: V3Bucket[] = ['CRIT', 'HIGH', 'AVG', 'LOW', 'EXIT']

/** Read live theme CSS vars so Recharts (which needs concrete paint values) follows data-theme. */
function useChartTheme() {
  const themeKey = useThemeStore((s) => `${s.base}:${s.accent}`)
  return useMemo(() => {
    const base = themeKey.split(':')[0] as Parameters<typeof isDarkBase>[0]
    const styles = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback
    return {
      // Validated CVD pair (primary-700 vs information-700); values track accent + dark remaps.
      seriesOne: read('--color-primary-700', '#4a8308'),
      seriesTwo: read('--color-information-700', '#1d4ed8'),
      muted: read('--muted-foreground', '#adadad'),
      axis: read('--muted-foreground', '#7b7b7b'),
      grid: read('--border', '#EBECE8'),
      barStroke: read('--card', '#fcfcfb'),
      tooltipCursor: isDarkBase(base) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    }
  }, [themeKey])
}

/** tau is tuned so ~25% of workable debts land in AVG (see TAU_CAPACITY_GUIDE). */
const AVG_SHARE_TARGET = 0.25

/** Any date -> the "YYYY-MM-01" snapshot key the API is scoped by. */
function toMonthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** "2026-08-01" -> a Date at that month start in the VIEWER's timezone.
 *
 * `new Date("2026-08-01")` does NOT do this: the spec parses date-only ISO
 * strings as UTC, so anywhere west of Greenwich the result is the previous
 * evening — 2026-07-31 19:00 at UTC-5. The month picker then rendered "July
 * 2026" while the page showed August's numbers. Building from parts keeps the
 * date local, matching `toMonthStart` (which reads local getters) so a value
 * survives the round trip unchanged.
 */
function parseMonthStart(monthStart: string): Date {
  const [y, m] = monthStart.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

/** "2026-07-01" -> "July 2026" — a month label, not an ISO date. */
function monthLabel(monthStart: string): string {
  return parseMonthStart(monthStart).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(digits)}%`
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString())

function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'good' | 'warn'
}) {
  const toneClass =
    tone === 'good' ? 'text-primary-700' : tone === 'warn' ? 'text-warning-700' : 'text-foreground'
  return (
    <div className="border-border bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className={`text-2xl font-semibold break-words tabular-nums ${toneClass}`}>
        {value}
      </span>
      {hint && <span className="text-muted-foreground text-xs break-words">{hint}</span>}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-card flex w-full min-w-0 flex-col gap-3 rounded-xl border p-4 sm:p-6">
      <header className="flex min-w-0 flex-col gap-1">
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border text-muted-foreground w-full min-w-0 rounded-lg border border-dashed p-4 text-center text-sm sm:p-6">
      {children}
    </div>
  )
}

/** Horizontal scroll wrapper so wide tables/charts never blow out the page. */
function ScrollX({ children, minWidth }: { children: React.ReactNode; minWidth?: string }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <div className="w-full" style={minWidth ? { minWidth } : undefined}>
        {children}
      </div>
    </div>
  )
}

export function ScoringV3MonitoringPage() {
  const projectId = useActiveProjectId()
  const cutoverOn = useV3UiEnabled()
  // The other "Run now" button lives on the Priority Work List, whose nav entry
  // is hidden until cutover — i.e. unreachable during exactly the period when a
  // manual run is most needed. So the report carries its own.
  const canRun = useHasPermission(PERMISSIONS.SCORING_CONFIG.EDIT)
  const trigger = useTriggerV3Scoring()
  const setCutover = useSetV3UiEnabled()
  const { confirm, confirmDialog } = useConfirm()

  /** Record the client's sign-off decision. Confirmed both ways: enabling puts
   *  unvalidated-until-now priorities in front of every operator on the brand,
   *  and disabling pulls the work list out from under them mid-shift. */
  const handleCutover = async () => {
    if (!projectId) return
    const turningOn = !cutoverOn
    const ok = await confirm({
      title: turningOn ? 'Show v3 priorities to operators?' : 'Hide v3 priorities from operators?',
      message: turningOn
        ? 'Every operator on this brand will see v3 buckets instead of the old priority, and the Priority Work List becomes available. Do this only after the client has signed off on the report above. You can undo it here at any time.'
        : 'Operators go back to the old priority immediately. Scoring keeps running in the background, so no data is lost.',
      confirmLabel: turningOn ? 'Enable for operators' : 'Hide from operators',
      cancelLabel: 'Cancel',
      tone: turningOn ? 'default' : 'danger',
    })
    if (!ok) return
    setCutover.mutate({
      projectId,
      enabled: turningOn,
      reason: turningOn
        ? 'KAN-794 sign-off — cutover enabled from the shadow-run report'
        : 'KAN-794 rollback — v3 hidden from operators',
    })
  }

  // Only offer months that were actually scored — a picker full of empty months
  // reads as "the report is broken". Newest first; default to the newest.
  const { data: months = [], isLoading: monthsLoading } = useV3ScoredMonths(projectId)
  const [picked, setPicked] = useState<string | null>(null)
  // Default to the newest scored month; any month the user picks wins, even one
  // that was never scored (it shows an explicit "not scored" message).
  const month = picked ?? months[0] ?? ''
  // Drift compares against the newest scored month OLDER than the one shown
  // (months arrive newest-first), not simply "the calendar month before".
  const prevMonth = months.find((m) => m < month)

  const {
    data: summary,
    isLoading,
    isError,
  } = useV3Monitoring(projectId, month, { enabled: !!month })
  const { data: calibration } = useV3Calibration(projectId, month)
  const { data: drift } = useV3Drift(projectId, prevMonth ?? '', month, {
    enabled: !!prevMonth,
  })

  const bucketRows = useMemo(() => {
    if (!summary) return []
    return BUCKET_ORDER.map((b) => ({
      bucket: b,
      count: summary.bucket_counts?.[b] ?? 0,
      pct: summary.bucket_pct?.[b] ?? 0,
    }))
  }, [summary])

  const calibrationRows = useMemo(
    () =>
      (calibration?.bins ?? []).map((b) => ({
        bin: `D${b.bin + 1}`,
        predicted: b.predicted_mean,
        actual: b.actual_rate,
        n: b.n,
      })),
    [calibration]
  )

  // Were there any outcomes at all? A month with no recorded payments produces
  // actual_rate = 0 in every decile, and the ranking check below would then read
  // "ranking does NOT hold" — condemning the model for an absence of DATA. That
  // misreading is expensive: it is exactly the banner a reviewer would use to
  // block a sign-off. Seen for real on 2026-07, where the whole portfolio had
  // 3 qualifying payments.
  const hasOutcomes = (calibration?.actual_base_rate ?? 0) > 0

  // Does actual pay rate rise across the deciles? That is the ranking check the
  // sign-off turns on — stated in words so nobody has to interpret the chart.
  const rankingHolds = useMemo(() => {
    const bins = calibration?.bins ?? []
    if (bins.length < 3) return null
    const first = bins[0].actual_rate
    const last = bins[bins.length - 1].actual_rate
    return last > first
  }, [calibration])

  const avgShare = summary?.avg_or_higher_share ?? null
  const avgShareOff = avgShare == null ? null : Math.abs(avgShare - AVG_SHARE_TARGET) > 0.05

  const ruleRows = useMemo(
    () => Object.entries(summary?.rule_fired_counts ?? {}).sort((a, b) => b[1] - a[1]),
    [summary]
  )

  const chart = useChartTheme()
  const reportLoading = monthsLoading || (isLoading && !!month)

  return (
    <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.VIEW}>
      <div className="flex w-full min-w-0 flex-col items-stretch gap-4">
        <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-foreground text-xl font-light sm:text-2xl">
              Scoring v3 — <span className="font-semibold">shadow-run report</span>
            </h1>
            <p className="text-muted-foreground text-xs">
              Review these numbers before turning v3 on for operators.
            </p>
          </div>
          {/* The app's standard calendar (same control as Reports / Action
              Analysis) in month-year mode: a grid of months, no day cells — the
              report is monthly, so a day would be a choice with no meaning.
              NO `max`: react-datepicker disables the "next" arrow when the whole
              next period is past maxDate, which silently trapped the user in the
              current year. In this mode the year moves by the ‹ › arrows only —
              renderYearHeader prints the year as text and ignores
              showYearDropdown. Months with no snapshot say so rather than being
              hidden, so browsing ahead is harmless. */}
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
            {canRun && (
              <Button
                variant="outline"
                size="md"
                onClick={() => projectId && trigger.mutate({ projectId, asOf: month || undefined })}
                disabled={!projectId || trigger.isPending}
                className="w-full shrink-0 sm:w-auto"
              >
                {trigger.isPending ? 'Starting…' : 'Run now'}
              </Button>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <span className="text-muted-foreground shrink-0 text-sm">Month</span>
              <DateSelect
                value={month ? parseMonthStart(month) : null}
                onChange={({ value }) => setPicked(value ? toMonthStart(value) : null)}
                showMonthYearPicker
                format="MMMM yyyy"
                placeholder="Select month"
                className="min-w-0 flex-1 sm:w-[190px] sm:flex-none [&_input]:h-10 [&_input]:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Status + the cutover switch. KAN-794's decision is a human one — the
            client approves or does not — and this is where that decision is
            recorded into the system, audited with who flipped it and why. */}
        <div
          className={`flex w-full min-w-0 flex-col gap-3 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
            cutoverOn
              ? 'border-primary-600 bg-primary/10 text-primary-700'
              : 'border-warning-500 bg-warning-50 text-warning-700'
          }`}
        >
          <span className="min-w-0 leading-relaxed">
            {cutoverOn
              ? 'Live — operators are seeing v3 priorities for this brand.'
              : 'Shadow run — scores are being calculated and stored, but operators do NOT see them yet.'}
          </span>
          {canRun && (
            <Button
              variant={cutoverOn ? 'outline' : 'primary'}
              size="sm"
              disabled={setCutover.isPending || !projectId}
              onClick={handleCutover}
              className="w-full shrink-0 sm:w-auto"
            >
              {setCutover.isPending
                ? 'Saving…'
                : cutoverOn
                  ? 'Hide from operators'
                  : 'Enable for operators'}
            </Button>
          )}
        </div>
        {confirmDialog}

        {reportLoading && <ScoringV3MonitoringPageSkeleton />}
        {!reportLoading && isError && (
          <Empty>Could not load the report. Is the scoring service running?</Empty>
        )}

        {!reportLoading && months.length === 0 && (
          <Empty>
            Nothing scored yet for this brand. The v3 job runs on the 1st of each month — once it
            has run, the results appear here.
          </Empty>
        )}

        {!reportLoading && month && months.length > 0 && !months.includes(month) && (
          <Empty>
            {monthLabel(month)} was never scored. Months with data:{' '}
            {months.map(monthLabel).join(', ')}.
          </Empty>
        )}

        {!reportLoading && summary && summary.total === 0 && months.includes(month) && (
          <Empty>
            No debts scored for {monthLabel(month)} yet. The job runs on the 1st of each month, or
            can be started manually.
          </Empty>
        )}

        {!reportLoading && summary && summary.total > 0 && (
          <>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Debts scored" value={num(summary.total)} hint={monthLabel(month)} />
              <StatTile
                label="Worth calling (AVG or higher)"
                value={pct(avgShare)}
                hint={`target ≈ ${pct(AVG_SHARE_TARGET, 0)} — set by tau`}
                tone={avgShareOff ? 'warn' : 'good'}
              />
              <StatTile
                label="Excluded (EXIT)"
                value={pct(summary.exit_rate)}
                hint="dead / closed / paid / legal"
              />
              <StatTile
                label="Average pay chance"
                value={pct(summary.hazard_mean, 2)}
                hint={`top 10% ≈ ${pct(summary.hazard_p90, 2)}`}
              />
            </div>

            {avgShareOff && (
              <div className="border-warning-500 bg-warning-50 text-warning-800 w-full min-w-0 rounded-xl border px-4 py-3 text-sm leading-relaxed">
                The AVG share is off target. tau is the knob that moves it —{' '}
                <Link
                  to="/dashboard/system-settings/scoring-v3-settings"
                  className="font-medium underline"
                >
                  adjust it in v3 scoring settings
                </Link>
                . The change applies on the next scoring run.
              </div>
            )}

            <Panel
              title="How debts were split"
              subtitle="Ordered by urgency. Compare the shape month to month — one bucket holding almost everything is a problem."
            >
              <div className="h-[220px] w-full min-w-0 sm:h-[260px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart
                    data={bucketRows}
                    layout="vertical"
                    margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke={chart.grid} />
                    <XAxis
                      type="number"
                      tick={{ fill: chart.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="bucket"
                      width={48}
                      tick={{ fill: chart.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: chart.tooltipCursor }}
                      formatter={(v: number, _n, p) => [
                        `${v.toLocaleString()} debts (${pct(p.payload.pct)})`,
                        'Count',
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                      {bucketRows.map((r) => (
                        // EXIT is not a severity step — muted so it reads as "set aside".
                        <Cell
                          key={r.bucket}
                          fill={r.bucket === 'EXIT' ? chart.muted : chart.seriesOne}
                          stroke={chart.barStroke}
                          strokeWidth={2}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ScrollX minWidth="28rem">
                <table className="text-foreground w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left text-xs">
                      <th className="py-2 pr-3 font-medium">Bucket</th>
                      <th className="py-2 pr-3 font-medium">Meaning</th>
                      <th className="py-2 pl-3 text-right font-medium">Debts</th>
                      <th className="py-2 pl-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bucketRows.map((r) => (
                      <tr key={r.bucket} className="border-border border-t">
                        <td className="py-2 pr-3">
                          <V3BucketBadge bucket={r.bucket} />
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {r.bucket === 'CRIT' && 'Call today'}
                          {r.bucket === 'HIGH' && 'Call this week'}
                          {r.bucket === 'AVG' && 'Normal cadence'}
                          {r.bucket === 'LOW' && 'Only with spare capacity'}
                          {r.bucket === 'EXIT' && 'Do not call'}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums">{num(r.count)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{pct(r.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            </Panel>

            <Panel
              title="Does the model actually predict payment?"
              subtitle="Debts split into ten groups by predicted pay chance. The bars on the right should be taller than the bars on the left — that means the model ranks payers correctly."
            >
              {calibrationRows.length === 0 ? (
                <Empty>
                  Not available yet. This needs the scored month to have finished so real payments
                  can be compared against the prediction.
                </Empty>
              ) : (
                <>
                  <div
                    className={`rounded-lg border p-3 text-sm leading-relaxed ${
                      !hasOutcomes
                        ? 'border-border bg-muted text-muted-foreground'
                        : rankingHolds
                          ? 'border-primary-600 bg-primary/10 text-primary-700'
                          : 'border-warning-500 bg-warning-50 text-warning-700'
                    }`}
                  >
                    {!hasOutcomes ? (
                      'Not measurable for this month — no payments were recorded against these debts, so there is nothing to compare the prediction with. This says nothing about the model; pick a month with payment activity.'
                    ) : (
                      <>
                        {rankingHolds
                          ? 'Ranking holds — debts predicted more likely to pay did pay more often.'
                          : 'Ranking does NOT hold — this blocks sign-off. Investigate before cutover.'}
                        {calibration?.calibration_error != null && (
                          <>
                            {' '}
                            Average gap between predicted and actual:{' '}
                            {pct(calibration.calibration_error, 2)}.
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <ScrollX minWidth="32rem">
                    <div className="h-[240px] w-full min-w-0 sm:h-[280px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart
                          data={calibrationRows}
                          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                        >
                          <CartesianGrid vertical={false} stroke={chart.grid} />
                          <XAxis
                            dataKey="bin"
                            tick={{ fill: chart.axis, fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            width={48}
                            tickFormatter={(v: number) => `${(v * 100).toFixed(1)}%`}
                            tick={{ fill: chart.axis, fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: chart.tooltipCursor }}
                            formatter={(v: number, name) => [pct(v, 2), name]}
                          />
                          <Legend wrapperStyle={{ fontSize: 12, color: chart.axis }} />
                          <Bar
                            dataKey="predicted"
                            name="Predicted"
                            fill={chart.seriesTwo}
                            radius={[4, 4, 0, 0]}
                            stroke={chart.barStroke}
                            strokeWidth={2}
                          />
                          <Bar
                            dataKey="actual"
                            name="Actually paid"
                            fill={chart.seriesOne}
                            radius={[4, 4, 0, 0]}
                            stroke={chart.barStroke}
                            strokeWidth={2}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ScrollX>
                  <ScrollX minWidth="24rem">
                    <table className="text-foreground w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground text-left text-xs">
                          <th className="py-2 pr-3 font-medium">Group</th>
                          <th className="py-2 pl-3 text-right font-medium">Debts</th>
                          <th className="py-2 pl-3 text-right font-medium">Predicted</th>
                          <th className="py-2 pl-3 text-right font-medium">Actually paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calibrationRows.map((r) => (
                          <tr key={r.bin} className="border-border border-t">
                            <td className="py-2 pr-3">{r.bin}</td>
                            <td className="py-2 pl-3 text-right tabular-nums">{num(r.n)}</td>
                            <td className="py-2 pl-3 text-right tabular-nums">
                              {pct(r.predicted, 2)}
                            </td>
                            <td className="py-2 pl-3 text-right tabular-nums">
                              {pct(r.actual, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollX>
                </>
              )}
            </Panel>

            <Panel
              title="Why each debt got its priority"
              subtitle="Which rule decided. A healthy mix has most debts decided by the model (ml_low / ml_avg) and a minority by events."
            >
              <ScrollX minWidth="22rem">
                <table className="text-foreground w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left text-xs">
                      <th className="py-2 pr-3 font-medium">Rule</th>
                      <th className="py-2 pl-3 text-right font-medium">Debts</th>
                      <th className="py-2 pl-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ruleRows.map(([rule, count]) => (
                      <tr key={rule} className="border-border border-t">
                        <td className="py-2 pr-3 font-mono text-xs break-all">{rule}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{num(count)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">
                          {pct(summary.total ? count / summary.total : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            </Panel>

            <Panel
              title="Change since last month"
              subtitle="Big swings without a business reason are a warning sign."
            >
              {!drift ? (
                <Empty>
                  Needs two scored months. Available once{' '}
                  {prevMonth ? monthLabel(prevMonth) : 'an earlier month'} and {monthLabel(month)}{' '}
                  both have data.
                </Empty>
              ) : (
                <ScrollX minWidth="20rem">
                  <table className="text-foreground w-full text-sm">
                    <tbody>
                      <tr className="border-border border-t">
                        <td className="text-muted-foreground py-2 pr-3">Debts scored</td>
                        <td className="py-2 pl-3 text-right tabular-nums">
                          {drift.deltas.total_delta >= 0 ? '+' : ''}
                          {num(drift.deltas.total_delta)}
                        </td>
                      </tr>
                      <tr className="border-border border-t">
                        <td className="text-muted-foreground py-2 pr-3">
                          Worth calling (AVG or higher)
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums">
                          {drift.deltas.avg_or_higher_share_delta >= 0 ? '+' : ''}
                          {pct(drift.deltas.avg_or_higher_share_delta)}
                        </td>
                      </tr>
                      <tr className="border-border border-t">
                        <td className="text-muted-foreground py-2 pr-3">Excluded (EXIT)</td>
                        <td className="py-2 pl-3 text-right tabular-nums">
                          {drift.deltas.exit_rate_delta >= 0 ? '+' : ''}
                          {pct(drift.deltas.exit_rate_delta)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </ScrollX>
              )}
            </Panel>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}
