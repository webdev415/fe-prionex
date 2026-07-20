/**
 * Skeleton loading for TA Chains list page (KAN-318).
 * Mirrors header + toolbar and card list layout from TAChainsPage.
 */

export function TAChainsListSectionSkeleton() {
  return (
    <ul className="flex w-full flex-col gap-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="border-border bg-card flex flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-muted h-5 w-44 max-w-[60%] animate-pulse rounded" />
                <div className="bg-muted h-5 w-20 shrink-0 animate-pulse rounded-full" />
                <div className="bg-muted h-5 w-24 shrink-0 animate-pulse rounded-full" />
              </div>
              <div className="mt-2 space-y-2">
                <div className="bg-muted h-3 w-full max-w-md animate-pulse rounded" />
                <div className="bg-muted h-3 w-[66%] max-w-sm animate-pulse rounded" />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                <div className="bg-muted h-3 w-28 animate-pulse rounded" />
                <div className="bg-muted h-3 w-40 animate-pulse rounded" />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
              <div className="bg-muted h-8 w-14 animate-pulse rounded" />
              <div className="bg-muted h-8 w-16 animate-pulse rounded" />
              <div className="bg-muted h-8 w-24 animate-pulse rounded" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function TAChainsPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div className="mb-4 flex w-full flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-8 w-40 animate-pulse rounded" />
          <div className="bg-muted h-5 w-8 animate-pulse rounded" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:flex-nowrap md:justify-end">
          <div className="bg-muted h-5 w-36 animate-pulse rounded" />
          <div className="bg-muted h-10 w-full animate-pulse rounded-md md:w-64" />
          <div className="bg-muted h-11 w-40 shrink-0 animate-pulse rounded-full" />
        </div>
      </div>
      <TAChainsListSectionSkeleton />
    </div>
  )
}

export default TAChainsPageSkeleton
