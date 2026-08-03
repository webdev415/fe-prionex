/**
 * ImportDetailsPageSkeleton Component
 *
 * Skeleton loading component for the Import Details page.
 * Matches the ImportDetailsPage structure with animated placeholders.
 * Works for all cases: Errors panel, Progress panel (in progress), Progress panel (failed), Progress panel (completed).
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

export function ImportDetailsPageSkeleton() {
  return (
    <div>
      {/* Page Header Skeleton */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Back Button Skeleton */}
          <div className="bg-muted h-10 w-24 animate-pulse rounded-full sm:h-12 sm:w-32" />
          {/* Title Skeleton */}
          <div className="bg-muted h-7 w-40 animate-pulse rounded sm:h-8 sm:w-48" />
        </div>
        {/* Download Button Skeleton */}
        <div className="bg-muted h-10 w-full animate-pulse rounded-full sm:h-12 sm:w-40" />
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Card: Last Import Summary Skeleton */}
        <div className="border-border bg-card/50 flex flex-1 flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-6">
          {/* Title Skeleton */}
          <div className="bg-muted h-6 w-48 animate-pulse rounded sm:h-7" />

          {/* Divider */}
          <div className="bg-border mb-4 h-px w-full" />

          {/* File Info Rows Skeleton */}
          <div className="flex flex-col items-start gap-3 self-stretch">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex w-full flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="bg-muted h-4 w-full animate-pulse rounded sm:h-[22px] sm:w-24" />
                <div className="bg-muted h-4 flex-1 animate-pulse rounded sm:h-[22px]" />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="bg-border my-4 h-px w-full" />

          {/* Statistics Rows Skeleton */}
          <div className="flex flex-col items-start gap-3 self-stretch">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex w-full flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="bg-muted h-4 w-full animate-pulse rounded sm:h-[22px] sm:w-24" />
                <div className="bg-muted h-4 flex-1 animate-pulse rounded sm:h-[22px]" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Errors/Progress Skeleton */}
        {/* This skeleton works for both Errors panel and Progress panel cases */}
        <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
          {/* Title Skeleton */}
          <div className="bg-muted mb-4 h-6 w-40 animate-pulse rounded sm:mb-6 sm:h-7" />

          {/* Table Skeleton - works for Errors case */}
          {/* For Progress cases, this will just show as a generic loading state */}
          <TableSkeleton columns={2} rows={10} />

          {/* Pagination Skeleton - shown for Errors case */}
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:mt-6 sm:flex-row">
            <div className="bg-muted h-10 w-32 animate-pulse rounded" />
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="bg-muted h-10 w-10 animate-pulse rounded" />
              ))}
            </div>
            <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportDetailsPageSkeleton
