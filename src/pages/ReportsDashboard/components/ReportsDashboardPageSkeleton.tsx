/**
 * ReportsDashboardPageSkeleton Component
 *
 * Skeleton loading component for the Reports Dashboard page.
 * Matches the ReportsDashboardPage structure with animated placeholders.
 */

export function ReportsDashboardPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col items-start gap-4 self-stretch sm:gap-5">
      {/* Page Header Skeleton */}
      <div className="flex flex-col gap-3 self-stretch lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
        <div className="bg-muted h-8 w-48 animate-pulse rounded lg:justify-self-start" />
        <div className="flex w-full justify-center lg:w-auto">
          <div className="bg-card flex items-center gap-1 rounded-lg p-1 shadow-sm">
            <div className="bg-muted h-10 w-20 animate-pulse rounded" />
            <div className="bg-muted h-10 w-20 animate-pulse rounded" />
            <div className="bg-muted h-10 w-20 animate-pulse rounded" />
          </div>
        </div>
        <div className="flex w-full justify-center sm:justify-end lg:justify-self-end">
          <div className="bg-muted h-12 w-full max-w-sm animate-pulse rounded-full sm:w-32" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex w-full flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        {/* Left Column - KPI Cards Skeleton */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:w-[35%] lg:shrink-0 lg:flex-col lg:gap-5 lg:self-start">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={`border-border bg-card/50 flex w-full flex-col items-center gap-4 rounded-xl border p-4 sm:gap-6 sm:p-6 ${
                index === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <div className="bg-muted h-6 w-32 animate-pulse rounded" />
                <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
              </div>
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="bg-muted h-12 w-24 animate-pulse rounded" />
                <div className="flex items-center justify-center gap-2">
                  <div className="bg-muted h-5 w-5 animate-pulse rounded" />
                  <div className="bg-muted h-5 w-32 animate-pulse rounded" />
                </div>
                <div className="bg-muted h-8 w-24 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Right Column - Agent Performance Table Skeleton */}
        <div className="flex w-full min-w-0 flex-1">
          <div className="bg-card/50 flex min-h-0 w-full flex-1 flex-col items-start gap-3 self-stretch rounded-xl p-3 sm:min-h-[730px] sm:p-6">
            {/* Header Skeleton */}
            <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-between">
              <div className="bg-muted h-6 w-48 animate-pulse rounded" />
              <div className="bg-muted h-8 w-32 animate-pulse rounded" />
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-start self-stretch">
              {/* Filters Skeleton */}
              <div className="border-border bg-card flex w-full flex-col items-stretch gap-4 self-stretch rounded-t-xl border p-3 sm:p-4 xl:flex-row xl:items-end xl:gap-5">
                <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:flex-1">
                  <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                  <div className="bg-muted h-10 w-full animate-pulse rounded" />
                </div>
                <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:flex-1">
                  <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                  <div className="bg-muted h-10 w-full animate-pulse rounded" />
                </div>
                <div className="flex w-full min-w-0 flex-col items-start justify-center gap-1 xl:min-w-[280px] xl:flex-[1.4]">
                  <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                  <div className="grid w-full grid-cols-1 gap-2 min-[480px]:grid-cols-[1fr_auto_1fr] min-[480px]:items-center min-[480px]:gap-3">
                    <div className="bg-muted h-10 w-full animate-pulse rounded" />
                    <div className="bg-muted hidden h-4 w-4 animate-pulse rounded min-[480px]:block" />
                    <div className="bg-muted h-10 w-full animate-pulse rounded" />
                  </div>
                </div>
              </div>

              {/* Table Skeleton */}
              <div className="border-border bg-border w-full overflow-x-auto rounded-b-xl border border-t-0 shadow-sm">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="bg-card">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <th
                          key={index}
                          scope="col"
                          className={`h-[49px] px-6 text-xs font-medium ${
                            index < 5 ? 'border-border border-r' : ''
                          }`}
                        >
                          <div className="bg-muted h-4 w-20 animate-pulse rounded" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card'}>
                        {Array.from({ length: 6 }).map((_, colIndex) => (
                          <td
                            key={colIndex}
                            className={`h-[49px] px-6 ${
                              colIndex < 5 ? 'border-border border-r' : ''
                            }`}
                          >
                            <div
                              className={`bg-muted h-4 animate-pulse rounded ${
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
