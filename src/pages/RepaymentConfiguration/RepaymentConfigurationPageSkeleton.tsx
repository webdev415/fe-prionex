/**
 * RepaymentConfigurationPageSkeleton
 *
 * Page-level skeleton mirroring Repayment & Write-off Configuration:
 * header actions, two-column order/write-off cards, algorithm card, history.
 */

function RowSkeleton({ withToggle = false }: { withToggle?: boolean }) {
  return (
    <div className="border-border bg-card flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3">
      {!withToggle && <div className="bg-muted h-7 w-7 shrink-0 animate-pulse rounded-full" />}
      <div className="bg-muted h-4 w-28 flex-1 animate-pulse rounded sm:w-36" />
      {withToggle ? (
        <div className="flex shrink-0 items-center gap-3">
          <div className="bg-muted h-7 w-16 animate-pulse rounded-full" />
          <div className="bg-muted h-5 w-9 animate-pulse rounded-full" />
        </div>
      ) : (
        <div className="flex shrink-0 gap-1">
          <div className="bg-muted h-7 w-7 animate-pulse rounded-md" />
          <div className="bg-muted h-7 w-7 animate-pulse rounded-md" />
        </div>
      )}
    </div>
  )
}

export function RepaymentConfigurationPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Header */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="bg-muted h-7 w-full max-w-md animate-pulse rounded sm:h-8 sm:w-96" />
          <div className="bg-muted h-4 w-full max-w-xl animate-pulse rounded" />
          <div className="bg-muted h-3 w-56 animate-pulse rounded" />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="bg-muted h-10 w-full animate-pulse rounded-full sm:h-12 sm:w-28" />
          <div className="bg-muted h-10 w-full animate-pulse rounded-full sm:h-12 sm:w-36" />
        </div>
      </div>

      {/* Order + Write-off — two columns */}
      <div className="grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        <section className="border-border bg-card/50 flex h-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="bg-muted h-5 w-40 animate-pulse rounded sm:h-6" />
            <div className="bg-muted h-4 w-full animate-pulse rounded" />
            <div className="bg-muted h-4 w-4/5 animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        </section>

        <section className="border-border bg-card/50 flex h-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <div className="flex flex-col gap-2">
            <div className="bg-muted h-5 w-36 animate-pulse rounded sm:h-6" />
            <div className="bg-muted h-4 w-full animate-pulse rounded" />
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
          </div>
          <div className="grid flex-1 grid-cols-1 content-start gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <RowSkeleton key={i} withToggle />
            ))}
          </div>
          <div className="bg-muted mt-auto h-3 w-72 max-w-full animate-pulse rounded" />
        </section>
      </div>

      {/* Allocation Algorithm */}
      <section className="border-border bg-card/50 flex w-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
        <div className="bg-muted h-5 w-48 animate-pulse rounded sm:h-6" />
        <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-muted h-4 w-40 animate-pulse rounded" />
              <div className="bg-muted h-7 w-16 animate-pulse rounded-full" />
            </div>
            <div className="bg-muted h-4 w-full max-w-lg animate-pulse rounded" />
          </div>
          <div className="bg-muted h-9 w-full animate-pulse rounded-md sm:w-44" />
        </div>
      </section>

      {/* Recent Changes */}
      <section className="border-border bg-card/50 flex w-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
        <div className="bg-muted h-5 w-40 animate-pulse rounded sm:h-6" />
        <div className="border-border bg-card overflow-hidden rounded-lg border">
          <div className="border-border bg-muted flex gap-4 border-b px-4 py-3">
            <div className="bg-muted-foreground/20 h-3 w-16 animate-pulse rounded" />
            <div className="bg-muted-foreground/20 h-3 w-24 animate-pulse rounded" />
            <div className="bg-muted-foreground/20 ml-auto h-3 w-16 animate-pulse rounded" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-border flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
            >
              <div className="bg-muted h-4 w-10 animate-pulse rounded" />
              <div className="bg-muted h-4 w-28 animate-pulse rounded" />
              <div className="bg-muted ml-auto h-3 w-36 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default RepaymentConfigurationPageSkeleton
