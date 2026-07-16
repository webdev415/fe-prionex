/**
 * EditRoleForm Component
 *
 * Form for editing an existing role.
 * Logic matches backend:
 * - Default roles: name/description are read-only (backend prevents changes)
 * - Custom roles: name/description are editable
 * - Permissions: always editable (no backend restriction)
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUpdateRole } from '../hooks/useRoleMutations'
import { usePermissions } from '../hooks/useRoleMutations'
import { useDepartments } from '@/features/departments'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import type { RoleDetailResponse } from '../types'
import { ACCESS_LEVEL_OPTIONS, DEFAULT_ACCESS_LEVEL, isTabAccessPermission } from '../accessLevels'

interface EditRoleFormProps {
  role: RoleDetailResponse
  projectName: string
  onSuccess: () => void
  onCancel?: () => void
}

// Schema for editing roles - always use full schema, disable fields for default roles
const editRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
  department_id: z.number().nullable().optional(),
  permission_ids: z.array(z.number()).min(1, 'Please select at least one permission'),
})

// Combined type for form data
type EditRoleFormData = z.infer<typeof editRoleSchema>

export function EditRoleForm({ role, projectName, onSuccess }: EditRoleFormProps) {
  const { t } = useTranslation('common')
  const updateMutation = useUpdateRole()
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions()
  const { data: departmentsData, isLoading: loadingDepartments } = useDepartments({
    project_id: role.project_id,
    is_active: true,
  })
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])
  // KAN-757: per-tab access level keyed by permission_id.
  const [accessLevels, setAccessLevels] = useState<Record<number, string>>({})

  const isDefaultRole = role.is_default

  // Initialize selected permissions from role
  const initialPermissions = useMemo(
    () => role.permissions?.map((p) => p.id) || [],
    [role.permissions]
  )

  const initialAccessLevels = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of role.permissions ?? []) {
      if (isTabAccessPermission(p.name)) {
        map[p.id] = p.access_level || DEFAULT_ACCESS_LEVEL
      }
    }
    return map
  }, [role.permissions])

  // Initialize selected permissions from role
  useEffect(() => {
    setSelectedPermissions(initialPermissions)
  }, [initialPermissions])

  useEffect(() => {
    setAccessLevels(initialAccessLevels)
  }, [initialAccessLevels])

  // Group permissions by category
  const permissions = useMemo(
    () => permissionsData?.permissions || [],
    [permissionsData?.permissions]
  )

  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments]
  )

  const permissionsByCategory = useMemo(() => {
    return permissions.reduce(
      (acc, perm) => {
        if (!acc[perm.category]) {
          acc[perm.category] = []
        }
        acc[perm.category].push(perm)
        return acc
      },
      {} as Record<string, typeof permissions>
    )
  }, [permissions])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EditRoleFormData>({
    resolver: zodResolver(editRoleSchema),
    defaultValues: {
      name: role.name,
      description: role.description || '',
      department_id: role.department_id,
      permission_ids: role.permissions?.map((p) => p.id) || [],
    },
  })

  const handlePermissionToggle = (permissionId: number) => {
    const newSelected = selectedPermissions.includes(permissionId)
      ? selectedPermissions.filter((id) => id !== permissionId)
      : [...selectedPermissions, permissionId]

    setSelectedPermissions(newSelected)
    setValue('permission_ids', newSelected, { shouldValidate: true })
  }

  const handleAccessLevelChange = (permissionId: number, level: string) => {
    setAccessLevels((prev) => ({ ...prev, [permissionId]: level }))
  }

  const onSubmit = (data: unknown) => {
    // Only send access levels for permissions that are both a tab permission
    // and currently selected.
    const selectedSet = new Set(selectedPermissions)
    const access_levels: Record<number, string> = {}
    for (const [permId, level] of Object.entries(accessLevels)) {
      if (selectedSet.has(Number(permId))) {
        access_levels[Number(permId)] = level
      }
    }

    const updateData: {
      permission_ids: number[]
      access_levels: Record<number, string>
      name?: string
      description?: string
      department_id?: number | null
    } = {
      permission_ids: selectedPermissions,
      access_levels,
    }

    // Only include name/description/department for custom roles (backend allows this)
    if (!isDefaultRole) {
      const customData = data as EditRoleFormData
      updateData.name = customData.name
      updateData.description = customData.description || undefined
      updateData.department_id = customData.department_id
    }

    updateMutation.mutate(
      {
        roleId: role.id,
        data: updateData,
      },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  return (
    <form id="edit-role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Project Name (Always Read-only) */}
      <div>
        <Label>{t('pages.roles.forms.roleName')}</Label>
        <div className="border-border bg-muted text-foreground flex h-[45px] items-center rounded-lg border px-4 py-2 text-sm font-light">
          {projectName}
        </div>
      </div>

      {/* Role Name */}
      <div>
        <Label required={!isDefaultRole}>{t('pages.roles.forms.roleName')}</Label>
        {isDefaultRole ? (
          // Default role: read-only (backend prevents changes)
          <div className="border-border bg-muted text-foreground flex h-[45px] items-center rounded-lg border px-4 py-2 text-sm font-light">
            {role.name}
          </div>
        ) : (
          // Custom role: editable
          <>
            <Input
              id="name"
              {...register('name' as const)}
              placeholder={t('pages.roles.forms.placeholders.roleName')}
              disabled={updateMutation.isPending}
            />
            {errors.name && (
              <p className="text-error-500 mt-1 text-sm">
                {(errors.name as { message?: string })?.message}
              </p>
            )}
          </>
        )}
      </div>

      {/* Description */}
      <div>
        <Label>{t('pages.roles.forms.description')}</Label>
        {isDefaultRole ? (
          // Default role: read-only
          <div className="border-border bg-muted text-foreground flex min-h-[80px] items-start rounded-lg border px-4 py-2 pt-3 text-sm font-light">
            {role.description || '—'}
          </div>
        ) : (
          // Custom role: editable
          <Textarea
            id="description"
            {...register('description' as const)}
            placeholder={t('pages.roles.forms.placeholders.description')}
            disabled={updateMutation.isPending}
          />
        )}
      </div>

      {/* Department Selection - Only for Custom Roles */}
      {!isDefaultRole && (
        <div>
          <Label htmlFor="department_id">
            {t('pages.roles.forms.department')}
            <span className="text-muted-foreground ml-1 text-sm font-light">(Optional)</span>
          </Label>
          <select
            id="department_id"
            {...register('department_id' as const, {
              setValueAs: (v) => (v === '' || v === 'null' ? null : Number(v)),
            })}
            disabled={updateMutation.isPending || loadingDepartments}
            className="text-foreground border-border bg-card flex h-[45px] w-full items-center rounded-lg border px-3 py-2 text-sm font-light shadow-none focus:ring-0 focus:outline-none disabled:opacity-50"
          >
            <option value="">{t('pages.roles.forms.placeholders.noDepartment')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('pages.roles.forms.departmentHint')}
          </p>
        </div>
      )}

      {/* Department Display - For Default Roles */}
      {isDefaultRole && (
        <div>
          <Label>{t('pages.roles.forms.department')}</Label>
          <div className="border-border bg-muted text-muted-foreground flex h-[45px] items-center rounded-lg border px-4 py-2 text-sm font-light">
            {t('pages.roles.forms.departmentNotAvailableForDefault')}
          </div>
        </div>
      )}

      {/* Permissions Section (Always Editable - No Backend Restriction) */}
      <div>
        <Label>
          {t('pages.roles.forms.permissions')}
          <span className="text-muted-foreground ml-2 text-sm font-light">
            (Selected: {selectedPermissions.length} of {permissions.length} permissions)
          </span>
        </Label>

        <div className="bg-card max-h-96 overflow-y-auto rounded-xl p-6">
          {loadingPermissions ? (
            <div className="text-muted-foreground py-4 text-sm">
              {t('pages.roles.forms.loadingPermissions')}
            </div>
          ) : (
            <div>
              {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => {
                return (
                  <div key={category} className="mb-6 last:mb-0">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-foreground text-sm font-light">{category}</span>
                      <span className="text-muted-foreground text-xs">
                        {categoryPerms.filter((p) => selectedPermissions.includes(p.id)).length}/
                        {categoryPerms.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {categoryPerms.map((perm) => {
                        const isSelected = selectedPermissions.includes(perm.id)
                        const isTabPerm = isTabAccessPermission(perm.name)
                        return (
                          <label
                            key={perm.id}
                            className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded p-2 transition-colors"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handlePermissionToggle(perm.id)}
                              aria-label={perm.name}
                            />
                            <div className="flex-1">
                              <span className="text-foreground text-sm font-light">
                                {perm.name}
                              </span>
                              {perm.description && (
                                <span className="text-muted-foreground ml-2 text-sm font-light">
                                  {perm.description}
                                </span>
                              )}
                            </div>
                            {isTabPerm && (
                              <select
                                aria-label={`${perm.name} access level`}
                                value={accessLevels[perm.id] ?? DEFAULT_ACCESS_LEVEL}
                                disabled={!isSelected || updateMutation.isPending}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleAccessLevelChange(perm.id, e.target.value)}
                                className="text-foreground border-border bg-card h-[34px] rounded-lg border px-2 text-sm font-light focus:ring-0 focus:outline-none disabled:opacity-50"
                              >
                                {ACCESS_LEVEL_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {t(opt.labelKey, opt.fallback)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {errors.permission_ids && (
          <p className="text-error-500 mt-1 text-sm">{errors.permission_ids.message}</p>
        )}
      </div>

      {/* Error Alert */}
      {updateMutation.isError && (
        <Alert variant="error">
          <p className="text-sm">
            {updateMutation.error?.message || 'Failed to update role. Please try again.'}
          </p>
        </Alert>
      )}
    </form>
  )
}
