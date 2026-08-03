/**
 * ModalSkeleton Component
 *
 * Shared skeleton loading component for modals.
 * Provides a generic form-like skeleton structure that can be used across all modals.
 */

export function ModalSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />

          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <div className="bg-muted h-4 w-20 animate-pulse rounded" />
                <div className="bg-muted h-10 w-full animate-pulse rounded" />
              </div>
            ))}
          </div>

          <div className="bg-border h-px w-full" />
        </div>
      ))}

      <div className="space-y-2">
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        <div className="bg-muted h-20 w-full animate-pulse rounded" />
      </div>
    </div>
  )
}

export default ModalSkeleton
