/**
 * Loading skeleton for the operator dialer two-column layout.
 * Mirrors CampaignList (left) + detail panel (right) so the page does not
 * jump when real data arrives.
 */

function Pulse({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? ''}`} />
}

function CampaignRowSkeleton() {
  return (
    <div className="border-border border-b px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-3 w-16" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Pulse className="h-3 w-24" />
        <Pulse className="h-3 w-20" />
        <Pulse className="h-3 w-28" />
        <Pulse className="h-3 w-24" />
      </div>
    </div>
  )
}

export function OperatorDialerSkeleton() {
  return (
    <>
      <aside className="border-border bg-card/60 flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border lg:min-h-0">
        <div className="bg-card flex shrink-0 items-start justify-between gap-2 p-4 pb-3">
          <div className="flex flex-col gap-2">
            <Pulse className="h-4 w-28" />
            <Pulse className="h-3 w-48" />
          </div>
          <Pulse className="h-6 w-20 rounded-full" />
        </div>
        <div className="border-border bg-card flex-1 border-t">
          {Array.from({ length: 5 }).map((_, i) => (
            <CampaignRowSkeleton key={i} />
          ))}
        </div>
      </aside>

      <section className="bg-card/60 flex h-full min-h-[280px] flex-col rounded-xl p-4 sm:p-6 lg:min-h-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Pulse className="h-4 w-24" />
            <Pulse className="h-7 w-40 rounded-full" />
          </div>
          <Pulse className="h-10 w-32 rounded-lg" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Pulse className="h-3 w-16" />
              <Pulse className="h-5 w-12" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3">
          <Pulse className="h-10 w-10 rounded-full" />
          <Pulse className="h-4 w-56" />
        </div>
      </section>
    </>
  )
}

export default OperatorDialerSkeleton
