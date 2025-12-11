/**
 * ViewRoleForm Component
 *
 * Form for viewing role details in read-only mode.
 * Displays role information as plain text with inline label-value pairs.
 */

import { useMemo } from 'react'
import { usePermissions } from '../hooks/useRoleMutations'
import type { RoleDetailResponse } from '../types'

interface ViewRoleFormProps {
  role: RoleDetailResponse
  projectName: string
}

export function ViewRoleForm({ role }: ViewRoleFormProps) {
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions()

  // Get selected permission IDs from role
  const selectedPermissionIds = useMemo(
    () => new Set(role.permissions?.map((p) => p.id) || []),
    [role.permissions]
  )

  // Group permissions by category
  const permissions = useMemo(
    () => permissionsData?.permissions || [],
    [permissionsData?.permissions]
  )

  // Filter to only selected permissions and group by category
  const permissionsByCategory = useMemo(() => {
    // Only show permissions that are selected (in role.permissions)
    const selectedPerms = permissions.filter((perm) => selectedPermissionIds.has(perm.id))

    return selectedPerms.reduce(
      (acc, perm) => {
        if (!acc[perm.category]) {
          acc[perm.category] = []
        }
        acc[perm.category].push(perm)
        return acc
      },
      {} as Record<string, typeof permissions>
    )
  }, [permissions, selectedPermissionIds])

  return (
    <div className="space-y-4">
      {/* Role Name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-light text-gray-500">Role Name:</span>
        <span className="text-sm font-semibold text-gray-950">{role.name}</span>
      </div>

      {/* Description */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-light text-gray-500">Description:</span>
        <span className="text-sm font-semibold text-gray-950">{role.description || '—'}</span>
      </div>

      {/* Type */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-light text-gray-500">Type:</span>
        <span className="text-sm font-semibold text-gray-950">
          {role.is_default ? 'System Default' : 'Custom Role'}
        </span>
      </div>

      {/* Users */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-light text-gray-500">Users:</span>
        <span className="text-sm font-semibold text-gray-950">{role.user_count || 0}</span>
      </div>

      {/* Permissions Section (Read-only) */}
      <div className="mt-6">
        <div className="mb-4">
          <span className="text-sm font-light text-gray-500">Permissions:</span>
          <span className="text-sm font-light text-gray-500">
            ({selectedPermissionIds.size} of {permissions.length} permissions)
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-xl bg-white p-6">
          {loadingPermissions ? (
            <div className="py-4 text-sm text-gray-500">Loading permissions...</div>
          ) : (
            <div>
              {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-light text-gray-950">{category}</span>
                    <span className="text-xs text-gray-500">{categoryPerms.length}</span>
                  </div>
                  <div className="space-y-2">
                    {categoryPerms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-3 rounded p-2">
                        <div className="border-primary-500 bg-primary-500 flex h-4 w-4 items-center justify-center rounded border">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10 3L4.5 8.5L2 6"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-light text-gray-950">{perm.name}</span>
                          {perm.description && (
                            <span className="ml-2 text-sm font-light text-gray-500">
                              {perm.description}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
