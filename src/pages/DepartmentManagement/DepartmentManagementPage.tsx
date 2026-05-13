/**
 * DepartmentManagementPage Component
 *
 * Main page for managing departments within projects.
 * Similar to Role Management but for departments with project isolation.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDepartments } from '@/features/departments'
import type { Department } from '@/features/departments/types'
import { useProjects } from '@/features/projects'
import {
  DataTable,
  type Column,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { ErrorState } from '@/components/ErrorState'
import { Icons } from '@/lib/icons'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import {
  CreateDepartmentModal,
  DepartmentDetailModal,
  EditDepartmentModal,
  ArchiveDepartmentModal,
  DepartmentManagementPageSkeleton,
  DepartmentManagementTablesSkeleton,
} from './components'

export function DepartmentManagementPage() {
  const { t } = useTranslation('common')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null)
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null)
  const [archiveDepartmentId, setArchiveDepartmentId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [openDropdownDepartmentId, setOpenDropdownDepartmentId] = useState<number | null>(null)

  // Fetch all projects for dropdown
  const { data: projectsData, isLoading: loadingProjects } = useProjects({
    page: 1,
    page_size: 100,
    status: 'active',
  })
  const projects = useMemo(() => projectsData?.projects || [], [projectsData?.projects])

  // Set default project when projects load
  const initialProjectId = useMemo(() => {
    if (!selectedProjectId && projects.length > 0 && projects[0]) {
      return projects[0].id
    }
    return selectedProjectId
  }, [projects, selectedProjectId])

  useEffect(() => {
    if (initialProjectId !== selectedProjectId) {
      setSelectedProjectId(initialProjectId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId])

  // Close dropdown when screen size crosses breakpoint
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      if (wasMobile !== isMobile && openDropdownDepartmentId !== null) {
        setOpenDropdownDepartmentId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownDepartmentId])

  const {
    data,
    isPending: departmentsPending,
    isError,
    error,
    refetch,
  } = useDepartments({
    page: 1,
    page_size: 100,
    project_id: selectedProjectId || undefined,
    is_active: true,
  })

  const departments = data?.departments || []

  const columns: Column<Department>[] = [
    {
      key: 'name',
      header: t('pages.departments.tableHeaders.name'),
      render: (department) => <span className="font-medium">{department.name}</span>,
    },
    {
      key: 'description',
      header: t('pages.departments.tableHeaders.description'),
      render: (department) => <span className="font-medium">{department.description || '—'}</span>,
    },
    {
      key: 'assigned_roles_count',
      header: t('pages.departments.tableHeaders.assignedRoles'),
      align: 'center',
      render: (department) => <span>{department.assigned_roles_count || 0}</span>,
    },
    {
      key: 'actions',
      header: t('pages.departments.tableHeaders.actions'),
      align: 'center',
      render: (department) => (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Desktop: Individual buttons */}
          <div className="hidden items-center gap-4 lg:flex">
            <button
              type="button"
              onClick={() => setSelectedDepartmentId(department.id)}
              className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            >
              <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
              {t('pages.departments.actions.view')}
            </button>
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
              <button
                type="button"
                className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                onClick={() => setEditDepartmentId(department.id)}
              >
                <Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />
                {t('pages.departments.actions.edit')}
              </button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
              <button
                type="button"
                className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                onClick={() => setArchiveDepartmentId(department.id)}
              >
                <Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />
                {t('pages.departments.actions.delete')}
              </button>
            </PermissionGuard>
          </div>

          {/* Mobile/Tablet: Dropdown button group */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={openDropdownDepartmentId === department.id}
              onOpenChange={(open) => setOpenDropdownDepartmentId(open ? department.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                  aria-label={t('pages.departments.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem
                  onClick={() => setSelectedDepartmentId(department.id)}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Icons.View size={16} strokeWidth={1.5} />
                  <span>{t('pages.departments.actions.view')}</span>
                </DropdownMenuItem>
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
                  <DropdownMenuItem
                    onClick={() => setEditDepartmentId(department.id)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('pages.departments.actions.edit')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
                  <DropdownMenuItem
                    onClick={() => setArchiveDepartmentId(department.id)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.Delete size={16} strokeWidth={1.5} />
                    <span>{t('pages.departments.actions.delete')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ]

  // Full-page skeleton only until projects list has loaded once (keeps header/select on project change).
  const showFullPageSkeleton = loadingProjects && projectsData === undefined
  const shellReady = projects.length > 0 && selectedProjectId !== null
  const showTablesSkeleton =
    !showFullPageSkeleton && projects.length > 0 && !isError && (!shellReady || departmentsPending)

  return (
    <div>
      {/* Page Header */}
      {!showFullPageSkeleton && (
        <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
              {t('pages.departments.title')}
            </h1>
          </div>
          {/* Desktop: Full button with text, Mobile: Icon-only button */}
          <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
            <div className="hidden sm:block">
              <DoubleButton
                size="md"
                icon={<Icons.Add size={20} strokeWidth={2} />}
                iconPosition="left"
                onClick={() => setShowCreateModal(true)}
                disabled={!selectedProjectId}
              >
                {t('pages.departments.newDepartment')}
              </DoubleButton>
            </div>
            {/* Mobile: Icon-only button */}
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedProjectId}
              className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
              aria-label={t('pages.departments.newDepartment')}
            >
              <Icons.Add size={20} strokeWidth={2} />
            </button>
          </PermissionGuard>
        </div>
      )}

      {/* Project Selector */}
      {!showFullPageSkeleton && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-base font-light text-gray-500 sm:text-xl">
            {t('pages.departments.project')}
          </span>
          <Select
            value={selectedProjectId ? String(selectedProjectId) : ''}
            onValueChange={(value) => setSelectedProjectId(Number(value))}
          >
            <SelectTrigger className="text-dark-500 flex h-auto w-auto min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-base font-light shadow-none focus:ring-0 sm:text-xl [&>div.opacity-50]:hidden">
              <SelectValue
                placeholder={t('pages.departments.selectProject')}
                className="text-dark-500 text-base font-light sm:text-xl"
              />
              <div className="bg-primary-300 flex h-6 w-6 items-center justify-center rounded-md">
                <Icons.ArrowDown size={16} color="#05040D" strokeWidth={1.5} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Loading States */}
      {showFullPageSkeleton && <DepartmentManagementPageSkeleton />}
      {showTablesSkeleton && <DepartmentManagementTablesSkeleton />}

      {/* Error States */}
      {!showFullPageSkeleton && projects.length === 0 && (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">{t('pages.departments.noActiveProjects')}</p>
        </div>
      )}

      {!showFullPageSkeleton && projects.length > 0 && isError && (
        <ErrorState
          error={error}
          onRetry={() => refetch()}
          title={t('pages.departments.errorLoading')}
        />
      )}

      {/* Content */}
      {!showFullPageSkeleton && projects.length > 0 && !isError && !showTablesSkeleton && (
        <div className="space-y-8">
          <section className="rounded-xl bg-white/50 p-6">
            <h2 className="mb-3 text-base font-light text-black sm:text-xl">
              {t('pages.departments.allDepartments')}
            </h2>
            <DataTable<Department>
              columns={columns}
              data={departments}
              emptyMessage={t('pages.departments.noDepartments')}
            />
          </section>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && selectedProjectId && (
        <CreateDepartmentModal
          open={showCreateModal}
          projectId={selectedProjectId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}

      {selectedDepartmentId && (
        <DepartmentDetailModal
          open={selectedDepartmentId !== null}
          departmentId={selectedDepartmentId}
          onClose={() => setSelectedDepartmentId(null)}
        />
      )}

      {editDepartmentId && (
        <EditDepartmentModal
          open={editDepartmentId !== null}
          departmentId={editDepartmentId}
          onClose={() => setEditDepartmentId(null)}
          onSuccess={() => {
            setEditDepartmentId(null)
            refetch()
          }}
        />
      )}

      {archiveDepartmentId && (
        <ArchiveDepartmentModal
          open={archiveDepartmentId !== null}
          departmentId={archiveDepartmentId}
          onClose={() => setArchiveDepartmentId(null)}
          onSuccess={() => {
            setArchiveDepartmentId(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
