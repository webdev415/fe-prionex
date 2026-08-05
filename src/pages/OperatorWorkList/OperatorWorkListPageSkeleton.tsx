/**
 * Loading skeleton for Priority Work List — mirrors the DataTable area
 * (debt view: 5 columns, client view: 3) so chrome stays interactive while data loads.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

export function OperatorWorkListTableSkeleton({
  columns = 5,
  rows = 8,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="w-full min-w-0" aria-busy="true" aria-live="polite" role="status">
      <span className="sr-only">Loading work list…</span>
      <TableSkeleton columns={columns} rows={rows} className="w-full" />
    </div>
  )
}

export function OperatorWorkListPageSkeleton() {
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-4 p-4 md:p-6"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading priority work list…</span>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="bg-muted h-6 w-48 max-w-full animate-pulse rounded" />
          <div className="bg-muted h-3 w-full max-w-md animate-pulse rounded" />
        </div>
        <div className="bg-muted h-9 w-full animate-pulse rounded-md sm:w-24" />
      </div>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="bg-muted h-10 w-full animate-pulse rounded-lg sm:w-44" />
        <div className="bg-muted h-11 w-full animate-pulse rounded-lg sm:w-[190px]" />
        <div className="bg-muted h-11 w-full animate-pulse rounded-lg sm:w-[160px]" />
        <div className="bg-muted ml-auto hidden h-3 w-24 animate-pulse rounded sm:block" />
      </div>

      <OperatorWorkListTableSkeleton columns={5} rows={8} />

      <div className="flex items-center justify-end gap-3">
        <div className="bg-muted h-7 w-14 animate-pulse rounded-md" />
        <div className="bg-muted h-3 w-24 animate-pulse rounded" />
        <div className="bg-muted h-7 w-14 animate-pulse rounded-md" />
      </div>
    </div>
  )
}

export default OperatorWorkListPageSkeleton
