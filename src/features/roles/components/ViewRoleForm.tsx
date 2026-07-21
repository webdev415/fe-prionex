/**
 * ViewRoleForm Component
 *
 * Form for viewing role details in read-only mode.
 * Displays role information as plain text with inline label-value pairs.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '../hooks/useRoleMutations'
import type { RoleDetailResponse } from '../types'

interface ViewRoleFormProps {
  role: RoleDetailResponse
  projectName: string
}

export function ViewRoleForm({ role }: ViewRoleFormProps) {
  const { t } = useTranslation('common')
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
        <span className="text-muted-foreground text-sm font-light">
          {t('pages.roles.forms.roleName')}:
        </span>
        <span className="text-foreground text-sm font-semibold">{role.name}</span>
      </div>

      {/* Description */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm font-light">
          {t('pages.roles.forms.description')}:
        </span>
        <span className="text-foreground text-sm font-semibold">{role.description || '—'}</span>
      </div>

      {/* Department */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm font-light">
          {t('pages.roles.forms.department')}:
        </span>
        <span className="text-foreground text-sm font-semibold">
          {role.department_name ||
            (role.is_default ? 'Not available for default roles' : 'Not assigned')}
        </span>
      </div>

      {/* Type */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm font-light">Type:</span>
        <span className="text-foreground text-sm font-semibold">
          {role.is_default ? 'System Default' : 'Custom Role'}
        </span>
      </div>

      {/* Users */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm font-light">
          {t('pages.roles.tableHeaders.users')}:
        </span>
        <span className="text-foreground text-sm font-semibold">{role.user_count || 0}</span>
      </div>

      {/* Permissions Section (Read-only) */}
      <div className="mt-6">
        <div className="mb-4">
          <span className="text-muted-foreground text-sm font-light">
            {t('pages.roles.forms.permissions')}:
          </span>
          <span className="text-muted-foreground text-sm font-light">
            ({selectedPermissionIds.size} of {permissions.length} permissions)
          </span>
        </div>

        <div className="bg-card max-h-96 overflow-y-auto rounded-xl p-6">
          {loadingPermissions ? (
            <div className="text-muted-foreground py-4 text-sm">
              {t('pages.roles.forms.loadingPermissions')}
            </div>
          ) : (
            <div>
              {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-foreground text-sm font-light">{category}</span>
                    <span className="text-muted-foreground text-xs">{categoryPerms.length}</span>
                  </div>
                  <div className="space-y-2">
                    {categoryPerms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-3 rounded p-2">
                        <div className="border-primary-500 bg-primary-500 text-primary-foreground flex h-4 w-4 items-center justify-center rounded border">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="text-primary-foreground"
                          >
                            <path
                              d="M10 3L4.5 8.5L2 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <span className="text-foreground text-sm font-light">{perm.name}</span>
                          {perm.description && (
                            <span className="text-muted-foreground ml-2 text-sm font-light">
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
