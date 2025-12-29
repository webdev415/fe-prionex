/**
 * ActivityTimelinePageSkeleton Component
 *
 * Skeleton loading component for the Activity Timeline page.
 * Matches the ActivityTimelinePage structure with animated placeholders.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 8
const ITEMS_PER_PAGE = 10

export function ActivityTimelinePageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Client Header Skeleton */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center gap-5">
          <div className="h-10 w-40 animate-pulse rounded-full bg-gray-200" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Filters and Table Skeleton */}
      <div className="flex flex-col items-start gap-5 self-stretch rounded-xl bg-white/50 p-6">
        <div className="flex items-center justify-between self-stretch">
          {/* Type of communication Skeleton */}
          <div className="flex flex-1 items-center gap-6">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="flex flex-1 items-center gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>

          {/* Date range Skeleton */}
          <div className="flex flex-1 items-center gap-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="flex flex-1 items-start gap-2">
              <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
            <div className="flex flex-1 items-start gap-2">
              <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-5">
            <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="flex flex-col items-center justify-center gap-6 self-stretch">
          <TableSkeleton columns={TABLE_COLUMNS} rows={ITEMS_PER_PAGE} className="w-full" />
        </div>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex w-full items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
          ))}
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default ActivityTimelinePageSkeleton
