/**
 * Skeleton placeholder matching CallLogCard layout (calls, SMS, messaging history).
 */

export function CallLogCardSkeleton() {
  return (
    <div
      className="w-full rounded-lg border border-[#E0E0E0] bg-white p-3 md:p-4"
      aria-hidden="true"
    >
      <div className="flex items-start gap-2 md:gap-4">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-gray-200 md:h-10 md:w-10" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-4 w-40 max-w-[70%] animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-4/5 max-w-[85%] animate-pulse rounded bg-gray-200" />
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          <div className="h-3 w-14 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-10 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default CallLogCardSkeleton
