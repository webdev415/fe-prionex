/**
 * Loading skeleton for Edit TA Chain modal — mirrors TAChainForm layout
 * (name, description, chain type + departments row, system checkbox, steps block).
 */

export function EditTAChainFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex flex-col gap-1">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
        <div className="h-[72px] w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="min-h-[40px] w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-52 max-w-full animate-pulse rounded bg-gray-200" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="rounded-md border border-dashed border-gray-300 p-4">
          <div className="mx-auto h-3 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <ol className="flex flex-col gap-3">
          <li className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="flex gap-1">
                <div className="h-7 w-8 animate-pulse rounded border border-gray-200 bg-gray-100" />
                <div className="h-7 w-8 animate-pulse rounded border border-gray-200 bg-gray-100" />
                <div className="h-7 w-14 animate-pulse rounded border border-gray-200 bg-gray-100" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
                <div className="h-10 w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          </li>
        </ol>
      </div>
    </div>
  )
}
