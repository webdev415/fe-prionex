/**
 * AssistantAccessSection — which roles may use the operator assistant.
 *
 * One row per active role with a ToggleSwitch bound to the presence of
 * the `use_ai_assistant` permission in that role. Writes go through the
 * standard role-management API (PUT /api/v1/admin/roles/{id}) sending the
 * full permission_ids + access_levels payload rebuilt exactly like
 * EditRoleForm — every tab-access permission (KAN-757) that stays selected
 * keeps its stored depth, defaulting to DEFAULT_ACCESS_LEVEL when unset —
 * so toggling assistant access never resets a role's other permissions.
 * Visible under `manage_roles` only (the roles API needs it).
 */
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'

import { getRoles } from '@/features/roles/api/rolesApi'
import { usePermissions, useRole, useUpdateRole } from '@/features/roles/hooks'
import { DEFAULT_ACCESS_LEVEL, isTabAccessPermission } from '@/features/roles/accessLevels'

const AI_PERMISSION_CODE = PERMISSIONS.AI_ASSISTANT.USE // 'use_ai_assistant'

function RoleAccessRow({
  roleId,
  roleName,
  aiPermissionId,
}: {
  roleId: number
  roleName: string
  aiPermissionId: number
}) {
  const { t } = useTranslation('common')
  const roleQuery = useRole(roleId)
  const updateRole = useUpdateRole()

  const role = roleQuery.data
  const hasAccess = role?.permissions.some((p) => p.code === AI_PERMISSION_CODE) ?? false

  const handleToggle = async (next: boolean) => {
    if (!role) return
    const currentIds = role.permissions.map((p) => p.id)
    const permission_ids = next
      ? Array.from(new Set([...currentIds, aiPermissionId]))
      : currentIds.filter((id) => id !== aiPermissionId)

    // Same access_levels shape as EditRoleForm's submit: only tab-access
    // permissions that remain selected get an entry, value falls back to
    // DEFAULT_ACCESS_LEVEL when the role never set one (KAN-757).
    const selectedIds = new Set(permission_ids)
    const access_levels: Record<number, string> = {}
    for (const p of role.permissions) {
      if (isTabAccessPermission(p.name) && selectedIds.has(p.id)) {
        access_levels[p.id] = p.access_level || DEFAULT_ACCESS_LEVEL
      }
    }

    try {
      await updateRole.mutateAsync({ roleId, data: { permission_ids, access_levels } })
      toast.success(t('pages.aiSettings.accessUpdated', { role: roleName }))
    } catch {
      toast.error(t('pages.aiSettings.accessUpdateError'))
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="text-foreground min-w-0 truncate text-sm">{roleName}</div>
      <ToggleSwitch
        checked={hasAccess}
        onChange={handleToggle}
        disabled={roleQuery.isLoading || updateRole.isPending}
        ariaLabel={t('pages.aiSettings.accessToggleAria', { role: roleName })}
      />
    </div>
  )
}

export function AssistantAccessSection() {
  const { t } = useTranslation('common')
  const rolesQuery = useQuery({
    queryKey: ['roles', 'list', 'ai-access'],
    queryFn: () => getRoles({ is_active: true, page_size: 100 }),
  })
  const permissionsQuery = usePermissions()

  const aiPermissionId = permissionsQuery.data?.permissions.find(
    (p) => p.code === AI_PERMISSION_CODE
  )?.id

  return (
    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_ROLES}>
      <div
        data-testid="assistant-access-section"
        className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icons.UserMultiple02 size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-foreground text-sm font-medium">
              {t('pages.aiSettings.accessTitle')}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {t('pages.aiSettings.accessDescription')}
            </div>
          </div>
        </div>
        <div className="divide-border divide-y">
          {aiPermissionId != null &&
            rolesQuery.data?.roles.map((role) => (
              <RoleAccessRow
                key={role.id}
                roleId={role.id}
                roleName={role.name}
                aiPermissionId={aiPermissionId}
              />
            ))}
        </div>
      </div>
    </PermissionGuard>
  )
}

export default AssistantAccessSection
