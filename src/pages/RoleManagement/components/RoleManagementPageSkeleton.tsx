/**
 * RoleManagementPageSkeleton Component
 *
 * Full page skeleton for the role management page.
 * Includes header, project selector, and two table skeletons (Default Roles and Custom Roles).
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 4 // Role, Description, Users, Actions

export function RoleManagementPageSkeleton() {
  return (
    <div>
      {/* Header Skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-32 animate-pulse rounded bg-gray-300" />
        </div>
        <div className="h-[45px] w-[140px] animate-pulse rounded-full bg-gray-300" />
      </div>

      {/* Project Selector Skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-7 w-16 animate-pulse rounded bg-gray-300" />
        <div className="h-7 w-48 animate-pulse rounded bg-gray-300" />
      </div>

      {/* Two Table Sections Skeleton */}
      <div className="space-y-8">
        {/* Default Roles Section Skeleton */}
        <section className="rounded-xl bg-white/50 p-6">
          <div className="mb-3 h-7 w-40 animate-pulse rounded bg-gray-300" />
          <TableSkeleton columns={TABLE_COLUMNS} rows={3} />
        </section>

        {/* Custom Roles Section Skeleton */}
        <section className="rounded-xl bg-white/50 p-6">
          <div className="mb-3 h-7 w-40 animate-pulse rounded bg-gray-300" />
          <TableSkeleton columns={TABLE_COLUMNS} rows={5} />
        </section>
      </div>
    </div>
  )
}

export default RoleManagementPageSkeleton
