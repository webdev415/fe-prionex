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
    <div className="flex w-full flex-col items-start gap-5 pt-1 pr-7 pb-6 pl-7">
      {/* Priority Cards Skeleton */}
      <div className="flex w-full items-start gap-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-1 flex-col items-start gap-4 rounded-xl border border-white bg-white/50 p-6"
          >
            {/* Badge and Title */}
            <div className="flex items-start gap-3">
              <div className="h-[25px] w-16 animate-pulse rounded-[16px] bg-gray-200" />
              <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            </div>

            {/* Stats */}
            <div className="flex items-start justify-between self-stretch">
              <div className="flex flex-row items-start gap-1">
                <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="flex flex-row items-start gap-1">
                <div className="h-5 w-12 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-8 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* List Header Skeleton */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-12 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex items-center justify-end gap-5">
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
          <div className="h-12 w-40 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Table Skeleton with Bulk Selection */}
      <div className="flex flex-col items-start gap-8 self-stretch">
        <TableSkeleton
          columns={TABLE_COLUMNS}
          rows={ITEMS_PER_PAGE}
          className="w-full"
          enableBulkSelection
          showBulkHeader
        />
      </div>

      {/* Pagination Skeleton */}
      <div className="flex flex-col items-center gap-8 self-stretch">
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-10 w-10 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ClientManagementPageSkeleton
