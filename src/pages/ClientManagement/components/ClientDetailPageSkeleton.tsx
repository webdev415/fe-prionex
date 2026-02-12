/**
 * ClientDetailPageSkeleton Component
 *
 * Skeleton loading component for the Client Detail page.
 * Matches the ClientDetailPage structure with animated placeholders.
 */

export function ClientDetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Client Header Skeleton */}
      <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-row items-center gap-2">
            <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200 md:h-8 md:w-48" />
          </div>
          <div className="flex flex-row items-center gap-2">
            <div className="h-5 w-14 animate-pulse rounded-full bg-gray-200 md:h-6 md:w-16" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 md:h-6 md:w-20" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-5">
          <div className="h-9 w-full flex-1 animate-pulse rounded-full bg-gray-200 md:h-10 md:w-32 md:flex-none" />
          <div className="h-9 w-full flex-1 animate-pulse rounded-full bg-gray-200 md:h-10 md:w-32 md:flex-none" />
          <div className="h-9 w-full flex-1 animate-pulse rounded-full bg-gray-200 md:h-10 md:w-24 md:flex-none" />
          <div className="h-9 w-full flex-1 animate-pulse rounded-full bg-gray-200 md:h-10 md:w-32 md:flex-none" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex flex-col items-start gap-4 self-stretch xl:flex-row xl:gap-5">
        {/* Client Card Skeleton */}
        <div className="flex min-h-[44px] w-full flex-col items-start justify-center gap-0 rounded-lg bg-white/50 p-0 xl:w-[30%]">
          <div className="flex flex-col items-start gap-3 self-stretch px-4 py-4 md:px-6 md:py-5">
            {/* Tags Skeleton */}
            <div className="flex items-center gap-2 self-stretch">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200 md:h-8 md:w-20" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200 md:h-8 md:w-24" />
              </div>
              <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-gray-200 md:h-8 md:w-8" />
            </div>

            {/* Info Rows Skeleton */}
            <div className="flex flex-col gap-1 self-stretch">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex min-h-8 items-center self-stretch p-0">
                  <div className="h-3 w-20 flex-1 animate-pulse rounded bg-gray-200 md:h-4 md:w-24" />
                  <div className="ml-2 h-3 w-24 flex-1 animate-pulse rounded bg-gray-200 md:h-4 md:w-32" />
                </div>
              ))}
            </div>

            {/* Phones Skeleton */}
            <div className="flex flex-row items-center justify-between gap-2 self-stretch p-0">
              <div className="flex flex-1 shrink-0 items-center gap-2.5">
                <div className="h-4 w-12 animate-pulse rounded bg-gray-200 md:h-5 md:w-16" />
              </div>
              <div className="flex w-full flex-1 flex-col items-start justify-center gap-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2 self-stretch md:gap-3">
                    <div className="h-3 w-24 flex-1 animate-pulse rounded bg-gray-200 text-right md:h-4 md:w-32" />
                    <div className="flex shrink-0 items-center gap-1 md:gap-2">
                      <div className="h-6 w-6 animate-pulse rounded bg-gray-200 md:h-5 md:w-5" />
                      <div className="h-6 w-6 animate-pulse rounded bg-gray-200 md:h-5 md:w-5" />
                      <div className="h-6 w-6 animate-pulse rounded bg-gray-200 md:h-5 md:w-5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-2 flex h-px flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>

          {/* Tabs Skeleton */}
          <div className="flex flex-col items-start gap-4 self-stretch pr-0 md:flex-row md:items-center md:gap-6 md:pr-6">
            {/* Tab icons container - horizontal scroll on mobile */}
            <div className="relative flex min-h-[44px] w-full items-start gap-1 self-stretch rounded-bl-lg border-gray-200 p-4 md:my-2.5 md:w-auto md:flex-col md:border-r-1 md:border-b md:border-b-0 md:px-2.5 md:pb-0">
              <div
                className="scrollbar-hide flex w-full items-start gap-1 self-stretch overflow-x-auto md:w-auto md:flex-col md:overflow-x-visible"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-10 w-full shrink-0 animate-pulse rounded-md bg-gray-200 md:w-10 md:rounded"
                  />
                ))}
              </div>
            </div>
            {/* Tab content skeleton */}
            <div className="flex w-full flex-col items-center gap-6 self-stretch px-4 py-4 md:w-[324px] md:px-0">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center self-stretch p-0">
                  <div className="h-3 w-24 flex-1 animate-pulse rounded bg-gray-200 md:h-4 md:w-32" />
                  <div className="h-3 w-20 flex-1 animate-pulse rounded bg-gray-200 md:h-4 md:w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Data + Comments Card with 6 horizontal top tabs */}
        <div className="flex w-full flex-1 flex-col items-start gap-5 self-stretch xl:w-[64%]">
          <div className="flex flex-1 flex-col items-start gap-0 self-stretch rounded-lg bg-white/50 p-0">
            {/* Horizontal tab bar - 6 tabs at the top - scrollable on mobile */}
            <div className="relative mx-3 flex items-center gap-0 self-stretch border-b border-gray-200">
              {/* Tab Container */}
              <div
                className="scrollbar-hide flex items-center gap-0 self-stretch overflow-x-auto"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-10 w-20 shrink-0 animate-pulse rounded-t bg-gray-200 md:h-12 md:w-24"
                  />
                ))}
              </div>
            </div>

            {/* Content area skeleton */}
            <div className="flex w-full flex-col items-start gap-0 self-stretch p-0">
              {/* Secondary filters skeleton */}
              <div className="mx-3 flex items-center gap-3 self-stretch overflow-x-auto pt-4 pb-0 md:mx-6 md:gap-6 md:pt-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-8 w-24 shrink-0 animate-pulse rounded-md bg-gray-200 md:h-10 md:w-32"
                  />
                ))}
              </div>

              {/* Table Skeleton */}
              <div className="flex flex-col items-start gap-2.5 self-stretch overflow-x-auto px-3 py-4 md:px-6">
                <div className="w-full overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
                  <table className="w-full min-w-[600px] border-collapse">
                    <thead>
                      <tr className="bg-white">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <th
                            key={index}
                            scope="col"
                            className={`h-[49px] px-3 text-xs font-medium md:px-6 ${
                              index < 5 ? 'border-r border-[#EBECE8]' : ''
                            }`}
                          >
                            <div className="h-3 w-16 animate-pulse rounded bg-gray-200 md:h-4 md:w-20" />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}
                        >
                          {Array.from({ length: 6 }).map((_, colIndex) => (
                            <td
                              key={colIndex}
                              className={`h-[49px] px-3 md:px-6 ${
                                colIndex < 5 ? 'border-r border-[#EBECE8]' : ''
                              }`}
                            >
                              <div
                                className={`h-3 animate-pulse rounded bg-gray-200 md:h-4 ${
                                  colIndex === 0
                                    ? 'w-[60%]'
                                    : colIndex === 5
                                      ? 'w-[40%]'
                                      : 'w-[80%]'
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

              {/* Action buttons skeleton */}
              <div className="flex flex-wrap items-center gap-2 self-stretch px-3 py-4 md:gap-3 md:px-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-8 w-20 animate-pulse rounded bg-gray-200 md:h-9 md:w-28"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section Skeleton */}
      <div className="flex flex-col items-start gap-3 self-stretch rounded-xl border border-white bg-white/50 p-3 xl:flex-row xl:items-center xl:gap-5">
        <div className="flex w-full flex-col items-start gap-2.5 xl:w-[416px]">
          <div className="flex items-center rounded-lg border border-white bg-white p-1 shadow-sm">
            <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200" />
            <div className="ml-1 h-8 w-24 animate-pulse rounded-md bg-gray-200" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch">
          <div className="h-3 w-16 shrink-0 animate-pulse rounded bg-gray-200 whitespace-nowrap md:h-4" />
          <div className="h-3 min-w-0 flex-1 animate-pulse rounded bg-gray-200 md:h-4" />
          <div className="h-5 w-16 shrink-0 animate-pulse rounded bg-gray-200 md:h-6 md:w-20" />
        </div>
      </div>

      {/* Recent Activity Timeline Skeleton */}
      <div className="flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-3 md:p-6">
        <div className="flex flex-col items-start justify-between gap-2 self-stretch sm:flex-row sm:items-center">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200 md:h-6 md:w-64" />
          <div className="h-5 w-16 animate-pulse rounded bg-gray-200 md:h-6 md:w-20" />
        </div>
        <div className="w-full overflow-x-auto">
          <div className="w-full min-w-[800px] overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-white">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <th
                      key={index}
                      scope="col"
                      className={`h-[49px] px-3 text-xs font-medium md:px-6 ${
                        index < 7 ? 'border-r border-[#EBECE8]' : ''
                      }`}
                    >
                      <div className="h-3 w-16 animate-pulse rounded bg-gray-200 md:h-4 md:w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}>
                    {Array.from({ length: 8 }).map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className={`h-[49px] px-3 md:px-6 ${
                          colIndex < 7 ? 'border-r border-[#EBECE8]' : ''
                        }`}
                      >
                        <div
                          className={`h-3 animate-pulse rounded bg-gray-200 md:h-4 ${
                            colIndex === 0 ? 'w-[70%]' : colIndex === 7 ? 'w-[50%]' : 'w-[80%]'
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
  )
}

export default ClientDetailPageSkeleton
