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
        <div className="bg-muted h-7 w-full animate-pulse rounded sm:h-8 sm:w-80" />
        <div className="bg-muted h-10 w-full animate-pulse rounded-full sm:h-12 sm:w-48" />
      </div>

      {/* Content skeleton */}
      <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
        <div className="border-border bg-card/70 flex flex-col items-center gap-6 rounded-lg border-2 border-dashed p-8 sm:p-10">
          <div className="bg-muted h-14 w-14 animate-pulse rounded-full" />
          <div className="flex w-full max-w-xl flex-col items-center gap-3">
            <div className="bg-muted h-5 w-56 animate-pulse rounded" />
            <div className="bg-muted h-4 w-full animate-pulse rounded" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          </div>
          <div className="bg-muted h-11 w-44 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default BulkOperatorAssignmentPageSkeleton
