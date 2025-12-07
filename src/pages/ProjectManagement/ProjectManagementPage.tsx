/**
 * ProjectManagementPage Component
 *
 * Main page for managing projects.
 * Uses the same template as User Management page.
 */

import { useState } from 'react'
import { useProjects } from '@/features/projects'
import { CreateProjectModal } from './components/CreateProjectModal'
import { ProjectDetailModal } from './components/ProjectDetailModal'
import type { ApiProject } from '@/features/projects/types'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'

const ITEMS_PER_PAGE = 10

export function ProjectManagementPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  // Fetch projects with pagination
  const { data, isLoading, isError, error } = useProjects({
    page: currentPage,
    page_size: ITEMS_PER_PAGE,
  })

  const projects = data?.projects || []
  const totalPages = data?.pagination?.total_pages || 0

  const handleView = (project: ApiProject) => {
    // TODO: Implement view functionality
    setSelectedProjectId(project.id)
  }

  const handleEdit = (project: ApiProject) => {
    // TODO: Implement edit functionality
    // eslint-disable-next-line no-console
    console.log('Edit project:', project.id)
  }

  // Map status for StatusBadge component
  const getStatusType = (isActive: boolean): 'active' | 'disabled' => {
    return isActive ? 'active' : 'disabled'
  }

  // Table columns definition
  const columns: Column<ApiProject>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (project) => <span className="font-medium">{project.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (project) => <span className="font-medium">{project.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (project) => <span className="font-medium">{project.description || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (project) => <StatusBadge status={getStatusType(project.is_active)} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (project) => (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleView(project)}
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#05040D',
            }}
          >
            <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
            View
          </button>
          <button
            onClick={() => handleEdit(project)}
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#05040D',
            }}
          >
            <Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />
            Edit
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="font-light"
            style={{
              fontSize: '24px',
              fontWeight: 300,
              color: colors.neutral.dark[500],
            }}
          >
            Project Management
          </h1>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
          style={{
            backgroundColor: colors.secondary[800],
          }}
          aria-label="Add new project"
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: colors.primary[300],
              marginLeft: '4px',
            }}
          >
            <Icons.Add size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
          <span
            className="px-4 py-3 font-medium text-white"
            style={{
              fontSize: '14px',
            }}
          >
            Add New Project
          </span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && <TableSkeleton columns={columns.length} rows={ITEMS_PER_PAGE} />}

      {/* Error State */}
      {isError && (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p style={{ color: '#EF4444' }}>Error loading projects: {error?.message}</p>
        </div>
      )}

      {/* Projects Table */}
      {!isLoading && !isError && (
        <DataTable columns={columns} data={projects} emptyMessage="No projects found" />
      )}

      {/* Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      )}

      {selectedProjectId && (
        <ProjectDetailModal
          open={selectedProjectId !== null}
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
        />
      )}
    </div>
  )
}

export default ProjectManagementPage
