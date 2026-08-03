/**
 * Skeleton loading for Target Actions (matches page chrome + table area).
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 5 // name, type, chains, status, actions

/** Table skeleton while refetching with placeholder data (e.g. show-hidden toggle). */
export function TargetActionsTableSectionSkeleton() {
  return (
    <div className="flex flex-col items-start gap-8 self-stretch">
      <TableSkeleton columns={TABLE_COLUMNS} rows={8} className="w-full" />
    </div>
  )
}

export function TargetActionsPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="mb-4 flex w-full flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-8 w-48 animate-pulse rounded" />
          <div className="bg-muted h-5 w-8 animate-pulse rounded" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:justify-end">
          <div className="bg-muted h-5 w-36 animate-pulse rounded" />
          <div className="bg-muted h-10 w-full animate-pulse rounded-md md:w-64" />
          <div className="bg-muted h-11 w-44 shrink-0 animate-pulse rounded-full" />
        </div>
      </div>
      <TargetActionsTableSectionSkeleton />
    </div>
  )
}

export default TargetActionsPageSkeleton
