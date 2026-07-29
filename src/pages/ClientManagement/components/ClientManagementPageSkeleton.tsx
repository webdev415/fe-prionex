/**
 * ClientManagementPageSkeleton Component
 *
 * Full page skeleton for the client management page.
 * Includes priority cards, list header, table skeleton, and pagination skeleton.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const ITEMS_PER_PAGE = 10
const TABLE_COLUMNS = 12 // id, fullName, taxIdNumber, tags, phoneNumber, dateOfSale, creditor, debt, amountOfDebt, priority, score, actions

export function ClientManagementPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-3 px-2 sm:gap-4 sm:px-0">
      {/* Priority Cards Skeleton */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="border-border bg-card/50 flex min-w-0 flex-1 flex-col items-start gap-3 rounded-xl border p-4 sm:gap-4 sm:p-5 xl:p-6"
          >
            {/* Badge and Title */}
            <div className="flex w-full min-w-0 items-start gap-2 sm:gap-3">
              <div className="bg-muted-foreground/25 h-[20px] w-full shrink-0 animate-pulse rounded-[16px] sm:h-[25px]" />
              <div className="bg-muted-foreground/25 h-5 min-w-0 flex-1 animate-pulse rounded sm:h-6" />
            </div>

            {/* Stats */}
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:justify-between sm:gap-0">
              <div className="flex min-w-0 flex-row items-start gap-1">
                <div className="bg-muted-foreground/25 h-4 w-12 shrink-0 animate-pulse rounded sm:h-5 sm:w-16" />
                <div className="bg-muted-foreground/25 h-4 min-w-[3.5rem] flex-1 animate-pulse rounded sm:h-5 sm:min-w-[4rem]" />
              </div>
              <div className="flex min-w-0 flex-row items-start gap-1">
                <div className="bg-muted-foreground/25 h-4 w-10 shrink-0 animate-pulse rounded sm:h-5 sm:w-12" />
                <div className="bg-muted-foreground/25 h-4 min-w-[1.5rem] flex-1 animate-pulse rounded sm:h-5 sm:min-w-[2rem]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* List Header Skeleton */}
      <div className="flex w-full flex-col gap-3 self-stretch sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <div className="bg-muted-foreground/25 h-6 w-32 animate-pulse rounded sm:h-8 sm:w-40" />
            <div className="bg-muted-foreground/25 h-5 w-10 animate-pulse rounded sm:h-6 sm:w-12" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end sm:gap-5">
          <div className="bg-muted-foreground/25 h-9 w-24 animate-pulse rounded-full sm:h-10 sm:w-32" />
          <div className="border-border bg-card/50 h-10 w-32 animate-pulse rounded-lg border sm:h-12 sm:w-40" />
        </div>
      </div>

      {/* Table Skeleton with Bulk Selection */}
      <div className="flex w-full flex-col items-start gap-4 self-stretch sm:gap-8">
        <TableSkeleton
          columns={TABLE_COLUMNS}
          rows={ITEMS_PER_PAGE}
          className="w-full"
          enableBulkSelection
          showBulkHeader
        />
      </div>

      {/* Pagination Skeleton */}
      <div className="flex w-full flex-col items-center gap-4 self-stretch sm:gap-8">
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="bg-muted-foreground/25 h-8 w-8 animate-pulse rounded-full sm:h-10 sm:w-10"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ClientManagementPageSkeleton
