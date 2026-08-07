/**
 * Skeleton for SendMessageModal while integrations and drafts load.
 */

export function SendMessageModalSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-hidden="true">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="bg-muted-foreground/25 h-4 w-16 animate-pulse rounded" />
          <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md" />
        </div>
        <div className="space-y-1.5">
          <div className="bg-muted-foreground/25 h-4 w-16 animate-pulse rounded" />
          <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md" />
        </div>
      </div>
      <div className="bg-muted-foreground/25 h-24 w-full animate-pulse rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md" />
        <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded-md" />
      </div>
      <div className="bg-muted-foreground/25 h-32 w-full animate-pulse rounded-md" />
      <div className="bg-muted-foreground/25 h-28 w-full animate-pulse rounded-xl" />
      <div className="bg-muted-foreground/25 h-36 w-full animate-pulse rounded-xl" />
    </div>
  )
}

export default SendMessageModalSkeleton
