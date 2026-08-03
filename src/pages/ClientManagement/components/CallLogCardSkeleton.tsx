/**
 * Skeleton placeholder matching CallLogCard layout (SMS / messaging history and calls).
 */

export type CallLogCardSkeletonVariant = 'message' | 'call'

type CallLogCardSkeletonProps = {
  variant?: CallLogCardSkeletonVariant
}

function MetaColumnSkeleton() {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5 md:gap-1">
      <div className="bg-muted-foreground/25 h-2.5 w-14 animate-pulse rounded md:h-3" />
      <div className="bg-muted-foreground/25 h-2.5 w-10 animate-pulse rounded md:h-3" />
      <div className="bg-muted-foreground/25 mt-auto h-2.5 w-16 max-w-[72px] animate-pulse rounded md:h-3" />
    </div>
  )
}

function MessageContentSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden md:gap-1">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <span className="bg-muted-foreground/25 flex h-3 w-3 shrink-0 animate-pulse items-center justify-center rounded-full">
          <span className="bg-border h-1.5 w-1.5 rounded-full" />
        </span>
        <div className="bg-muted-foreground/25 h-3.5 w-16 shrink-0 animate-pulse rounded" />
      </div>
      <div className="bg-muted-foreground/25 h-3.5 w-[55%] max-w-[200px] animate-pulse rounded" />
      <div className="bg-muted-foreground/25 h-3 w-full animate-pulse rounded" />
      <div className="bg-muted-foreground/25 h-3 w-[88%] animate-pulse rounded" />
    </div>
  )
}

function CallContentSkeleton() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden md:gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <div className="bg-muted-foreground/25 h-4 w-4 shrink-0 animate-pulse rounded" />
        <div className="bg-muted-foreground/25 h-3.5 w-14 shrink-0 animate-pulse rounded" />
        <span className="bg-muted-foreground/25 flex h-3 w-3 shrink-0 animate-pulse items-center justify-center rounded-full">
          <span className="bg-border h-1.5 w-1.5 rounded-full" />
        </span>
        <div className="bg-muted-foreground/25 h-3.5 w-12 shrink-0 animate-pulse rounded" />
        <div className="bg-muted-foreground/25 h-5 w-12 shrink-0 animate-pulse rounded-full" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="bg-muted-foreground/25 h-3.5 w-10 shrink-0 animate-pulse rounded" />
        <div className="bg-muted-foreground/25 h-3.5 w-14 shrink-0 animate-pulse rounded" />
      </div>
      <div className="bg-muted-foreground/25 h-3.5 w-32 max-w-[75%] animate-pulse rounded" />
    </div>
  )
}

export function CallLogCardSkeleton({ variant = 'message' }: CallLogCardSkeletonProps) {
  return (
    <div className="border-border bg-card w-full rounded-lg border p-3 md:p-4" aria-hidden="true">
      <div className="flex h-full min-w-0 items-start gap-2 md:gap-4">
        <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md md:h-10 md:w-10">
          <div className="bg-muted-foreground/25 h-5 w-5 animate-pulse rounded md:h-6 md:w-6" />
        </div>
        {variant === 'call' ? <CallContentSkeleton /> : <MessageContentSkeleton />}
        <MetaColumnSkeleton />
      </div>
    </div>
  )
}

export default CallLogCardSkeleton
