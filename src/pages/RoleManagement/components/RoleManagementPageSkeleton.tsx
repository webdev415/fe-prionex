/**
 * RoleManagementPageSkeleton Component
 *
 * Full page skeleton for the role management page.
 * Includes header, project selector, and two table skeletons (Default Roles and Custom Roles).
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 4 // Role, Description, Users, Actions

/** Skeleton for the two role tables only (used when project changes while chrome stays mounted). */
export function RoleManagementTablesSkeleton() {
  return (
    <div className="space-y-8">
      <section className="bg-card/50 rounded-xl p-6">
        <div className="bg-muted mb-3 h-7 w-40 animate-pulse rounded" />
        <TableSkeleton columns={TABLE_COLUMNS} rows={3} />
      </section>
      <section className="bg-card/50 rounded-xl p-6">
        <div className="bg-muted mb-3 h-7 w-40 animate-pulse rounded" />
        <TableSkeleton columns={TABLE_COLUMNS} rows={5} />
      </section>
    </div>
  )
}

export function RoleManagementPageSkeleton() {
  return (
    <div>
      {/* Header Skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        </div>
        <div className="bg-muted h-[45px] w-[140px] animate-pulse rounded-full" />
      </div>

      {/* Project Selector Skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted h-7 w-16 animate-pulse rounded" />
        <div className="bg-muted h-7 w-48 animate-pulse rounded" />
      </div>

      <RoleManagementTablesSkeleton />
    </div>
  )
}

export default RoleManagementPageSkeleton
