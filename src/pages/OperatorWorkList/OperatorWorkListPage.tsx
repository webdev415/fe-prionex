/**
 * Operator Work List (Scoring v3 / KAN-791).
 *
 * Shows a brand's debts ranked by the v3 priority model — "call first" at the
 * top — with the bucket, the pay-probability, and the deciding rule ("why").
 * EXIT (do-not-call) debts are hidden by default.
 *
 * Ordering is server-side (KAN-790): bucket SEVERITY first (CRIT → HIGH → AVG →
 * LOW), then priority_dollar (hazard × principal) within the bucket. Sorting by
 * priority_dollar alone put the biggest balances on top regardless of urgency —
 * on the real portfolio that filled the first page with AVG debts while the
 * CRIT ones sat further down. Do not re-sort client-side; the page is only one
 * slice of the ordered result.
 *
 * This screen previews the v3 output during the shadow-run; it is gated behind a
 * permission and (in the nav) a feature flag until the model is signed off.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import {
  useTriggerV3Scoring,
  useV3ClientOrder,
  useV3Scores,
} from '@/features/scoring/hooks/useV3Scores'
import type { V3Bucket, V3ClientRollup, V3ScoreResult } from '@/features/scoring/api/types'
import { V3BucketBadge } from './components/V3BucketBadge'
import { exitReasonLabel } from '@/features/scoring/lib/exitReason'
import { OperatorWorkListTableSkeleton } from './OperatorWorkListPageSkeleton'
import { uiDecimal, uiLocale } from '@/lib/formatters'

const PAGE_SIZE = 50

const BUCKET_FILTERS: { value: 'ALL' | V3Bucket; labelKey: string }[] = [
  { value: 'ALL', labelKey: 'pages.scoringV3.workList.filters.ALL' },
  { value: 'CRIT', labelKey: 'pages.scoringV3.buckets.CRIT' },
  { value: 'HIGH', labelKey: 'pages.scoringV3.buckets.HIGH' },
  { value: 'AVG', labelKey: 'pages.scoringV3.buckets.AVG' },
  { value: 'LOW', labelKey: 'pages.scoringV3.buckets.LOW' },
  { value: 'EXIT', labelKey: 'pages.scoringV3.workList.filters.EXIT' },
]

type Row = V3ScoreResult & { id: number }

function currentMonth(): string {
  // Local getters, NOT toISOString(): that converts to UTC first, so west of
  // Greenwich the last evening of a month reports the NEXT month — at UTC-5,
  // 31 Aug 20:30 local becomes "2026-09". The operator's queue would empty out
  // for the rest of that evening because nothing is scored for a month that has
  // not started yet.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
}

/** Debounce a value so a query fires only after the user stops typing. */
function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function fmtMoney(v: number | null): string {
  return v == null ? '—' : Math.round(v).toLocaleString(uiLocale())
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${uiDecimal((v * 100).toFixed(2))}%`
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`text-foreground flex min-w-0 flex-col gap-1.5 text-xs font-medium sm:flex-row sm:items-center sm:gap-2 ${className ?? ''}`}
    >
      <span className="shrink-0">{label}</span>
      {children}
    </div>
  )
}

export function OperatorWorkListPage() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectId = activeProjectId ? Number(activeProjectId) : undefined

  const [view, setView] = useState<'debt' | 'client'>('debt')
  const [month, setMonth] = useState<string>(currentMonth)
  const [bucket, setBucket] = useState<'ALL' | V3Bucket>('ALL')
  const [debtId, setDebtId] = useState('')
  const [minPct, setMinPct] = useState('')
  const [page, setPage] = useState(0)
  const trigger = useTriggerV3Scoring()

  const monthStart = `${month}-01`
  const dDebtId = useDebounced(debtId)
  const dMinPct = useDebounced(minPct)
  const debtIdNum = dDebtId.trim() && !isNaN(Number(dDebtId)) ? Number(dDebtId) : undefined
  const minHazard = dMinPct.trim() && !isNaN(Number(dMinPct)) ? Number(dMinPct) / 100 : undefined

  // "By debt" (default) and "By client" share the month + pagination.
  const debtQuery = useV3Scores(
    projectId,
    {
      month_start: monthStart,
      ...(debtIdNum
        ? { debt_id: debtIdNum }
        : bucket === 'ALL'
          ? { include_exit: false }
          : { bucket }),
      ...(minHazard !== undefined && !debtIdNum ? { min_hazard: minHazard } : {}),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { enabled: view === 'debt' }
  )
  const clientQuery = useV3ClientOrder(projectId, monthStart, page, PAGE_SIZE, {
    enabled: view === 'client',
  })

  const data = debtQuery.data
  const isLoading = view === 'client' ? clientQuery.isLoading : debtQuery.isLoading
  const isError = view === 'client' ? clientQuery.isError : debtQuery.isError

  const rows: Row[] = useMemo(
    () => (data?.results ?? []).map((r) => ({ ...r, id: r.debt_id })),
    [data]
  )
  const clientRows: (V3ClientRollup & { id: number })[] = useMemo(
    () => (clientQuery.data?.results ?? []).map((r) => ({ ...r, id: r.client_id })),
    [clientQuery.data]
  )
  const total = view === 'client' ? (clientQuery.data?.total ?? 0) : (data?.total ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns: Column<Row>[] = [
    {
      key: 'bucket_v3',
      header: t('pages.scoringV3.workList.priority'),
      render: (r) => <V3BucketBadge bucket={r.bucket_v3} />,
    },
    { key: 'debt_id', header: t('pages.scoringV3.workList.debtId') },
    {
      key: 'priority_dollar',
      header: t('pages.scoringV3.workList.priorityValue'),
      align: 'right',
      render: (r) => fmtMoney(r.priority_dollar),
    },
    {
      key: 'hazard',
      header: t('pages.scoringV3.workList.payChance'),
      align: 'right',
      render: (r) => fmtPct(r.hazard),
    },
    {
      key: 'rule_fired',
      header: t('pages.scoringV3.workList.why'),
      // EXIT rows get the compliance ground, not the generic "terminal".
      render: (r) => (
        <span className="text-muted-foreground">
          {r.bucket_v3 === 'EXIT' ? exitReasonLabel(r.exit_reason) : (r.rule_fired ?? '—')}
        </span>
      ),
    },
  ]

  const clientColumns: Column<V3ClientRollup & { id: number }>[] = [
    {
      key: 'bucket_v3',
      header: t('pages.scoringV3.workList.priority'),
      render: (r) => <V3BucketBadge bucket={r.bucket_v3} />,
    },
    {
      key: 'client_id',
      header: t('pages.scoringV3.workList.client'),
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-information-700 hover:underline"
        >
          {t('pages.scoringV3.workList.clientLink', { id: r.client_id })}
        </Link>
      ),
    },
    {
      key: 'priority_dollar',
      header: t('pages.scoringV3.workList.priorityValue'),
      align: 'right',
      render: (r) => fmtMoney(r.priority_dollar),
    },
  ]

  const resetPage = () => setPage(0)

  const fieldInput =
    'h-[45px] w-full rounded-lg border border-input-border bg-input px-3 text-sm font-light text-foreground outline-none placeholder:text-muted-foreground sm:w-auto'

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 p-4 md:p-6">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-foreground text-lg font-semibold sm:text-xl">
            {t('navigation.operatorWorkList')}
          </h1>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {view === 'client'
              ? t('pages.scoringV3.workList.subtitleClients')
              : t('pages.scoringV3.workList.subtitleDebts')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => projectId && trigger.mutate({ projectId, asOf: monthStart })}
          disabled={!projectId || trigger.isPending}
          className="bg-primary-600 text-primary-foreground hover:bg-primary-700 w-full shrink-0 rounded-md px-4 py-2 text-xs font-medium disabled:opacity-50 sm:w-auto"
        >
          {trigger.isPending ? t('pages.scoringV3.starting') : t('pages.scoringV3.runNow')}
        </button>
      </div>

      {/* Controls */}
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <div className="border-border flex w-full items-center gap-0.5 rounded-lg border p-0.5 text-xs font-medium sm:w-auto">
          {(['debt', 'client'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v)
                resetPage()
              }}
              className={
                view === v
                  ? 'bg-primary-600 text-primary-foreground min-w-0 flex-1 rounded-md px-3 py-1.5 sm:flex-none'
                  : 'text-muted-foreground hover:bg-muted min-w-0 flex-1 rounded-md px-3 py-1.5 sm:flex-none'
              }
            >
              {v === 'debt'
                ? t('pages.scoringV3.workList.byDebt')
                : t('pages.scoringV3.workList.byClient')}
            </button>
          ))}
        </div>

        <FilterField label={t('pages.scoringV3.month')} className="w-full sm:w-auto">
          <div className="w-full min-w-0 sm:w-[190px]">
            <DateSelect
              showMonthYearPicker
              format="MMMM yyyy"
              value={`${month}-01`}
              onChange={({ value }) => {
                if (!value) return
                const v = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
                setMonth(v)
                resetPage()
              }}
            />
          </div>
        </FilterField>

        {view === 'debt' && (
          <>
            <FilterField
              label={t('pages.scoringV3.workList.priority')}
              className="w-full sm:w-auto"
            >
              <div className="w-full min-w-0 sm:w-[160px]">
                <Select
                  value={bucket}
                  onValueChange={(v) => {
                    setBucket(v as 'ALL' | V3Bucket)
                    resetPage()
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUCKET_FILTERS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {t(b.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FilterField>

            <FilterField label={t('pages.scoringV3.workList.debtId')} className="w-full sm:w-auto">
              <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t('pages.scoringV3.workList.searchPlaceholder')}
                  value={debtId}
                  onChange={(e) => {
                    setDebtId(e.target.value.replace(/[^0-9]/g, ''))
                    resetPage()
                  }}
                  className={`${fieldInput} sm:w-[140px]`}
                />
                {debtId && (
                  <button
                    type="button"
                    onClick={() => {
                      setDebtId('')
                      resetPage()
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    aria-label={t('pages.scoringV3.workList.clearDebtId')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </FilterField>

            <FilterField
              label={t('pages.scoringV3.workList.minPayChance')}
              className="w-full sm:w-auto"
            >
              <div className="flex w-full items-center gap-1 sm:w-auto">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={minPct}
                  onChange={(e) => {
                    setMinPct(e.target.value.replace(/[^0-9.]/g, ''))
                    resetPage()
                  }}
                  className={`${fieldInput} sm:w-[80px]`}
                />
                <span className="text-muted-foreground shrink-0">%</span>
              </div>
            </FilterField>
          </>
        )}

        <span className="text-muted-foreground w-full text-xs sm:ml-auto sm:w-auto sm:text-right">
          {t(
            view === 'client'
              ? 'pages.scoringV3.workList.totalClients'
              : 'pages.scoringV3.workList.totalDebts',
            {
              count: total,
              formatted: total.toLocaleString(uiLocale()),
            }
          )}
        </span>
      </div>

      {isError ? (
        <div className="border-error-600 bg-error-50 text-error-700 w-full min-w-0 rounded-xl border px-4 py-3 text-xs leading-relaxed">
          {t('pages.scoringV3.workList.loadError')}
        </div>
      ) : isLoading ? (
        <OperatorWorkListTableSkeleton columns={view === 'client' ? 3 : 5} />
      ) : view === 'client' ? (
        <div className="w-full min-w-0">
          <DataTable
            columns={clientColumns}
            data={clientRows}
            emptyMessage={t('pages.scoringV3.workList.emptyClients')}
          />
        </div>
      ) : (
        <div className="w-full min-w-0">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage={
              debtIdNum
                ? t('pages.scoringV3.workList.emptyDebtId', { id: debtIdNum })
                : t('pages.scoringV3.workList.emptyFiltered')
            }
          />
        </div>
      )}

      {/* Pagination */}
      <div className="flex w-full min-w-0 items-center justify-between gap-2 text-xs sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || isLoading}
          className="border-border text-foreground hover:bg-muted min-w-0 flex-1 rounded-md border px-3 py-2 disabled:opacity-40 sm:flex-none sm:py-1"
        >
          {t('pages.scoringV3.workList.prev')}
        </button>
        <span className="text-muted-foreground shrink-0 px-1 tabular-nums">
          {t('pages.scoringV3.workList.pageOf', { page: page + 1, total: pageCount })}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => (p + 1 < pageCount ? p + 1 : p))}
          disabled={page + 1 >= pageCount || isLoading}
          className="border-border text-foreground hover:bg-muted min-w-0 flex-1 rounded-md border px-3 py-2 disabled:opacity-40 sm:flex-none sm:py-1"
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  )
}

export default OperatorWorkListPage
