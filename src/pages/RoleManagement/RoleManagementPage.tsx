/**
 * RoleManagementPage Component
 *
 * Main page for managing roles and permissions.
 */

import { useState, useEffect, useMemo } from 'react'
import { useRoles } from '@/features/roles'
import { useProjects } from '@/features/projects'
import { CreateRoleModal } from './components/CreateRoleModal'
import { RoleDetailModal } from './components/RoleDetailModal'

const ITEMS_PER_PAGE = 20

export function RoleManagementPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
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

  const { data, isError, refetch } = useRoles({
    page: currentPage,
    page_size: ITEMS_PER_PAGE,
    project_id: selectedProjectId || undefined,
  })

  const roles = data?.roles || []
  const totalRoles = data?.pagination?.total_count || 0
  const totalPages = data?.pagination?.total_pages || Math.ceil(totalRoles / ITEMS_PER_PAGE)

  if (loadingProjects) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="mb-4 h-8 w-1/4 rounded bg-gray-200" />
            <div className="h-64 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Role & Permissions Management</h1>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-yellow-800">
              No active projects found. Please create a project first.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-800">Failed to load roles. Please try again.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Role & Permissions Management</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage roles and permissions for each project
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedProjectId}
              className="inline-flex items-center rounded-md border border-transparent bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="mr-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Add New Role
            </button>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-4">
            <label htmlFor="project-select" className="text-sm font-medium text-gray-700">
              Select Project:
            </label>
            <select
              id="project-select"
              value={selectedProjectId || ''}
              onChange={(e) => {
                setSelectedProjectId(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="block w-80 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.code})
                </option>
              ))}
            </select>
            {selectedProjectId && (
              <span className="text-sm text-gray-600">
                {totalRoles} role{totalRoles !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Roles Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Permissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                    {role.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.description || '—'}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {role.permission_count} permissions
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 text-xs font-semibold ${
                        role.is_default ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {role.is_default ? 'Default' : 'Custom'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                    <button
                      onClick={() => setSelectedRoleId(role.id)}
                      className="mr-4 text-teal-600 hover:text-teal-900"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * ITEMS_PER_PAGE, totalRoles)}
                    </span>{' '}
                    of <span className="font-medium">{totalRoles}</span> roles
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 border-teal-500 bg-teal-50 text-teal-600'
                              : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {roles.length === 0 && (
          <div className="py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No roles</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new role.</p>
          </div>
        )}
      </div>

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
    </div>
  )
}
