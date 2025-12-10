/**
 * ProjectManagementPage Component
 *
 * Main page for managing projects.
 * Updated: 2025-12-08 - Added search/filters, new columns, side panel
 */

import { useState, useCallback, useMemo } from 'react'
import { useProjects, useProjectDetail } from '@/features/projects/hooks/useProjects'
import { useProjectExport, useDeleteProject } from '@/features/projects/hooks/useProjectMutations'
import { EditProjectModal } from './components/EditProjectModal'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { DeleteProjectConfirmationModal } from './components/DeleteProjectConfirmationModal'
import { SearchFiltersBar } from './components/SearchFiltersBar'
import type { ApiProject, ApiProjectDetail, ProjectFilters } from '@/features/projects/types'
import { colors } from '@/lib/colors'
import { formatPeriod, formatCurrency } from '@/lib/formatters'
import { DataTable, type Column, type SortConfig, type SortOrder } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/ui/Pagination'

const ITEMS_PER_PAGE = 10

export function ProjectManagementPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [editingProject, setEditingProject] = useState<ApiProjectDetail | null>(null)
  const [deletingProject, setDeletingProject] = useState<ApiProjectDetail | null>(null)
  const [filters, setFilters] = useState<ProjectFilters>({
    status: 'active',
  })
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'created_at',
    order: 'desc',
  })

  // Fetch projects with pagination, filters, and sorting
  const { data, isLoading, isError, error, refetch } = useProjects({
    page: currentPage,
    page_size: ITEMS_PER_PAGE,
    ...filters,
    sort_by: sortConfig.key,
    sort_order: sortConfig.order,
  })

  // Memoize projects to avoid dependency issues
  const projects = useMemo(() => data?.projects || [], [data?.projects])
  const totalPages = data?.pagination?.total_pages || 0

  // Compute the effective selected project ID - auto-select first project if none selected
  const effectiveSelectedProjectId = useMemo(() => {
    if (selectedProjectId !== null) {
      return selectedProjectId
    }
    if (projects.length > 0) {
      return projects[0].id
    }
    return null
  }, [selectedProjectId, projects])

  // Fetch selected project detail using effective ID
  const { data: projectDetail, isLoading: isDetailLoading } = useProjectDetail(effectiveSelectedProjectId)

  // Export mutation
  const exportMutation = useProjectExport()
  
  // Delete mutation
  const deleteMutation = useDeleteProject()

  // Extract unique client companies for filter
  const clientCompanies = useMemo(() => {
    const companies = new Set<string>()
    projects.forEach((p) => {
      if (p.client_company) companies.add(p.client_company)
    })
    return Array.from(companies).sort()
  }, [projects])

  const handleFilterChange = useCallback((newFilters: ProjectFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page on filter change
  }, [])

  const handleSort = useCallback((key: string, order: SortOrder) => {
    setSortConfig({ key, order })
    setCurrentPage(1) // Reset to first page on sort change
  }, [])

  const handleExport = useCallback(() => {
    exportMutation.mutate({
      format: 'csv',
      ...filters,
    })
  }, [exportMutation, filters])

  const handleRowClick = useCallback((project: ApiProject) => {
    setSelectedProjectId(project.id)
  }, [])

  const handleEditFromPanel = useCallback(() => {
    if (projectDetail) {
      setEditingProject(projectDetail as ApiProjectDetail)
    }
  }, [projectDetail])

  const handleEditSuccess = useCallback(() => {
    setEditingProject(null)
    refetch()
  }, [refetch])

  const handleDeleteFromPanel = useCallback(() => {
    if (projectDetail) {
      setDeletingProject(projectDetail as ApiProjectDetail)
    }
  }, [projectDetail])

  const handleDeleteConfirm = useCallback(() => {
    if (deletingProject) {
      deleteMutation.mutate(
        { projectId: deletingProject.id },
        {
          onSuccess: () => {
            setDeletingProject(null)
            setSelectedProjectId(null)
            refetch()
          },
        }
      )
    }
  }, [deletingProject, deleteMutation, refetch])

  const handleDeleteCancel = useCallback(() => {
    setDeletingProject(null)
  }, [])

  // Map status for StatusBadge component
  const getStatusType = (status: string): 'active' | 'disabled' | 'inactive' | 'archived' => {
    switch (status) {
      case 'active':
        return 'active'
      case 'archived':
        return 'archived'
      case 'inactive':
        return 'inactive'
      default:
        return 'disabled'
    }
  }

  // Table columns definition - updated with new columns and sorting
  const columns: Column<ApiProject>[] = [
    {
      key: 'user_count',
      header: 'Users',
      align: 'center',
      sortable: true,
      render: (project) => (
        <div className="flex items-center justify-center">
          <span
            className="flex items-center justify-center"
            style={{
              color: colors.neutral.dark[500],
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {project.user_count || 0}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Project / Code',
      sortable: true,
      render: (project) => (
        <div className="flex flex-col">
          <span style={{ color: colors.neutral.dark[500], fontSize: '12px', fontWeight: 500 }}>
            {project.name}
          </span>
          <span style={{ color: colors.gray[700], fontSize: '12px', fontWeight: 500 }}>
            {project.code}
          </span>
        </div>
      ),
    },
    {
      key: 'client_company',
      header: 'Client',
      sortable: true,
      render: (project) => (
        <span
          className="block max-w-[180px] truncate"
          title={project.client_company}
          style={{ color: colors.neutral.dark[500], fontSize: '12px', fontWeight: 500 }}
        >
          {project.client_company || '—'}
        </span>
      ),
    },
    {
      key: 'start_date',
      header: 'Period',
      sortable: true,
      render: (project) => (
        <span style={{ color: colors.neutral.dark[500], fontSize: '12px', fontWeight: 500 }}>
          {formatPeriod(project.start_date, project.end_date)}
        </span>
      ),
    },
    {
      key: 'total_debt_amount',
      header: 'Debt',
      align: 'right',
      sortable: true,
      render: (project) => (
        <span style={{ color: colors.neutral.dark[500], fontSize: '12px', fontWeight: 500 }}>
          {formatCurrency(project.total_debt_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortable: true,
      render: (project) => <StatusBadge status={getStatusType(project.status)} />,
    },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
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

      {/* Search & Filters */}
      <SearchFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onExport={handleExport}
        clients={clientCompanies}
        isLoading={isLoading || exportMutation.isPending}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Loading State */}
          {isLoading && <TableSkeleton columns={columns.length} rows={ITEMS_PER_PAGE} />}

          {/* Error State */}
          {isError && (
            <ErrorState error={error} onRetry={() => refetch()} title="Error loading projects" />
          )}

          {/* Projects Table */}
          {!isLoading && !isError && (
            <div className="flex flex-1 flex-col">
              <div
                className="flex-1 overflow-y-auto flex items-start justify-between w-full"
              >
                <div className='w-[70%]'>
                  <div
                    className="rounded-xl p-6"
                    style={{
                      backgroundColor: '#FFFFFF80',
                    }}
                  >
                    <DataTable
                      columns={columns}
                      data={projects}
                      emptyMessage="No projects found"
                      onRowClick={handleRowClick}
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </div>
                </div>
                <div className='w-[30%] pl-4'>
                  {/* Side Panel */}
                  <ProjectDetailPanel
                    project={projectDetail as ApiProjectDetail | null}
                    hasProjects={projects.length > 0}
                    onEdit={handleEditFromPanel}
                    onDelete={handleDeleteFromPanel}
                    isLoading={effectiveSelectedProjectId !== null && isDetailLoading}
                  />
                </div>
              </div>
              
              {/* Pagination */}
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Edit Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          open={editingProject !== null}
          onClose={() => setEditingProject(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <DeleteProjectConfirmationModal
          open={deletingProject !== null}
          projectName={deletingProject.name}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

export default ProjectManagementPage
