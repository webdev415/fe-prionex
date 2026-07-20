export function BulkDocumentImportPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Title + subtitle */}
      <div className="space-y-2">
        <div className="h-8 w-72 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-gray-200" />
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        {/* Two dropdowns (agreement + document type) */}
        {[0, 1].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-11 w-full animate-pulse rounded-md bg-gray-200" />
          </div>
        ))}

        {/* Archive upload area (with Download-Template button) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-44 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
          </div>
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 bg-white/70 p-8">
            <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
            <div className="h-4 w-56 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
        </div>

        {/* Start button */}
        <div className="flex justify-end">
          <div className="h-10 w-32 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

export default BulkDocumentImportPageSkeleton
