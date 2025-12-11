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
          <div className="h-7 w-40 animate-pulse rounded" style={{ backgroundColor: '#D1D5DB' }} />
        </div>
        <div
          className="h-12 w-32 animate-pulse rounded-full"
          style={{ backgroundColor: '#D1D5DB' }}
        />
      </div>

      {/* Project Selector Skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-6 w-16 animate-pulse rounded" style={{ backgroundColor: '#D1D5DB' }} />
        <div className="h-6 w-48 animate-pulse rounded" style={{ backgroundColor: '#D1D5DB' }} />
      </div>

      {/* Two Table Sections Skeleton */}
      <div className="space-y-8">
        {/* Default Roles Section Skeleton */}
        <section
          className="rounded-xl"
          style={{
            backgroundColor: '#FFFFFF80',
            padding: '24px',
          }}
        >
          <div
            className="mb-3 h-6 w-32 animate-pulse rounded"
            style={{ backgroundColor: '#D1D5DB' }}
          />
          <TableSkeleton columns={TABLE_COLUMNS} rows={3} />
        </section>

        {/* Custom Roles Section Skeleton */}
        <section
          className="rounded-xl"
          style={{
            backgroundColor: '#FFFFFF80',
            padding: '24px',
          }}
        >
          <div
            className="mb-3 h-6 w-32 animate-pulse rounded"
            style={{ backgroundColor: '#D1D5DB' }}
          />
          <TableSkeleton columns={TABLE_COLUMNS} rows={5} />
        </section>
      </div>
    </div>
  )
}

export default RoleManagementPageSkeleton
