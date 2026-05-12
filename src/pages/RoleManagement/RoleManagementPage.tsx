/**
 * RoleManagementPage Component
 *
 * Main page for managing roles and permissions.
 * Uses the shared DataTable and UI patterns from User Management.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoles } from '@/features/roles'
import type { ApiRole } from '@/features/roles/types'
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
import { CreateRoleModal } from './components/CreateRoleModal'
import { RoleDetailModal } from './components/RoleDetailModal'
import { EditRoleModal } from './components/EditRoleModal'
import { ArchiveRoleModal } from './components/ArchiveRoleModal'
import {
  RoleManagementPageSkeleton,
  RoleManagementTablesSkeleton,
} from './components/RoleManagementPageSkeleton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'

export function RoleManagementPage() {
  const { t } = useTranslation('common')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [editRoleId, setEditRoleId] = useState<number | null>(null)
  const [archiveRoleId, setArchiveRoleId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [openDropdownRoleId, setOpenDropdownRoleId] = useState<number | null>(null)

  // Fetch all projects for dropdown
  const { data: projectsData, isLoading: loadingProjects } = useProjects({
    page: 1,
    page_size: 100,
    status: 'active',
  })
  const projects = useMemo(() => projectsData?.projects || [], [projectsData?.projects])

  // Set default project when projects load - use initial state instead of effect
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

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownRoleId !== null) {
        setOpenDropdownRoleId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownRoleId])

  const {
    data,
    isPending: rolesPending,
    isError,
    error,
    refetch,
  } = useRoles({
    page: 1,
    page_size: 100,
    project_id: selectedProjectId || undefined,
    is_active: true,
  })

  const roles = (data?.roles || []) as ApiRole[]
  const defaultRoles = roles.filter((role) => role.is_default)
  const customRoles = roles.filter((role) => !role.is_default)

  const columns: Column<ApiRole>[] = [
    {
      key: 'name',
      header: t('pages.roles.tableHeaders.role'),
      render: (role) => <span className="font-medium">{role.name}</span>,
    },
    {
      key: 'description',
      header: t('pages.roles.tableHeaders.description'),
      render: (role) => <span className="font-medium">{role.description || '—'}</span>,
    },
    {
      key: 'user_count',
      header: t('pages.roles.tableHeaders.users'),
      align: 'center',
      render: (role) => <span>{role.user_count}</span>,
    },
    {
      key: 'actions',
      header: t('pages.roles.tableHeaders.actions'),
      align: 'center',
      render: (role) => (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Desktop: Individual buttons */}
          <div className="hidden items-center gap-4 lg:flex">
            <button
              type="button"
              onClick={() => setSelectedRoleId(role.id)}
              className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            >
              <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
              {t('pages.roles.actions.view')}
            </button>
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
              <button
                type="button"
                className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                onClick={() => setEditRoleId(role.id)}
              >
                <Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />
                {t('pages.roles.actions.edit')}
              </button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
              {!role.is_default && (
                <button
                  type="button"
                  className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                  onClick={() => setArchiveRoleId(role.id)}
                >
                  <Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />
                  {t('pages.roles.actions.delete')}
                </button>
              )}
            </PermissionGuard>
          </div>

          {/* Mobile/Tablet: Dropdown button group */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={openDropdownRoleId === role.id}
              onOpenChange={(open) => setOpenDropdownRoleId(open ? role.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                  aria-label={t('pages.roles.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem
                  onClick={() => setSelectedRoleId(role.id)}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Icons.View size={16} strokeWidth={1.5} />
                  <span>{t('pages.roles.actions.view')}</span>
                </DropdownMenuItem>
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
                  <DropdownMenuItem
                    onClick={() => setEditRoleId(role.id)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('pages.roles.actions.edit')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
                  {!role.is_default && (
                    <DropdownMenuItem
                      onClick={() => setArchiveRoleId(role.id)}
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.Delete size={16} strokeWidth={1.5} />
                      <span>{t('pages.roles.actions.delete')}</span>
                    </DropdownMenuItem>
                  )}
                </PermissionGuard>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ),
    },
  ]

  // Full-page skeleton only while the projects list has never loaded (avoids hiding header/select on project change).
  const showFullPageSkeleton = loadingProjects && projectsData === undefined
  const shellReady = projects.length > 0 && selectedProjectId !== null
  const showTablesSkeleton =
    !showFullPageSkeleton && projects.length > 0 && !isError && (!shellReady || rolesPending)

  return (
    <div>
      {/* Page Header */}
      {!showFullPageSkeleton && (
        <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
              {t('pages.roles.title')}
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
                {t('pages.roles.newRole')}
              </DoubleButton>
            </div>
            {/* Mobile: Icon-only button */}
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedProjectId}
              className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
              aria-label={t('pages.roles.newRole')}
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
            {t('pages.roles.project')}
          </span>
          <Select
            value={selectedProjectId ? String(selectedProjectId) : ''}
            onValueChange={(value) => setSelectedProjectId(Number(value))}
          >
            <SelectTrigger className="text-dark-500 flex h-auto w-auto min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-base font-light shadow-none focus:ring-0 sm:text-xl [&>div.opacity-50]:hidden">
              <SelectValue
                placeholder={t('pages.roles.selectProject')}
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
      {showFullPageSkeleton && <RoleManagementPageSkeleton />}
      {showTablesSkeleton && <RoleManagementTablesSkeleton />}

      {/* Error States */}
      {!showFullPageSkeleton && projects.length === 0 && (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">{t('pages.roles.noActiveProjects')}</p>
        </div>
      )}

      {!showFullPageSkeleton && projects.length > 0 && isError && (
        <ErrorState error={error} onRetry={() => refetch()} title={t('pages.roles.errorLoading')} />
      )}

      {/* Content */}
      {!showFullPageSkeleton && projects.length > 0 && !isError && !showTablesSkeleton && (
        <div className="space-y-8">
          {/* Default Roles */}
          <section className="rounded-xl bg-white/50 p-6">
            <h2 className="mb-3 text-base font-light text-black sm:text-xl">
              {t('pages.roles.defaultRoles')}
            </h2>
            <DataTable<ApiRole>
              columns={columns}
              data={defaultRoles}
              emptyMessage={t('pages.roles.noDefaultRoles')}
            />
          </section>

          {/* Custom Roles */}
          <section className="rounded-xl bg-white/50 p-6">
            <h2 className="mb-3 text-base font-light text-black sm:text-xl">
              {t('pages.roles.customRoles')}
            </h2>
            <DataTable<ApiRole>
              columns={columns}
              data={customRoles}
              emptyMessage={t('pages.roles.noCustomRoles')}
            />
          </section>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && selectedProjectId && (
        <CreateRoleModal
          open={showCreateModal}
          projectId={selectedProjectId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}

      {selectedRoleId && (
        <RoleDetailModal
          open={selectedRoleId !== null}
          roleId={selectedRoleId}
          onClose={() => setSelectedRoleId(null)}
        />
      )}

      {editRoleId && (
        <EditRoleModal
          open={editRoleId !== null}
          roleId={editRoleId}
          onClose={() => setEditRoleId(null)}
          onSuccess={() => {
            setEditRoleId(null)
            refetch()
          }}
        />
      )}

      {archiveRoleId && (
        <ArchiveRoleModal
          open={archiveRoleId !== null}
          roleId={archiveRoleId}
          onClose={() => setArchiveRoleId(null)}
          onSuccess={() => {
            setArchiveRoleId(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
