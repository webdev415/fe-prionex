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
          <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
          <div className="h-7 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-28 animate-pulse rounded-full bg-gray-200" />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-start gap-4 self-stretch xl:flex-row xl:gap-5">
        {/* Left Card */}
        <div className="flex w-full flex-col gap-4 rounded-lg bg-white/50 p-5 xl:w-[30%]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
          <div className="my-1 h-px bg-gray-200" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-10 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>

        {/* Right Card */}
        <div className="flex w-full flex-1 flex-col gap-4 rounded-lg bg-white/50 p-5 xl:w-[64%]">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 w-20 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
          {/* Table placeholder */}
          <div className="flex flex-col gap-2">
            <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="flex flex-col gap-3 rounded-xl bg-white/50 p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-gray-200" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ClientDetailPageSkeleton
