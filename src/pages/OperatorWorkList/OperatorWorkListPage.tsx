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

const PAGE_SIZE = 50

const BUCKET_FILTERS: { value: 'ALL' | V3Bucket; label: string }[] = [
  { value: 'ALL', label: 'All active' },
  { value: 'CRIT', label: 'Call first' },
  { value: 'HIGH', label: 'High' },
  { value: 'AVG', label: 'Average' },
  { value: 'LOW', label: 'Low' },
  { value: 'EXIT', label: 'Do-not-call' },
]

type Row = V3ScoreResult & { id: number }

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
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
  return v == null ? '—' : Math.round(v).toLocaleString()
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(2)}%`
}

export function OperatorWorkListPage() {
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
      header: 'Priority',
      render: (r) => <V3BucketBadge bucket={r.bucket_v3} />,
    },
    { key: 'debt_id', header: 'Debt ID' },
    {
      key: 'priority_dollar',
      header: 'Priority value',
      align: 'right',
      render: (r) => fmtMoney(r.priority_dollar),
    },
    {
      key: 'hazard',
      header: 'Pay chance',
      align: 'right',
      render: (r) => fmtPct(r.hazard),
    },
    {
      key: 'rule_fired',
      header: 'Why',
      render: (r) => <span className="text-gray-600">{r.rule_fired ?? '—'}</span>,
    },
  ]

  const clientColumns: Column<V3ClientRollup & { id: number }>[] = [
    {
      key: 'bucket_v3',
      header: 'Priority',
      render: (r) => <V3BucketBadge bucket={r.bucket_v3} />,
    },
    {
      key: 'client_id',
      header: 'Client',
      render: (r) => (
        <Link
          to={`/dashboard/clients/${r.client_id}`}
          className="text-information-600 hover:underline"
        >
          Client {r.client_id}
        </Link>
      ),
    },
    {
      key: 'priority_dollar',
      header: 'Priority value',
      align: 'right',
      render: (r) => fmtMoney(r.priority_dollar),
    },
  ]

  const resetPage = () => setPage(0)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-[#05040D]">Priority Work List</h1>
          <p className="text-xs text-gray-500">
            {view === 'client' ? 'Clients' : 'Debts'} ranked by the v3 model — call the top of the
            list first. Shadow-run preview.
          </p>
        </div>
        <button
          type="button"
          onClick={() => projectId && trigger.mutate({ projectId, asOf: monthStart })}
          disabled={!projectId || trigger.isPending}
          className="bg-primary-600 hover:bg-primary-700 shrink-0 rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {trigger.isPending ? 'Starting…' : 'Run now'}
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-0.5 rounded-lg border border-gray-300 p-0.5 text-xs font-medium">
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
                  ? 'bg-primary-600 rounded-md px-3 py-1.5 text-white'
                  : 'rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100'
              }
            >
              {v === 'debt' ? 'By debt' : 'By client'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
          Month
          <div className="w-[190px]">
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
        </div>
        {view === 'debt' && (
          <>
            <div className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
              Priority
              <div className="w-[160px]">
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
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
              Debt ID
              <input
                type="text"
                inputMode="numeric"
                placeholder="Search…"
                value={debtId}
                onChange={(e) => {
                  setDebtId(e.target.value.replace(/[^0-9]/g, ''))
                  resetPage()
                }}
                className="h-[45px] w-[140px] rounded-lg border border-gray-400 bg-white px-3 text-sm font-light text-[#05040D] outline-none placeholder:text-gray-400"
              />
              {debtId && (
                <button
                  type="button"
                  onClick={() => {
                    setDebtId('')
                    resetPage()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Clear debt ID"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
              Min pay-chance
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={minPct}
                  onChange={(e) => {
                    setMinPct(e.target.value.replace(/[^0-9.]/g, ''))
                    resetPage()
                  }}
                  className="h-[45px] w-[80px] rounded-lg border border-gray-400 bg-white px-3 text-sm font-light text-[#05040D] outline-none placeholder:text-gray-400"
                />
                <span className="text-gray-500">%</span>
              </div>
            </div>
          </>
        )}
        <span className="ml-auto text-xs text-gray-500">
          {total.toLocaleString()} {view === 'client' ? 'clients' : 'debts'}
        </span>
      </div>

      {isError ? (
        <div className="border-error-600 text-error-600 rounded-xl border bg-[#FCEAEA] px-4 py-3 text-xs">
          Could not load the work list. The scoring service may be unavailable.
        </div>
      ) : view === 'client' ? (
        <DataTable
          columns={clientColumns}
          data={clientRows}
          emptyMessage={isLoading ? 'Loading…' : 'No scored clients for this month yet.'}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={
            isLoading
              ? 'Loading…'
              : debtIdNum
                ? `No debt with ID ${debtIdNum} in this month.`
                : 'No scored debts match these filters.'
          }
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-end gap-3 text-xs">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-md border border-[#EBECE8] px-3 py-1 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-gray-500">
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => (p + 1 < pageCount ? p + 1 : p))}
          disabled={page + 1 >= pageCount}
          className="rounded-md border border-[#EBECE8] px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default OperatorWorkListPage
