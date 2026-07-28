/**
 * Operator Work List (Scoring v3 / KAN-791).
 *
 * Shows a brand's debts ranked by the v3 priority model — "call first" at the
 * top — with the bucket, the pay-probability, and the deciding rule ("why").
 * EXIT (do-not-call) debts are hidden by default. Sorted server-side by
 * priority_dollar (hazard × principal).
 *
 * This screen previews the v3 output during the shadow-run; it is gated behind a
 * permission and (in the nav) a feature flag until the model is signed off.
 */

import { useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { useV3Scores } from '@/features/scoring/hooks/useV3Scores'
import type { V3ScoreResult } from '@/features/scoring/api/types'
import { V3BucketBadge } from './components/V3BucketBadge'

const PAGE_SIZE = 50

type Row = V3ScoreResult & { id: number }

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
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

  const [month, setMonth] = useState<string>(currentMonth)
  const [includeExit, setIncludeExit] = useState(false)
  const [page, setPage] = useState(0)

  const monthStart = `${month}-01`
  const { data, isLoading, isError } = useV3Scores(projectId, {
    month_start: monthStart,
    include_exit: includeExit,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })

  const rows: Row[] = useMemo(
    () => (data?.results ?? []).map((r) => ({ ...r, id: r.debt_id })),
    [data]
  )
  const total = data?.total ?? 0
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

  const resetPage = () => setPage(0)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-[#05040D]">Priority Work List</h1>
        <p className="text-xs text-gray-500">
          Debts ranked by the v3 model — call the top of the list first. Shadow-run preview.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              resetPage()
            }}
            className="rounded-md border border-[#EBECE8] px-2 py-1 text-xs"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-[#05040D]">
          <input
            type="checkbox"
            checked={includeExit}
            onChange={(e) => {
              setIncludeExit(e.target.checked)
              resetPage()
            }}
          />
          Show do-not-call (EXIT)
        </label>
        <span className="ml-auto text-xs text-gray-500">{total.toLocaleString()} debts</span>
      </div>

      {isError ? (
        <div className="border-error-600 text-error-600 rounded-xl border bg-[#FCEAEA] px-4 py-3 text-xs">
          Could not load the work list. The scoring service may be unavailable.
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={isLoading ? 'Loading…' : 'No scored debts for this month yet.'}
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
