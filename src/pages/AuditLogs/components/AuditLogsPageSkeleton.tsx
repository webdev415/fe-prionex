/**
 * AuditLogsPageSkeleton Component
 *
 * Skeleton loading component for the Audit Logs page.
 * Matches the AuditLogsPage structure with animated placeholders.
 * Includes responsive design matching the actual page layout.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 6
const ITEMS_PER_PAGE = 10

export function AuditLogsPageSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Page Header Skeleton */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-7 w-32 animate-pulse rounded bg-gray-200 sm:h-8 sm:w-40" />
        <div className="h-[45px] w-full animate-pulse rounded-full bg-gray-200 sm:w-40" />
      </div>

      {/* Search & Filters Skeleton */}
      <div className="mb-4 flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-3 sm:p-6">
        <div className="flex flex-col items-center gap-4 self-stretch sm:gap-6">
          {/* Advanced Filters Section */}
          <div className="flex flex-col items-center gap-4 self-stretch sm:gap-7">
            {/* Date Range and Quick Ranges */}
            <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:gap-10">
              {/* Date Range Skeleton */}
              <div className="flex flex-1 flex-col gap-2 self-stretch sm:items-end sm:gap-5">
                <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3">
                  <div className="h-4 w-24 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-[100px]" />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-9 w-full flex-1 animate-pulse rounded-md bg-gray-200" />
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-gray-200" />
                    <div className="h-9 w-full flex-1 animate-pulse rounded-md bg-gray-200" />
                  </div>
                </div>
              </div>
              {/* Quick Ranges Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:gap-3 xl:flex-1">
                <div className="h-4 w-24 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5 sm:w-[100px]" />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:items-center sm:gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-9 flex-1 animate-pulse rounded-md bg-gray-200 sm:px-4"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="h-px w-full bg-gray-200" />
            {/* Filters Row 1: User, Action, Entity */}
            <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-6 lg:gap-10">
              {/* User Filter Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5" />
                <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
              </div>
              {/* Action Filter Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5" />
                <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
              </div>
              {/* Entity Filter Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5" />
                <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
              </div>
            </div>
            {/* Filters Row 2: Role, Search, Buttons */}
            <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-6 lg:gap-10">
              {/* Role Filter Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5" />
                <div className="h-[45px] w-full animate-pulse rounded-md bg-gray-200" />
              </div>
              {/* Search Input Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
                <div className="h-4 w-12 shrink-0 animate-pulse rounded bg-gray-200 sm:h-5" />
                <div className="h-[45px] w-full flex-1 animate-pulse rounded-md bg-gray-200" />
              </div>
              {/* Action Buttons Skeleton */}
              <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-end sm:gap-4 lg:flex-1 lg:gap-6">
                <div className="h-[45px] w-full animate-pulse rounded bg-gray-200 sm:flex-1" />
                <div className="h-[45px] w-full animate-pulse rounded bg-gray-200 sm:flex-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Audit Logs Table Skeleton */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden rounded-xl bg-white/50 p-3 sm:gap-6 sm:p-6">
          <TableSkeleton columns={TABLE_COLUMNS} rows={ITEMS_PER_PAGE} className="w-full" />

          {/* Pagination Skeleton */}
          <div className="flex w-full items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              ))}
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuditLogsPageSkeleton
