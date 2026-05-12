/**
 * Loading skeleton for Edit Target Action modal content.
 * Mirrors TargetActionForm layout: stacked fields (gap-4), name, field type,
 * and optional dropdown block (label + input row + value card with option row).
 */

export function EditTargetActionFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {/* Name — matches Label + Input */}
      <div className="flex flex-col gap-1">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
      </div>

      {/* Field type — matches Label + SelectTrigger */}
      <div className="flex flex-col gap-1">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
      </div>

      {/* Dropdown values — matches fieldType === 'dropdown' block */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-10 min-w-0 flex-1 animate-pulse rounded-md bg-gray-200" />
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-gray-200" />
        </div>
        <ul className="flex flex-col gap-2">
          <li className="flex flex-col gap-1 rounded border border-gray-200 bg-white px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="h-4 w-36 max-w-[70%] animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-3 w-[4.75rem] animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          </li>
        </ul>
      </div>
    </div>
  )
}
