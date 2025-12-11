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
        <span
          className="font-light"
          style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
        >
          Role Name:
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
        >
          {role.name}
        </span>
      </div>

      {/* Description */}
      <div className="flex items-center gap-2">
        <span
          className="font-light"
          style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
        >
          Description:
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
        >
          {role.description || '—'}
        </span>
      </div>

      {/* Type */}
      <div className="flex items-center gap-2">
        <span
          className="font-light"
          style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
        >
          Type:
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
        >
          {role.is_default ? 'System Default' : 'Custom Role'}
        </span>
      </div>

      {/* Users */}
      <div className="flex items-center gap-2">
        <span
          className="font-light"
          style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
        >
          Users:
        </span>
        <span
          className="font-semibold"
          style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
        >
          {role.user_count || 0}
        </span>
      </div>

      {/* Permissions Section (Read-only) */}
      <div className="mt-6">
        <div className="mb-4">
          <span
            className="font-light"
            style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
          >
            Permissions:
          </span>
          <span
            className="ml-2 font-light"
            style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
          >
            ({selectedPermissionIds.size} of {permissions.length} permissions)
          </span>
        </div>

        <div
          className="max-h-96 overflow-y-auto rounded-xl"
          style={{
            backgroundColor: '#FFFFFF',
            padding: '24px',
          }}
        >
          {loadingPermissions ? (
            <div className="py-4 text-sm" style={{ color: '#6B7280' }}>
              Loading permissions...
            </div>
          ) : (
            <div>
              {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <div
                    className="mb-3 flex items-center justify-between"
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <span
                      className="font-light"
                      style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                    >
                      {category}
                    </span>
                    <span className="text-xs" style={{ color: '#6B7280' }}>
                      {categoryPerms.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {categoryPerms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-3 rounded p-2">
                        <div
                          className="flex h-4 w-4 items-center justify-center rounded border"
                          style={{
                            borderColor: '#0CA8EB',
                            backgroundColor: '#0CA8EB',
                          }}
                        >
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
                          <span
                            className="font-light"
                            style={{
                              fontSize: '14px',
                              fontWeight: 300,
                              color: '#030712',
                            }}
                          >
                            {perm.name}
                          </span>
                          {perm.description && (
                            <span
                              className="ml-2 font-light"
                              style={{
                                fontSize: '14px',
                                fontWeight: 300,
                                color: '#6B7280',
                              }}
                            >
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
