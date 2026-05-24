/**
 * ProjectRoleGroupRow - Role and optional group assignment for a project.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectRoles } from '@/features/roles'
import { useGroups } from '@/features/groups'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

interface ProjectRoleGroupRowProps {
  projectId: number
  projectName?: string
  selectedRoleId: number | undefined
  selectedGroupId: number | undefined
  onRoleChange: (roleId: number) => void
  onGroupChange: (groupId: number | undefined) => void
}

export function ProjectRoleGroupRow({
  projectId,
  projectName,
  selectedRoleId,
  selectedGroupId,
  onRoleChange,
  onGroupChange,
}: ProjectRoleGroupRowProps) {
  const { t } = useTranslation('common')
  const { data: rolesData } = useProjectRoles(projectId)
  const availableRoles = (rolesData?.roles || []).filter((role) => role.is_active)

  const selectedRole = useMemo(
    () => availableRoles.find((r) => r.id === selectedRoleId),
    [availableRoles, selectedRoleId]
  )

  const departmentId = selectedRole?.department_id ?? null

  const { data: groupsData } = useGroups(
    { department_id: departmentId ?? undefined, page: 1, page_size: 100, is_active: true },
    !!departmentId
  )
  const availableGroups = groupsData?.groups ?? []

  const handleRoleChange = (value: string) => {
    const roleId = parseInt(value, 10)
    onRoleChange(roleId)
    onGroupChange(undefined)
  }

  return (
    <div className="space-y-2">
      <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4">
        <span className="text-dark-500 text-sm font-light">{projectName}:</span>
        <Select value={selectedRoleId?.toString() || ''} onValueChange={handleRoleChange}>
          <SelectTrigger className="border-light-50 text-dark-500 mt-1 w-full border text-sm">
            <SelectValue placeholder={t('pages.users.forms.notAssigned')} />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.length > 0 ? (
              availableRoles.map((role) => (
                <SelectItem key={role.id} value={role.id.toString()}>
                  {role.name}
                  {role.department_name ? ` (${role.department_name})` : ''}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-roles-available" disabled>
                {t('pages.users.forms.noRolesAvailable')}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
      {departmentId && (
        <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4">
          <span className="text-dark-500 text-sm font-light">{t('pages.users.forms.group')}:</span>
          <Select
            value={selectedGroupId?.toString() || 'none'}
            onValueChange={(value) =>
              onGroupChange(value === 'none' ? undefined : parseInt(value, 10))
            }
          >
            <SelectTrigger className="border-light-50 text-dark-500 mt-1 w-full border text-sm">
              <SelectValue placeholder={t('pages.users.forms.noGroup')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('pages.users.forms.noGroup')}</SelectItem>
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
