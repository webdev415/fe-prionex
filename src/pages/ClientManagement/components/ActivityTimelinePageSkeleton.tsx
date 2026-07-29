/**
 * ActivityTimelinePageSkeleton Component
 *
 * Skeleton loading component for the Activity Timeline page.
 * Matches the ActivityTimelinePage structure with animated placeholders.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 12
const ITEMS_PER_PAGE = 10

export function ActivityTimelinePageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Client Header Skeleton */}
      <div className="flex flex-col gap-4 self-stretch 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-row items-center gap-2">
            <div className="bg-muted-foreground/25 h-6 w-6 animate-pulse rounded" />
            <div className="bg-muted-foreground/25 h-6 w-32 animate-pulse rounded md:h-8 md:w-48" />
          </div>
          <div className="flex flex-row items-center gap-2">
            <div className="bg-muted-foreground/25 h-5 w-14 animate-pulse rounded-full md:h-6 md:w-16" />
            <div className="bg-muted-foreground/25 h-5 w-16 animate-pulse rounded-full md:h-6 md:w-20" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-5">
          <div className="bg-muted-foreground/25 h-9 w-full flex-1 animate-pulse rounded-full md:h-10" />
          <div className="bg-muted-foreground/25 h-9 w-full flex-1 animate-pulse rounded-full md:h-10" />
          <div className="bg-muted-foreground/25 h-9 w-full flex-1 animate-pulse rounded-full md:h-10" />
        </div>
      </div>

      {/* Filters and Table Skeleton */}
      <div className="bg-card/50 flex flex-col items-start gap-5 self-stretch rounded-xl p-3 md:p-6">
        <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:justify-between">
          {/* Type of communication Skeleton */}
          <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center lg:flex-1">
            <div className="bg-muted-foreground/25 h-4 w-40 shrink-0 animate-pulse rounded" />
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="bg-muted-foreground/25 h-4 w-4 animate-pulse rounded-full" />
                  <div className="bg-muted-foreground/25 h-4 w-16 animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Date range Skeleton */}
          <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center lg:flex-1 lg:justify-end">
            <div className="bg-muted-foreground/25 h-4 w-24 shrink-0 animate-pulse rounded" />
            <div className="flex flex-1 items-center gap-2">
              <div className="bg-muted-foreground/25 h-10 w-full flex-1 animate-pulse rounded sm:w-32" />
              <div className="bg-muted-foreground/25 h-4 w-4 shrink-0 animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-10 w-full flex-1 animate-pulse rounded sm:w-32" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 self-stretch sm:justify-end lg:w-auto lg:flex-none">
            <div className="bg-muted-foreground/25 h-8 w-24 animate-pulse rounded-full" />
          </div>
        </div>

        {/* Table Skeleton */}
        <TableSkeleton columns={TABLE_COLUMNS} rows={ITEMS_PER_PAGE} className="w-full" />
      </div>

      {/* Pagination Skeleton */}
      <div className="flex w-full items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="bg-muted-foreground/25 h-10 w-10 animate-pulse rounded-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="bg-muted-foreground/25 h-10 w-10 animate-pulse rounded-full"
            />
          ))}
          <div className="bg-muted-foreground/25 h-10 w-10 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default ActivityTimelinePageSkeleton
