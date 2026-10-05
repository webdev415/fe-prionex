/**
 * ProjectRoleGroupRow - Role and optional group assignment for a project.
 *
 * When the project's roles cannot be listed - with the project scope enforced,
 * a caller without the right in THIS project gets PROJECT_SCOPE_DENIED - the
 * row says why, once, beside a disabled picker, instead of looking like a
 * project that simply has no roles. Any other failure of the list keeps the
 * row as it was before the scope existed.
 *
 * A caller editing somebody's existing assignment can hand in what they hold
 * now (`heldRole`, `heldGroup`). Those stay among the options even once the
 * position or group has been deactivated, so the picker opens on them rather
 * than blank while the old id is still what gets saved. Without them the row
 * offers only what is active, as it always has.
 */

import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectRoles } from '@/features/roles'
import { isProjectScopeDenied } from '@/features/roles/projectScope'
import { useGroups } from '@/features/groups'
import { getErrorMessage } from '@/lib/errors'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

/** A position or group somebody holds now, kept even when no longer offered. */
export interface HeldOption {
  id: number
  name: string
  /** The department it belongs to: a position's own, or a group's. */
  departmentId: number | null
}

interface ProjectRoleGroupRowProps {
  projectId: number
  projectName?: string
  selectedRoleId: number | undefined
  selectedGroupId: number | undefined
  onRoleChange: (roleId: number) => void
  onGroupChange: (groupId: number | undefined) => void
  /** The position held in this project now; offered even when inactive. */
  heldRole?: HeldOption
  /** The group held now; offered while its department is the chosen one. */
  heldGroup?: HeldOption
}

export function ProjectRoleGroupRow({
  projectId,
  projectName,
  selectedRoleId,
  selectedGroupId,
  onRoleChange,
  onGroupChange,
  heldRole,
  heldGroup,
}: ProjectRoleGroupRowProps) {
  const { t } = useTranslation('common')
  const { data: rolesData, error: rolesError } = useProjectRoles(projectId)
  const rolesRefused = isProjectScopeDenied(rolesError)
  const refusalId = useId()
  const availableRoles = (rolesData?.roles || []).filter((role) => role.is_active)

  const selectedRole = useMemo(
    () => availableRoles.find((r) => r.id === selectedRoleId),
    [availableRoles, selectedRoleId]
  )

  // Not among the active positions (deactivated, or not listed yet): kept as
  // an option of its own, and its department still decides the groups.
  const keptRole =
    heldRole && !availableRoles.some((role) => role.id === heldRole.id) ? heldRole : undefined

  const departmentId =
    selectedRole?.department_id ??
    (keptRole && keptRole.id === selectedRoleId ? keptRole.departmentId : null)

  const { data: groupsData } = useGroups(
    { department_id: departmentId ?? undefined, page: 1, page_size: 100, is_active: true },
    !!departmentId
  )
  const availableGroups = groupsData?.groups ?? []
  const keptGroup =
    heldGroup &&
    departmentId !== null &&
    heldGroup.departmentId === departmentId &&
    !availableGroups.some((group) => group.id === heldGroup.id)
      ? heldGroup
      : undefined

  const handleRoleChange = (value: string) => {
    const roleId = parseInt(value, 10)
    onRoleChange(roleId)
    onGroupChange(undefined)
  }

  return (
    <div className="space-y-2">
      <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4">
        <span className="text-foreground text-sm font-light">{projectName}:</span>
        <Select
          value={selectedRoleId?.toString() || ''}
          onValueChange={handleRoleChange}
          disabled={rolesRefused}
        >
          <SelectTrigger
            className="border-border text-foreground mt-1 w-full border text-sm"
            aria-describedby={rolesRefused ? refusalId : undefined}
          >
            <SelectValue placeholder={t('pages.users.forms.notAssigned')} />
          </SelectTrigger>
          <SelectContent>
            {keptRole && (
              <SelectItem key={`held-${keptRole.id}`} value={keptRole.id.toString()}>
                {keptRole.name}
              </SelectItem>
            )}
            {availableRoles.length > 0 ? (
              availableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  {role.name}
                  {role.department_name ? ` (${role.department_name})` : ''}
                </SelectItem>
              ))
            ) : keptRole ? null : (
              <SelectItem value="no-roles-available" disabled>
                {t('pages.users.forms.noRolesAvailable')}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      {rolesRefused && (
        <p id={refusalId} role="alert" className="text-error-500 text-sm">
          {getErrorMessage(rolesError)}
        </p>
      )}
      {departmentId && (
        <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4">
          <span className="text-foreground text-sm font-light">
            {t('pages.users.forms.group')}:
          </span>
          <Select
            value={selectedGroupId?.toString() || 'none'}
            onValueChange={(value) =>
              onGroupChange(value === 'none' ? undefined : parseInt(value, 10))
            }
          >
            <SelectTrigger className="border-border text-foreground mt-1 w-full border text-sm">
              <SelectValue placeholder={t('pages.users.forms.noGroup')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('pages.users.forms.noGroup')}</SelectItem>
              {keptGroup && (
                <SelectItem key={`held-${keptGroup.id}`} value={keptGroup.id.toString()}>
                  {keptGroup.name}
                </SelectItem>
              )}
              {availableGroups.map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
