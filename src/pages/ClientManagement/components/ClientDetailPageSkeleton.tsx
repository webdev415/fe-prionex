/**
 * ClientDetailPageSkeleton Component
 *
 * Simple skeleton loading placeholder for the Client Detail page.
 */

export function ClientDetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-muted-foreground/25 h-6 w-6 animate-pulse rounded" />
          <div className="bg-muted-foreground/25 h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted-foreground/25 h-5 w-16 animate-pulse rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted-foreground/25 h-10 w-28 animate-pulse rounded-full" />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-start gap-4 self-stretch xl:flex-row xl:gap-5">
        {/* Left Card */}
        <div className="bg-card/50 flex w-full flex-col gap-4 rounded-lg p-5 xl:w-[30%]">
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground/25 h-6 w-16 animate-pulse rounded-full" />
            <div className="bg-muted-foreground/25 h-6 w-20 animate-pulse rounded-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="bg-muted-foreground/25 h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-4 w-32 animate-pulse rounded" />
            </div>
          ))}
          <div className="bg-muted my-1 h-px" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted-foreground/25 h-10 w-10 animate-pulse rounded" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-3 w-28 animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* Right Card */}
        <div className="bg-card/50 flex w-full flex-1 flex-col gap-4 rounded-lg p-5 xl:w-[64%]">
          {/* Tabs */}
          <div className="border-border flex gap-1 border-b pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted-foreground/25 h-10 w-20 animate-pulse rounded" />
            ))}
          </div>
          {/* Table placeholder */}
          <div className="flex flex-col gap-2">
            <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted-foreground/25 h-12 w-full animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-card/50 flex flex-col gap-3 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <div className="bg-muted-foreground/25 h-8 w-24 animate-pulse rounded-md" />
          <div className="bg-muted-foreground/25 h-8 w-32 animate-pulse rounded-md" />
          <div className="bg-muted-foreground/25 h-8 w-24 animate-pulse rounded-md" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="bg-muted-foreground/25 h-10 w-full animate-pulse rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted-foreground/25 h-12 w-full animate-pulse rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ClientDetailPageSkeleton
