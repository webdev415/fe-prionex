/**
 * SmsTemplatesPageSkeleton Component
 *
 * Skeleton loading component for the SMS Templates page.
 * Matches the SmsTemplatesPage structure with animated placeholders.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 5
const ITEMS_PER_PAGE = 10

export function SmsTemplatesPageSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-5 pt-1 pr-7 pb-6 pl-7">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="h-12 w-40 animate-pulse rounded-full bg-gray-200" />
      </div>

      {/* Data Table Skeleton */}
      <div className="flex flex-col items-start gap-8 self-stretch">
        <TableSkeleton columns={TABLE_COLUMNS} rows={ITEMS_PER_PAGE} className="w-full" />
      </div>

      {/* Pagination Skeleton */}
      <div className="flex w-full items-center justify-between self-stretch">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
          ))}
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  )
}

export default SmsTemplatesPageSkeleton
