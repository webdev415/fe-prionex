/**
 * ReportsDashboardPageSkeleton Component
 *
 * Skeleton loading component for the Reports Dashboard page.
 * Matches the ReportsDashboardPage structure with animated placeholders.
 */

export function ReportsDashboardPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-start gap-5 self-stretch">
      {/* Page Header Skeleton */}
      <div className="flex h-12 items-center justify-between gap-5 self-stretch">
        <div className="flex flex-1 items-center gap-4 self-stretch">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm">
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-20 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex h-12 flex-1 flex-col items-end gap-2.5">
          <div className="h-12 w-32 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex items-start gap-5 self-stretch">
        {/* Left Column - KPI Cards Skeleton */}
        <div className="flex w-[35%] flex-col items-start gap-5 self-stretch">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-1 flex-col items-center justify-between self-stretch rounded-xl border border-white bg-white/50 p-6"
            >
              <div className="flex items-center justify-between self-stretch">
                <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <div className="h-12 w-24 animate-pulse rounded bg-gray-200" />
                <div className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-pulse rounded bg-gray-200" />
                  <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>

        {/* Right Column - Agent Performance Table Skeleton */}
        <div className="flex flex-1 self-stretch">
          <div className="flex min-h-[730px] flex-1 flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between self-stretch">
              <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
            </div>

            <div className="flex flex-1 flex-col items-start self-stretch">
              {/* Filters Skeleton */}
              <div className="flex items-start gap-5 self-stretch rounded-t-xl border border-[#EBECE8] bg-white p-4">
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
                </div>
                <div className="flex flex-1 flex-col items-start justify-center gap-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
                </div>
                <div className="flex flex-col items-start justify-center gap-1 self-stretch">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                    <div className="h-10 w-32 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              </div>

              {/* Table Skeleton */}
              <div className="w-full overflow-hidden rounded-b-xl border border-t-0 border-[#EBECE8] bg-[#EBECE8] shadow-sm">
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
                      <tr
                        key={rowIndex}
                        className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}
                      >
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
    </div>
  )
}

export default ReportsDashboardPageSkeleton
