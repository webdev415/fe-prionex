/**
 * ProjectManagementPage Component
 *
 * Main page for managing projects.
 * Updated: 2025-12-08 - Added search/filters, new columns, side panel
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjects, useProjectDetail } from '@/features/projects/hooks/useProjects'
import { useProjectExport, useDeleteProject } from '@/features/projects/hooks/useProjectMutations'
import { EditProjectModal } from './components/EditProjectModal'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { ProjectDetailModal } from './components/ProjectDetailModal'
import { DeleteProjectConfirmationModal } from './components/DeleteProjectConfirmationModal'
import { SearchFiltersBar } from './components/SearchFiltersBar'
import type { ApiProject, ApiProjectDetail, ProjectFilters } from '@/features/projects/types'
import { formatPeriod, formatCurrency } from '@/lib/formatters'
import { DataTable, type Column, type SortConfig, type SortOrder } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { ProjectManagementPageSkeleton } from './components/ProjectManagementPageSkeleton'

const DEFAULT_PAGE_SIZE = 10

export function ProjectManagementPage() {
  const { t } = useTranslation('common')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024) // lg breakpoint
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Track screen size to determine if we're on mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      // Close modal when transitioning from mobile to desktop
      if (!mobile && showDetailModal) {
        setShowDetailModal(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [showDetailModal])

  // Fetch projects with pagination, filters, and sorting
  const { data, isLoading, isError, error, refetch } = useProjects({
    page: currentPage,
    page_size: pageSize,
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
  const { data: projectDetail, isLoading: isDetailLoading } = useProjectDetail(
    effectiveSelectedProjectId
  )

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

  const handleRowClick = useCallback(
    (project: ApiProject) => {
      setSelectedProjectId(project.id)
      // Show modal on mobile, panel is automatically shown on desktop
      if (isMobile) {
        setShowDetailModal(true)
      }
    },
    [isMobile]
  )

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
      header: t('pages.projects.tableHeaders.users'),
      align: 'center',
      sortable: true,
      render: (project) => (
        <div className="flex items-center justify-center">
          <span className="text-dark-500 flex items-center justify-center text-xs font-medium">
            {project.user_count || 0}
          </span>
        </div>
      ),
    },
    {
      key: 'name',
      header: t('pages.projects.tableHeaders.projectCode'),
      sortable: true,
      render: (project) => (
        <div className="flex flex-col">
          <span className="text-dark-500 text-xs font-medium">{project.name}</span>
          <span className="text-xs font-medium text-gray-700">{project.code}</span>
        </div>
      ),
    },
    {
      key: 'client_company',
      header: t('pages.projects.tableHeaders.client'),
      sortable: true,
      render: (project) => (
        <span
          className="text-dark-500 block max-w-[180px] truncate text-xs font-medium"
          title={project.client_company}
        >
          {project.client_company || '—'}
        </span>
      ),
    },
    {
      key: 'start_date',
      header: t('pages.projects.tableHeaders.period'),
      sortable: true,
      render: (project) => (
        <span className="text-dark-500 text-xs font-medium">
          {formatPeriod(project.start_date, project.end_date)}
        </span>
      ),
    },
    {
      key: 'total_debt_amount',
      header: t('pages.projects.tableHeaders.debt'),
      align: 'right',
      sortable: true,
      render: (project) => (
        <span className="text-dark-500 text-xs font-medium">
          {formatCurrency(project.total_debt_amount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('pages.projects.tableHeaders.status'),
      align: 'center',
      sortable: true,
      render: (project) => <StatusBadge status={getStatusType(project.status)} />,
    },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.projects.title')}
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
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Loading State */}
        {isLoading && <ProjectManagementPageSkeleton />}

        {/* Error State */}
        {!isLoading && isError && (
          <div className="flex flex-1 flex-col">
            <ErrorState
              error={error}
              onRetry={() => refetch()}
              title={t('pages.projects.errorLoading')}
            />
          </div>
        )}

        {/* Projects Table */}
        {!isLoading && !isError && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 gap-4 overflow-hidden">
              {/* Table Container */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white/50">
                  <div className="flex-1 overflow-auto lg:p-6">
                    <DataTable
                      columns={columns}
                      data={projects}
                      emptyMessage={t('pages.projects.noProjectsFound')}
                      onRowClick={handleRowClick}
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </div>
                </div>
              </div>
              {/* Side Panel - hidden on mobile, visible on desktop */}
              <div className="hidden min-w-0 flex-col lg:flex lg:w-[30%] lg:self-stretch">
                <div className="flex h-full overflow-hidden">
                  <ProjectDetailPanel
                    project={projectDetail as ApiProjectDetail | null}
                    hasProjects={projects.length > 0}
                    onEdit={handleEditFromPanel}
                    onDelete={handleDeleteFromPanel}
                    isLoading={effectiveSelectedProjectId !== null && isDetailLoading}
                  />
                </div>
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-4 shrink-0">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setCurrentPage(1) // Reset to first page when changing page size
                }}
              />
            </div>
          </div>
        )}
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

      {/* Project Detail Modal - shown on mobile when project is clicked */}
      {showDetailModal && (
        <ProjectDetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          project={projectDetail as ApiProjectDetail | null}
          hasProjects={projects.length > 0}
          onEdit={handleEditFromPanel}
          onDelete={handleDeleteFromPanel}
          isLoading={effectiveSelectedProjectId !== null && isDetailLoading}
        />
      )}
    </div>
  )
}

export default ProjectManagementPage
