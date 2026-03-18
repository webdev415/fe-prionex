/**
 * ProjectManagementPageSkeleton Component
 *
 * Full page skeleton for the project management page.
 * Includes table skeleton and detail panel skeleton in the correct layout.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ProjectDetailPanelSkeleton } from './ProjectDetailPanelSkeleton'

const ITEMS_PER_PAGE = 10
const TABLE_COLUMNS = 6

export function ProjectManagementPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Table Container - full width on mobile, 70% on desktop */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white/50">
            <div className="flex-1 overflow-auto lg:p-6">
              <TableSkeleton columns={TABLE_COLUMNS} rows={ITEMS_PER_PAGE} />
            </div>
          </div>
        </div>

        {/* Side Panel - hidden on mobile, visible on desktop */}
        <div className="hidden min-w-0 flex-col lg:flex lg:w-[30%] lg:self-stretch">
          <div className="flex h-full overflow-hidden">
            <ProjectDetailPanelSkeleton />
          </div>
        </div>
      </div>

      {/* Pagination Skeleton */}
      <div className="mt-4 shrink-0">
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 w-10 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default ProjectManagementPageSkeleton
