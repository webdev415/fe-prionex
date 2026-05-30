/**
 * Skeleton for SendMessageModal while integrations and drafts load.
 */

export function SendMessageModalSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>
      <div className="h-24 w-full animate-pulse rounded-lg bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
      </div>
      <div className="h-32 w-full animate-pulse rounded-md bg-gray-200" />
      <div className="h-28 w-full animate-pulse rounded-xl bg-gray-200" />
      <div className="h-36 w-full animate-pulse rounded-xl bg-gray-200" />
    </div>
  )
}

export default SendMessageModalSkeleton
