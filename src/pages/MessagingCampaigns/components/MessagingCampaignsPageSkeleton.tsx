/**
 * Table + pagination skeleton for Campaign Analytics while the list loads.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 10

export function MessagingCampaignsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <>
      <TableSkeleton columns={TABLE_COLUMNS} rows={rows} className="w-full" />
      <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="bg-muted h-5 w-48 animate-pulse rounded" />
        <div className="flex items-center gap-2">
          <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-muted h-10 w-10 animate-pulse rounded-full" />
          ))}
          <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
        </div>
      </div>
    </>
  )
}

export default MessagingCampaignsTableSkeleton
