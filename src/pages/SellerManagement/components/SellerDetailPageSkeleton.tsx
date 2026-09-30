/**
 * SellerDetailPageSkeleton Component
 *
 * Full-page skeleton for the seller detail view.
 * Mirrors SellerDetailPage: back link, header, divider, agreements section.
 */

const AGREEMENT_COLUMNS = 5
const AGREEMENT_ROWS = 5

/** Agreements table/area only — used when the seller chrome is already mounted. */
export function SellerDetailAgreementsSkeleton({ rows = AGREEMENT_ROWS }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="border-border overflow-x-auto rounded-md border">
        <div className="bg-muted flex gap-4 px-4 py-3">
          {Array.from({ length: AGREEMENT_COLUMNS }).map((_, index) => (
            <div
              key={index}
              className="bg-muted-foreground/25 mx-auto h-3 w-20 animate-pulse rounded"
            />
          ))}
        </div>
        <div className="divide-border divide-y">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="odd:bg-card even:bg-muted flex gap-4 px-4 py-3">
              {Array.from({ length: AGREEMENT_COLUMNS }).map((_, colIndex) => (
                <div
                  key={colIndex}
                  className="bg-muted-foreground/25 mx-auto h-4 w-24 animate-pulse rounded"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="bg-muted h-10 w-10 animate-pulse rounded" />
        ))}
      </div>
    </div>
  )
}

export function SellerDetailPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-1">
        <div className="bg-muted h-4 w-4 animate-pulse rounded" />
        <div className="bg-muted h-4 w-28 animate-pulse rounded" />
      </div>

      {/* Header: seller name + legal name */}
      <div className="flex flex-wrap items-baseline gap-3">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-5 w-40 animate-pulse rounded" />
      </div>

      <div className="bg-border h-px w-full" />

      {/* Factoring Agreements section */}
      <div className="space-y-4">
        <div className="bg-muted h-6 w-52 animate-pulse rounded" />
        <SellerDetailAgreementsSkeleton />
      </div>
    </div>
  )
}

export default SellerDetailPageSkeleton
