/**
 * ModalSkeleton Component
 *
 * Shared skeleton loading component for modals.
 * Provides a generic form-like skeleton structure that can be used across all modals.
 */

export function ModalSkeleton() {
  return (
    <div className="space-y-6">
      {/* Form sections skeleton */}
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          {/* Section header */}
          <div className="h-5 w-32 animate-pulse rounded bg-gray-300" />

          {/* Form fields - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-gray-300" />
                <div className="h-10 w-full animate-pulse rounded bg-gray-300" />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-gray-200" />
        </div>
      ))}

      {/* Additional single field section */}
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-300" />
        <div className="h-20 w-full animate-pulse rounded bg-gray-300" />
      </div>
    </div>
  )
}

export default ModalSkeleton
