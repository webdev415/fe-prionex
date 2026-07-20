/**
 * ProjectDetailPanelSkeleton Component
 *
 * Skeleton loading component for the project detail panel.
 * Matches the ProjectDetailPanel structure with animated placeholders.
 */

export function ProjectDetailPanelSkeleton() {
  return (
    <div className="border-border bg-card/50 flex h-full w-full flex-col overflow-hidden rounded-lg border p-6">
      {/* Header Skeleton */}
      <div className="flex items-center gap-2">
        <div className="bg-muted h-6 w-16 animate-pulse rounded" />
        <div className="bg-muted h-6 w-32 animate-pulse rounded" />
      </div>

      {/* Scrollable Content Skeleton */}
      <div className="mt-2 flex flex-1 flex-col gap-2 overflow-y-auto">
        {/* Basic Info Skeleton */}
        <div className="grid grid-cols-2 gap-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="bg-muted h-3 w-12 animate-pulse rounded" />
              <div className="bg-muted h-4 w-20 animate-pulse rounded" />
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Metrics Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-5 w-16 animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="bg-muted h-3 w-12 animate-pulse rounded" />
                <div className="bg-muted h-3 w-16 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Description Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-4 w-20 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="bg-muted h-4 w-full animate-pulse rounded" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          </div>
        </div>

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Access and Roles Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted h-4 w-12 animate-pulse rounded" />
            </div>
          ))}
          <div className="bg-muted mt-3 h-10 w-40 animate-pulse rounded" />
        </div>

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Audit Skeleton */}
        <div className="flex flex-col gap-3">
          <div className="bg-muted h-5 w-16 animate-pulse rounded" />
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex justify-between">
                <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions Skeleton */}
      <div className="flex gap-3 pt-3">
        <div className="bg-muted h-11 flex-1 animate-pulse rounded-md" />
        <div className="bg-muted h-11 flex-1 animate-pulse rounded-md" />
      </div>
    </div>
  )
}

export default ProjectDetailPanelSkeleton
