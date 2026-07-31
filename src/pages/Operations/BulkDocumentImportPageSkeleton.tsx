export function BulkDocumentImportPageSkeleton() {
  return (
    <div className="flex w-full flex-col">
      {/* Header skeleton */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="bg-muted h-7 w-full animate-pulse rounded sm:h-8 sm:w-80" />
        <div className="bg-muted h-10 w-full animate-pulse rounded-full sm:h-12 sm:w-48" />
      </div>

      {/* Content skeleton */}
      <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
        <div className="space-y-5">
          {/* Two dropdowns (agreement + document type) */}
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="bg-muted-foreground/25 h-4 w-40 animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-11 w-full animate-pulse rounded-md" />
            </div>
          ))}

          {/* Archive upload area (with Download-Template button) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="bg-muted-foreground/25 h-4 w-44 animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-8 w-36 animate-pulse rounded-md" />
            </div>
            <div className="border-border flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8">
              <div className="bg-muted-foreground/25 h-8 w-8 animate-pulse rounded-full" />
              <div className="bg-muted-foreground/25 h-4 w-56 animate-pulse rounded" />
            </div>
            <div className="bg-muted-foreground/25 h-3 w-3/4 animate-pulse rounded" />
          </div>

          {/* Start button */}
          <div className="flex justify-end">
            <div className="bg-muted-foreground/25 h-10 w-32 animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default BulkDocumentImportPageSkeleton
