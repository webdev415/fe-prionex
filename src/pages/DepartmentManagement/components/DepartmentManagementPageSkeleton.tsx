/**
 * DepartmentManagementPageSkeleton Component
 *
 * Full page skeleton for the department management page.
 * Includes header, project selector, and table skeleton.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 4 // Name, Description, Assigned Roles, Actions

export function DepartmentManagementPageSkeleton() {
  return (
    <div>
      {/* Header Skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 animate-pulse rounded bg-gray-300" />
        </div>
        <div className="h-[45px] w-[160px] animate-pulse rounded-full bg-gray-300" />
      </div>

      {/* Project Selector Skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-7 w-16 animate-pulse rounded bg-gray-300" />
        <div className="h-7 w-48 animate-pulse rounded bg-gray-300" />
      </div>

      {/* Table Section Skeleton */}
      <div className="space-y-8">
        <section className="rounded-xl bg-white/50 p-6">
          <div className="mb-3 h-7 w-44 animate-pulse rounded bg-gray-300" />
          <TableSkeleton columns={TABLE_COLUMNS} rows={5} />
        </section>
      </div>
    </div>
  )
}

export default DepartmentManagementPageSkeleton
