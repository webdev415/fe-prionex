/**
 * Skeleton loading state for Messaging Integrations — mirrors IntegrationCard layout.
 */

function IntegrationCardSkeleton({ channelRows = 2 }: { channelRows?: number }) {
  return (
    <div className="border-border bg-card/70 rounded-2xl border p-5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="bg-muted h-6 w-44 max-w-[70%] animate-pulse rounded" />
        <div className="bg-muted h-6 w-28 shrink-0 animate-pulse rounded-full" />
      </div>

      <div className="bg-muted/70 border-border mt-4 rounded-2xl border p-4">
        <div className="bg-muted h-3 w-20 animate-pulse rounded" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: channelRows }).map((_, index) => (
            <div
              key={index}
              className="border-border bg-card flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5"
            >
              <div className="bg-muted h-4 w-14 animate-pulse rounded" />
              <div className="bg-muted h-6 w-11 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
        <div className="bg-muted mt-3 h-3 w-full max-w-lg animate-pulse rounded" />
      </div>

      <div className="border-border mt-4 rounded-2xl border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-7 w-7 shrink-0 animate-pulse rounded-full" />
          <div className="bg-muted h-3 w-28 animate-pulse rounded" />
          <div className="bg-muted ml-auto h-5 w-5 animate-pulse rounded" />
        </div>
      </div>

      <div className="border-border mt-5 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="bg-muted h-3 w-24 animate-pulse rounded" />
          <div className="bg-muted mt-1 h-4 w-36 animate-pulse rounded" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="bg-muted h-8 w-16 animate-pulse rounded-md" />
          <div className="bg-muted h-8 w-16 animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  )
}

const CARD_CHANNEL_ROWS = [1, 1, 2, 1, 1] as const

export function MessagingIntegrationsPageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {CARD_CHANNEL_ROWS.map((channelRows, index) => (
        <IntegrationCardSkeleton key={index} channelRows={channelRows} />
      ))}
    </div>
  )
}

export default MessagingIntegrationsPageSkeleton
