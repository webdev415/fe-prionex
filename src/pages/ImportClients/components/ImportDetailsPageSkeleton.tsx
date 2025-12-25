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
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back Button Skeleton */}
          <div className="h-12 w-32 animate-pulse rounded-full bg-gray-300" />
          {/* Title Skeleton */}
          <div className="h-8 w-48 animate-pulse rounded bg-gray-300" />
        </div>
        {/* Download Button Skeleton */}
        <div className="h-12 w-40 animate-pulse rounded-full bg-gray-300" />
      </div>

      {/* Content Cards Skeleton */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Card: Last Import Summary Skeleton */}
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
          {/* Title Skeleton */}
          <div className="h-7 w-48 animate-pulse rounded bg-gray-300" />

          {/* Divider */}
          <div className="mb-4 h-px w-full bg-gray-200" />

          {/* File Info Rows Skeleton */}
          <div className="flex flex-col items-start gap-3 self-stretch">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex w-full items-center gap-6">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
                <div className="h-4 flex-1 animate-pulse rounded bg-gray-300" />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="my-4 h-px w-full bg-gray-200" />

          {/* Statistics Rows Skeleton */}
          <div className="flex flex-col items-start gap-3 self-stretch">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex w-full items-center gap-6">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
                <div className="h-4 flex-1 animate-pulse rounded bg-gray-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Errors/Progress Skeleton */}
        {/* This skeleton works for both Errors panel and Progress panel cases */}
        <div className="rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
          {/* Title Skeleton */}
          <div className="mb-6 h-7 w-40 animate-pulse rounded bg-gray-300" />

          {/* Table Skeleton - works for Errors case */}
          {/* For Progress cases, this will just show as a generic loading state */}
          <TableSkeleton columns={2} rows={10} />

          {/* Pagination Skeleton - shown for Errors case */}
          <div className="mt-6 flex items-center justify-between">
            <div className="h-10 w-32 animate-pulse rounded bg-gray-300" />
            <div className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 w-10 animate-pulse rounded bg-gray-300" />
              ))}
            </div>
            <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportDetailsPageSkeleton
