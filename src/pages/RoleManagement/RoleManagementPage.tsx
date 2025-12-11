/**
 * RoleManagementPage Component
 *
 * Main page for managing roles and permissions.
 * Uses the shared DataTable and UI patterns from User Management.
 */

import { useState, useEffect, useMemo } from 'react'
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
import { ErrorState } from '@/components/ErrorState'
import { Icons } from '@/lib/icons'
import { CreateRoleModal } from './components/CreateRoleModal'
import { RoleDetailModal } from './components/RoleDetailModal'
import { EditRoleModal } from './components/EditRoleModal'
import { ArchiveRoleModal } from './components/ArchiveRoleModal'
import { RoleManagementPageSkeleton } from './components/RoleManagementPageSkeleton'

export function RoleManagementPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [editRoleId, setEditRoleId] = useState<number | null>(null)
  const [archiveRoleId, setArchiveRoleId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

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

  const {
    data,
    isLoading: loadingRoles,
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
      header: 'Role',
      render: (role) => <span className="font-medium">{role.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (role) => <span className="font-medium">{role.description || '—'}</span>,
    },
    {
      key: 'user_count',
      header: 'Users',
      align: 'center',
      render: (role) => <span>{role.user_count}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (role) => (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setSelectedRoleId(role.id)}
            className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
          >
            <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
            View
          </button>
          <button
            type="button"
            className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            onClick={() => setEditRoleId(role.id)}
          >
            <Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />
            Edit
          </button>
          {!role.is_default && (
            <button
              type="button"
              className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
              onClick={() => setArchiveRoleId(role.id)}
            >
              <Icons.Delete size={16} color="#05040D" strokeWidth={1.5} />
              Delete
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">Role Management</h1>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!selectedProjectId}
          className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="New role"
        >
          <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.Add size={20} color="#05040D" strokeWidth={2} />
          </div>
          <span className="px-4 py-3 text-sm font-medium text-white">New Role</span>
        </button>
      </div>

      {/* Project Selector */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-xl font-light text-gray-500">Project:</span>
        <Select
          value={selectedProjectId ? String(selectedProjectId) : ''}
          onValueChange={(value) => setSelectedProjectId(Number(value))}
        >
          <SelectTrigger className="text-dark-500 flex h-auto w-auto min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-xl font-light shadow-none focus:ring-0 [&>div.opacity-50]:hidden">
            <SelectValue
              placeholder="Select project"
              className="text-dark-500 text-xl font-light"
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

      {/* Loading States */}
      {(loadingProjects || loadingRoles) && <RoleManagementPageSkeleton />}

      {/* Error States */}
      {!loadingProjects && !loadingRoles && projects.length === 0 && (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            No active projects found. Please create a project first.
          </p>
        </div>
      )}

      {!loadingProjects && !loadingRoles && projects.length > 0 && isError && (
        <ErrorState error={error} onRetry={() => refetch()} title="Error loading roles" />
      )}

      {/* Content */}
      {!loadingProjects && !loadingRoles && projects.length > 0 && !isError && (
        <div className="space-y-8">
          {/* Default Roles */}
          <section className="rounded-xl bg-white/50 p-6">
            <h2 className="mb-3 text-xl font-light text-black">Default Roles</h2>
            <DataTable<ApiRole>
              columns={columns}
              data={defaultRoles}
              emptyMessage="No default roles"
            />
          </section>

          {/* Custom Roles */}
          <section className="rounded-xl bg-white/50 p-6">
            <h2 className="mb-3 text-xl font-light text-black">Custom Roles</h2>
            <DataTable<ApiRole>
              columns={columns}
              data={customRoles}
              emptyMessage="No custom roles"
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
