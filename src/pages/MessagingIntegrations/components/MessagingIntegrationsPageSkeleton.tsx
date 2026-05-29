/**
 * Skeleton loading state for Messaging Integrations — mirrors IntegrationCard layout.
 */

function IntegrationCardSkeleton({ channelRows = 2 }: { channelRows?: number }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="h-6 w-44 max-w-[70%] animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-28 shrink-0 animate-pulse rounded-full bg-gray-200" />
      </div>

      <div className="bg-light-50/70 mt-4 rounded-2xl border border-gray-200 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: channelRows }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
            >
              <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-11 animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="mt-3 h-3 w-full max-w-lg animate-pulse rounded bg-gray-200" />
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-gray-200" />
          <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
          <div className="ml-auto h-5 w-5 animate-pulse rounded bg-gray-200" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-36 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-16 animate-pulse rounded-md bg-gray-200" />
          <div className="h-8 w-16 animate-pulse rounded-md bg-gray-200" />
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
