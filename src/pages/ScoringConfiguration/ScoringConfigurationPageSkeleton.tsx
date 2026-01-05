/**
 * ScoringConfigurationPageSkeleton Component
 *
 * Full page skeleton for the scoring configuration page.
 * Includes header, score weights section, priority thresholds, and preview sections.
 */

export function ScoringConfigurationPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-6">
      {/* Header Skeleton */}
      <div className="flex w-full items-center justify-between">
        <div className="h-8 w-80 animate-pulse rounded bg-gray-200" />
      </div>

      {/* Score Weights Section Skeleton */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-gray-200" />
        </div>

        {/* Sliders Skeleton */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
              <div className="h-2 w-full animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Total Weight Skeleton */}
        <div className="flex items-center gap-2">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      {/* Two Column Section Skeleton */}
      <div className="flex flex-row gap-4 self-stretch">
        {/* Priority Classification Thresholds Section Skeleton */}
        <div className="flex w-[50%] flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
          <div className="flex items-center justify-between">
            <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-gray-200" />
          </div>

          <div className="flex gap-4">
            <div className="flex w-[50%] flex-col gap-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-9 w-16 animate-pulse rounded-md bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex w-[50%] flex-col gap-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-5 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-9 w-16 animate-pulse rounded-md bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkbox Skeleton */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-64 animate-pulse rounded bg-gray-200" />
          </div>
        </div>

        {/* Seller-Specific Overrides Section Skeleton */}
        <div className="flex w-[50%] flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
          <div className="h-6 w-56 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-64 animate-pulse rounded-md bg-gray-200" />
          <div className="h-5 w-full animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      {/* Configuration Preview Section Skeleton */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />

        <div className="grid grid-cols-2 gap-6">
          {/* Current Distribution Skeleton */}
          <div className="flex flex-col gap-3">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex w-full items-center gap-2">
                    <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Distribution Skeleton */}
          <div className="flex flex-col gap-3">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex w-full items-center gap-2">
                    <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Skeleton */}
      <div className="flex w-full items-center justify-between">
        <div className="h-5 w-64 animate-pulse rounded bg-gray-200" />
        <div className="flex w-[30%] items-center gap-3">
          <div className="h-10 flex-1 animate-pulse rounded-md bg-gray-200" />
          <div className="h-10 flex-1 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default ScoringConfigurationPageSkeleton
