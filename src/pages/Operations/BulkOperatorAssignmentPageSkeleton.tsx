/**
 * BulkOperatorAssignmentPageSkeleton Component
 *
 * Page-level skeleton for bulk operator assignment.
 * Mirrors the final layout with page header, action button, and upload card.
 */
export function BulkOperatorAssignmentPageSkeleton() {
  return (
    <div className="flex w-full flex-col">
      {/* Header skeleton */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-7 w-full animate-pulse rounded bg-gray-200 sm:h-8 sm:w-80" />
        <div className="h-10 w-full animate-pulse rounded-full bg-gray-200 sm:h-12 sm:w-48" />
      </div>

      {/* Content skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-6 rounded-lg border-2 border-dashed border-gray-200 bg-white/70 p-8 sm:p-10">
          <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200" />
          <div className="flex w-full max-w-xl flex-col items-center gap-3">
            <div className="h-5 w-56 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-11 w-44 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default BulkOperatorAssignmentPageSkeleton
