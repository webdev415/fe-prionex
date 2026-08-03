import { CallLogCardSkeleton, type CallLogCardSkeletonVariant } from './CallLogCardSkeleton'

function MessagingStatCardSkeleton({ wideValue = false }: { wideValue?: boolean }) {
  return (
    <div className="border-border bg-card/50 flex w-full flex-1 items-center justify-between rounded-xl border px-4 py-4 pl-3 md:w-auto md:px-5">
      <div className="bg-muted-foreground/25 h-4 w-28 max-w-[45%] animate-pulse rounded sm:w-32" />
      <div
        className={
          wideValue
            ? 'bg-muted-foreground/25 h-4 w-24 max-w-[50%] animate-pulse rounded sm:w-40'
            : 'bg-muted-foreground/25 h-4 w-10 shrink-0 animate-pulse rounded'
        }
      />
    </div>
  )
}

function MessagingDateGroupSkeleton({
  cards = 2,
  variants,
}: {
  cards?: number
  variants?: CallLogCardSkeletonVariant[]
}) {
  return (
    <div className="w-full space-y-4">
      <div className="bg-muted-foreground/25 h-4 w-24 animate-pulse rounded md:h-5 md:w-28" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {Array.from({ length: cards }).map((_, index) => (
          <CallLogCardSkeleton key={index} variant={variants?.[index] ?? 'message'} />
        ))}
      </div>
    </div>
  )
}

/** Card grid with date headers (messaging tab content and “All” tab while history loads). */
export function MessagingHistorySkeleton({
  dateGroups = 2,
  cardsPerGroup = 2,
  mixedCards = false,
}: {
  dateGroups?: number
  cardsPerGroup?: number
  /** When true, alternates call/message card shapes (fits the combined Calls/SMS/Messaging tab). */
  mixedCards?: boolean
}) {
  return (
    <div className="w-full space-y-6">
      {Array.from({ length: dateGroups }).map((_, groupIndex) => {
        const variants: CallLogCardSkeletonVariant[] | undefined = mixedCards
          ? Array.from({ length: cardsPerGroup }).map((_, i) =>
              (groupIndex + i) % 2 === 0 ? 'message' : 'call'
            )
          : undefined

        return (
          <MessagingDateGroupSkeleton key={groupIndex} cards={cardsPerGroup} variants={variants} />
        )
      })}
    </div>
  )
}

/** Stats row + date-grouped cards for the dedicated Messaging tab while history loads. */
export function MessagingTabSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-4 self-stretch">
      <div className="flex h-auto w-full flex-col items-start gap-3 p-0 md:h-14 md:flex-row md:gap-5">
        <MessagingStatCardSkeleton />
        <MessagingStatCardSkeleton wideValue />
      </div>
      <MessagingHistorySkeleton dateGroups={2} cardsPerGroup={2} mixedCards={false} />
    </div>
  )
}

export default MessagingHistorySkeleton
