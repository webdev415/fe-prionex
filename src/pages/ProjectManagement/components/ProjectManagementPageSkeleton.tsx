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
      <div className="flex w-full flex-1 items-start justify-between overflow-y-auto">
        {/* Table Area (70%) */}
        <div className="w-[70%]">
          <div className="rounded-xl bg-white/50 p-6">
            <TableSkeleton columns={TABLE_COLUMNS} rows={ITEMS_PER_PAGE} />
          </div>
        </div>

        {/* Side Panel Area (30%) */}
        <div className="w-[30%] pl-4">
          <ProjectDetailPanelSkeleton />
        </div>
      </div>

      {/* Pagination Skeleton */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 w-10 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    </div>
  )
}

export default ProjectManagementPageSkeleton
