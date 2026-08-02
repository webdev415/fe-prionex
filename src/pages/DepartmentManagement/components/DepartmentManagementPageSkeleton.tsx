/**
 * DepartmentManagementPageSkeleton Component
 *
 * Full page skeleton for the department management page.
 * Includes header, project selector, and table skeleton.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 4 // Name, Description, Assigned Roles, Actions

/** Table-area skeleton when project changes while header and project select stay mounted. */
export function DepartmentManagementTablesSkeleton() {
  return (
    <div className="space-y-8">
      <section className="bg-card/50 rounded-xl p-6">
        <div className="bg-muted mb-3 h-7 w-44 animate-pulse rounded" />
        <TableSkeleton columns={TABLE_COLUMNS} rows={5} />
      </section>
    </div>
  )
}

export function DepartmentManagementPageSkeleton() {
  return (
    <div>
      {/* Header Skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-[45px] w-[160px] animate-pulse rounded-full" />
      </div>

      {/* Project Selector Skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted h-7 w-16 animate-pulse rounded" />
        <div className="bg-muted h-7 w-48 animate-pulse rounded" />
      </div>

      <DepartmentManagementTablesSkeleton />
    </div>
  )
}

export default DepartmentManagementPageSkeleton
