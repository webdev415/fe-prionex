/**
 * Loading skeleton for Contact Tags — mirrors the category DataTable plus
 * value-chip cards that appear under it once data loads.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

function Pulse({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? ''}`} />
}

function ValueCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-xl border p-3">
      <Pulse className="mb-3 h-4 w-40" />
      <div className="flex flex-wrap gap-2">
        <Pulse className="h-6 w-20 rounded-full" />
        <Pulse className="h-6 w-24 rounded-full" />
        <Pulse className="h-6 w-16 rounded-full" />
        <Pulse className="h-6 w-28 rounded-full" />
      </div>
    </div>
  )
}

export function ContactTagsPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <TableSkeleton columns={8} rows={5} />
      <ValueCardSkeleton />
      <ValueCardSkeleton />
    </div>
  )
}

export default ContactTagsPageSkeleton
