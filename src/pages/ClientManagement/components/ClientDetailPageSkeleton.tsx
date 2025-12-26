/**
 * ClientDetailPageSkeleton Component
 *
 * Skeleton loading component for the Client Detail page.
 * Matches the ClientDetailPage structure with animated placeholders.
 */

export function ClientDetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Client Header Skeleton */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="flex items-center gap-5">
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
          <div className="h-10 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Client Card Skeleton */}
        <div className="flex min-h-[44px] w-[428px] flex-col items-start justify-center gap-0 rounded-lg bg-white/50 p-0">
          <div className="flex flex-col items-start gap-3 self-stretch px-6 py-5">
            {/* Tags Skeleton */}
            <div className="flex items-center gap-2 self-stretch">
              <div className="h-8 w-20 animate-pulse rounded-full bg-gray-200" />
              <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            </div>

            {/* Info Rows Skeleton */}
            <div className="flex flex-col gap-1 self-stretch">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex min-h-8 items-center self-stretch p-0">
                  <div className="h-4 w-24 flex-1 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-32 flex-1 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>

            {/* Phones Skeleton */}
            <div className="flex items-start self-stretch p-0">
              <div className="flex w-[131px] items-center gap-2.5">
                <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="flex flex-1 flex-col items-start justify-center gap-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 self-stretch">
                    <div className="h-4 w-32 flex-1 animate-pulse rounded bg-gray-200" />
                    <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                    <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                    <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex h-px w-[428px] flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>

          {/* Tabs Skeleton */}
          <div className="flex items-center gap-6 self-stretch pr-6">
            <div className="flex min-h-[44px] flex-col items-start gap-1 self-stretch rounded-bl-lg bg-white py-2.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 w-10 animate-pulse rounded bg-gray-200" />
              ))}
            </div>
            <div className="flex flex-1 flex-col items-start gap-4 self-stretch py-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between self-stretch px-6">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content Skeleton - Tabs and Tables */}
        <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
          {/* Tabs Skeleton */}
          <div className="flex items-center gap-2 self-stretch">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 w-24 animate-pulse rounded-full bg-gray-200" />
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="flex flex-1 flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-6">
            <div className="w-full overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-white">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <th
                        key={index}
                        scope="col"
                        className={`h-[49px] px-6 text-xs font-medium ${
                          index < 5 ? 'border-r border-[#EBECE8]' : ''
                        }`}
                      >
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}>
                      {Array.from({ length: 6 }).map((_, colIndex) => (
                        <td
                          key={colIndex}
                          className={`h-[49px] px-6 ${
                            colIndex < 5 ? 'border-r border-[#EBECE8]' : ''
                          }`}
                        >
                          <div
                            className={`h-4 animate-pulse rounded bg-gray-200 ${
                              colIndex === 0 ? 'w-[60%]' : colIndex === 5 ? 'w-[40%]' : 'w-[80%]'
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientDetailPageSkeleton
