/**
 * The card's shape while it is still being fetched.
 *
 * It mirrors the real layout rather than showing a spinner in the middle of an
 * empty page: the panel where the panel goes, the tab bar where the tab bar
 * goes, sections the height sections are. What arrives then fills the shape
 * that is already there instead of shoving it down the page.
 *
 * ``aria-hidden`` with a live status beside it: a screen reader should hear
 * "loading" once, not read out two dozen empty boxes.
 */
export interface EmployeeCardSkeletonProps {
  /** Announced while the card is on its way. */
  label: string
}

const bar = 'bg-muted animate-pulse rounded'

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-6">
      <div className="border-border flex items-center justify-between gap-4 border-b pb-4">
        <div className={`${bar} h-5 w-44`} />
        <div className={`${bar} size-5 shrink-0`} />
      </div>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-4 w-40 max-w-full`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmployeeCardSkeleton({ label }: EmployeeCardSkeletonProps) {
  return (
    <>
      <p role="status" className="sr-only">
        {label}
      </p>

      <div
        aria-hidden
        data-testid="card-skeleton"
        className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]"
      >
        <div className="space-y-4 pt-4 md:pt-6">
          <div className={`${bar} h-4 w-24`} />
          <div className="border-border bg-card flex flex-col items-center gap-4 rounded-xl border p-6">
            <div className={`${bar} size-24 rounded-full`} />
            <div className={`${bar} h-5 w-40`} />
            <div className={`${bar} h-3 w-24`} />
            <div className="flex gap-2">
              <div className={`${bar} h-6 w-20 rounded-full`} />
              <div className={`${bar} h-6 w-20 rounded-full`} />
            </div>
            <div className="border-border w-full space-y-3 border-t pt-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className={`${bar} mx-auto h-3 w-20`} />
                  <div className={`${bar} mx-auto h-4 w-32`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-3 pt-4 pb-2 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className={`${bar} h-8 w-36 rounded-full`} />
              <div className={`${bar} h-6 w-20 rounded-full`} />
              <div className={`${bar} h-8 w-32 rounded-full`} />
            </div>
            <div className="border-border flex gap-6 overflow-hidden border-b pb-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className={`${bar} h-4 w-28 shrink-0`} />
              ))}
            </div>
          </div>

          <SectionSkeleton rows={10} />
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={2} />
        </div>
      </div>
    </>
  )
}
