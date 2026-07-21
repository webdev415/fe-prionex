/**
 * ScoringConfigurationPageSkeleton Component
 *
 * Full page skeleton for the scoring configuration page.
 * Matches the side-tab layout with Score Weights and Priority Thresholds tabs.
 */

export function ScoringConfigurationPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Header Skeleton */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="bg-muted h-7 w-full animate-pulse rounded sm:h-8 sm:w-80" />
        <div className="bg-muted h-12 w-full animate-pulse rounded-full sm:w-32" />
      </div>

      {/* Mobile Tabs Skeleton (Top Navigation) */}
      <div className="flex w-full gap-2 lg:hidden">
        <div className="bg-muted h-12 flex-1 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 flex-1 animate-pulse rounded-lg" />
      </div>

      {/* Side Tabs Layout */}
      <div className="flex w-full flex-col gap-6 lg:flex-row">
        {/* Side Tabs Skeleton - Hidden on mobile, shown on desktop */}
        <div className="hidden w-[200px] flex-shrink-0 flex-col gap-1 lg:flex">
          <div className="bg-muted h-12 w-full animate-pulse rounded-lg" />
          <div className="bg-muted h-12 w-full animate-pulse rounded-lg" />
        </div>

        {/* Tab Content Skeleton */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Score Weights Tab Content Skeleton */}
          <div className="border-border bg-card/50 flex w-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="bg-muted h-5 w-40 animate-pulse rounded sm:h-6" />
                <div className="bg-muted h-4 w-full max-w-md animate-pulse rounded sm:w-96" />
              </div>
            </div>

            {/* Slider Cards Skeleton */}
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <div className="bg-muted h-5 w-32 animate-pulse rounded sm:w-40" />
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[300px] md:min-w-[400px] lg:min-w-[500px]">
                      <div className="bg-muted h-1 w-full animate-pulse rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Weight Badge Skeleton */}
            <div className="mt-4 flex items-center justify-end">
              <div className="bg-muted h-8 w-32 animate-pulse rounded-full" />
            </div>

            {/* Change Reason Input Skeleton */}
            <div className="flex flex-col gap-2">
              <div className="bg-muted h-5 w-32 animate-pulse rounded" />
              <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
            </div>

            {/* Save Button Skeleton */}
            <div className="flex items-center justify-end">
              <div className="bg-muted h-10 w-32 animate-pulse rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScoringConfigurationPageSkeleton
