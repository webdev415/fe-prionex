/**
 * ProjectManagementPage Component
 *
 * Main page for managing projects.
 * Updated: 2025-12-08 - Added search/filters, new columns, side panel
 */

import { useState, useCallback, useMemo } from 'react'
import { useProjects, useProjectDetail } from '@/features/projects/hooks/useProjects'
import { useProjectExport } from '@/features/projects/hooks/useProjectMutations'
import { CreateProjectModal } from './components/CreateProjectModal'
import { EditProjectModal } from './components/EditProjectModal'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { SearchFiltersBar } from './components/SearchFiltersBar'
import type { ApiProject, ApiProjectDetail, ProjectFilters } from '@/features/projects/types'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import { formatPeriod, formatCurrency } from '@/lib/formatters'
import { DataTable, type Column, type SortConfig, type SortOrder } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'

const ITEMS_PER_PAGE = 10

export function ProjectManagementPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [editingProject, setEditingProject] = useState<ApiProjectDetail | null>(null)
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

  // Fetch selected project detail
  const { data: projectDetail, isLoading: isDetailLoading } = useProjectDetail(selectedProjectId)

  // Export mutation
  const exportMutation = useProjectExport()

  const projects = data?.projects || []
  const totalPages = data?.pagination?.total_pages || 0
  const totalItems = data?.pagination?.total_items || 0

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

  const handleEditClick = useCallback((project: ApiProject, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    setSelectedProjectId(project.id)
    // We'll open edit modal when projectDetail is loaded
  }, [])

  const handleEditFromPanel = useCallback(() => {
    if (projectDetail) {
      setEditingProject(projectDetail as ApiProjectDetail)
    }
  }, [projectDetail])

  const handleClosePanel = useCallback(() => {
    setSelectedProjectId(null)
  }, [])

  const handleManageUsersRoles = useCallback(() => {
    // TODO: Navigate to roles/users management for this project
    console.log('Navigate to users/roles management for project:', selectedProjectId)
  }, [selectedProjectId])

  const handleEditSuccess = useCallback(() => {
    setEditingProject(null)
    refetch()
  }, [refetch])

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false)
    refetch()
  }, [refetch])

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
            className="flex items-center justify-center rounded-full text-sm font-medium"
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: colors.gray[100],
              color: colors.gray[700],
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
          <span className="font-medium" style={{ color: colors.gray[900] }}>
            {project.name}
          </span>
          <span className="text-xs" style={{ color: colors.gray[500] }}>
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
          style={{ color: colors.gray[700] }}
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
        <span style={{ color: colors.gray[700] }}>
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
        <span className="font-medium" style={{ color: colors.gray[900] }}>
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
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      sortable: false,
      render: (project) => (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedProjectId(project.id)
            }}
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: colors.gray[700],
            }}
          >
            <Icons.View size={16} color={colors.gray[700]} strokeWidth={1.5} />
            View
          </button>
          <button
            onClick={(e) => handleEditClick(project, e)}
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: colors.gray[700],
            }}
          >
            <Icons.PencilEdit size={16} color={colors.gray[700]} strokeWidth={1.5} />
            Edit
          </button>
        </div>
      ),
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
            <div className="flex-1 overflow-y-auto">
              <DataTable
                columns={columns}
                data={projects}
                emptyMessage="No projects found"
                onRowClick={handleRowClick}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            </div>
          )}

          {/* Pagination & Info */}
          {!isLoading && !isError && (
            <div
              className="flex items-center justify-between border-t py-4"
              style={{ borderColor: colors.gray[200] }}
            >
              <span className="text-sm" style={{ color: colors.gray[600] }}>
                Showing {projects.length} of {totalItems} projects
              </span>
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          )}
        </div>

        {/* Side Panel */}
        <ProjectDetailPanel
          project={projectDetail as ApiProjectDetail | null}
          isOpen={selectedProjectId !== null}
          onClose={handleClosePanel}
          onEdit={handleEditFromPanel}
          onManageUsersRoles={handleManageUsersRoles}
          isLoading={isDetailLoading}
        />
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProjectModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Edit Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          open={editingProject !== null}
          onClose={() => setEditingProject(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  )
}

export default ProjectManagementPage
