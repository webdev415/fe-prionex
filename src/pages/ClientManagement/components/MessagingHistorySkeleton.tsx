import { CallLogCardSkeleton } from './CallLogCardSkeleton'

export function MessagingHistorySkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {Array.from({ length: cards }).map((_, index) => (
        <CallLogCardSkeleton key={index} />
      ))}
    </div>
  )
}

/** Stats row + card grid for the dedicated Messaging tab while history loads. */
export function MessagingTabSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4 self-stretch">
      <div className="flex h-auto w-full flex-col items-start gap-3 p-0 md:h-14 md:flex-row md:gap-5">
        <div className="h-14 w-full flex-1 animate-pulse rounded-xl bg-gray-200 md:w-auto" />
        <div className="h-14 w-full flex-1 animate-pulse rounded-xl bg-gray-200 md:w-auto" />
      </div>
      <MessagingHistorySkeleton />
    </div>
  )
}

export default MessagingHistorySkeleton
