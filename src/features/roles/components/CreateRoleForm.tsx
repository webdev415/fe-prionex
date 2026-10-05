/**
 * CreateRoleForm Component
 *
 * Form for creating a new role with permission selection.
 * Matches the design pattern from CreateUserForm.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateRole } from '../hooks/useRoleMutations'
import { usePermissions } from '../hooks/useRoleMutations'
import { useHubRoles } from '../hooks/useHubRoles'
import { useDepartments } from '@/features/departments'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import { ACCESS_LEVEL_OPTIONS, DEFAULT_ACCESS_LEVEL, isTabAccessPermission } from '../accessLevels'
import { chatTemplateCreatePatch, hubRoleCreatePatch } from '../buildRolePayload'
import { chatRefusal, dropsChatDraft, effectiveChatTemplate } from '../chatRoleSet'
import { effectiveHubRoleValue, isStaleHubCatalogueRefusal } from '../hubRoles'
import { isRoleChatSettingsEnabled } from '../roleChatSettingsFlag'
import { ChatTemplateSelect } from './ChatTemplateSelect'
import { HubRoleSelect } from './HubRoleSelect'
import { getErrorMessage } from '@/lib/errors'

interface CreateRoleFormProps {
  projectId: number
  onSuccess: () => void
  onCancel?: () => void
}

const createRoleSchema = z.object({
  name: z.string().min(1, 'pages.roles.validation.nameRequired'),
  description: z.string().optional(),
  department_id: z.number().nullable().optional(),
  permission_ids: z.array(z.number()).min(1, 'pages.roles.validation.permissionsRequired'),
})

type CreateRoleFormData = z.infer<typeof createRoleSchema>

export function CreateRoleForm({ projectId, onSuccess, onCancel: _onCancel }: CreateRoleFormProps) {
  const { t } = useTranslation('common')
  const createMutation = useCreateRole()
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions()
  const { data: departmentsData, isLoading: loadingDepartments } = useDepartments({
    project_id: projectId,
    is_active: true,
  })
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])
  // KAN-757: per-tab access level keyed by permission_id.
  const [accessLevels, setAccessLevels] = useState<Record<number, string>>({})
  // Board #1621, rule 28.5: the chat template replaces «Роль у чаті (HUB)»
  // only on a build with the flag on; off, the form is as it was before it.
  // Both states are prepared on every render (hooks may not depend on it).
  const chatSettingsOn = isRoleChatSettingsEnabled()
  const catalog = useHubRoles(projectId)
  // Flag off - KAN-1476: HUB chat role; '' is "not set". The select shows -
  // and the save sends - the pick only while the current catalogue still
  // offers it as assignable: the catalogue is refetched under the open form
  // (after a refused save among others), and a pick it dropped falls back to
  // "not set" instead of hiding behind the first option while it is sent
  // again.
  const [hubRolePick, setHubRolePick] = useState('')
  const hubRole = effectiveHubRoleValue({
    options: catalog.options,
    stored: null,
    pick: hubRolePick,
    lock: null,
  })
  // Flag on - board #1621: the chat template the new role's chat set is
  // copied from; '' is "none" (the role is created not filled). The select
  // shows - and the save sends - the pick only while the current catalogue
  // still offers it as assignable, for the same reason.
  // Under impersonation the API refuses any template: none is offered or sent.
  const impersonating = useAuthStore((state) => state.isImpersonating)
  const [templatePick, setTemplatePick] = useState('')
  const chatTemplate = impersonating
    ? ''
    : effectiveChatTemplate(templatePick, catalog.chat.templates)
  // A chat refusal is said once, at the template (not again in the alert).
  // Without the template every refusal stays in the alert, as before it.
  const refusal =
    chatSettingsOn && createMutation.isError ? chatRefusal(createMutation.error) : null

  // Group permissions by category
  const permissions = useMemo(
    () => permissionsData?.permissions || [],
    [permissionsData?.permissions]
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
  } = useForm<CreateRoleFormData>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      permission_ids: [],
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

  const onSubmit = (data: CreateRoleFormData) => {
    const selectedSet = new Set(selectedPermissions)
    const access_levels: Record<number, string> = {}
    for (const [permId, level] of Object.entries(accessLevels)) {
      if (selectedSet.has(Number(permId))) {
        access_levels[Number(permId)] = level
      }
    }

    createMutation.mutate(
      {
        project_id: projectId,
        name: data.name,
        description: data.description || undefined,
        department_id: data.department_id,
        permission_ids: selectedPermissions,
        access_levels,
        ...(chatSettingsOn
          ? chatTemplateCreatePatch(catalog.chat, chatTemplate)
          : hubRoleCreatePatch(catalog.status, hubRole, catalog.options)),
      },
      {
        onSuccess: () => {
          onSuccess()
        },
        onError: (error) => {
          if (chatSettingsOn) {
            // The caller may not create a role from that template now: drop
            // the pick, so the select shows what a retry will send (no
            // template), and the refusal stays said in words at the field.
            if (dropsChatDraft(chatRefusal(error))) setTemplatePick('')
          } else if (isStaleHubCatalogueRefusal(error)) {
            // The backend refused the HUB chat role itself: drop the pick, so
            // the select shows what a retry will send (nothing), and the
            // refusal stays said in words below.
            setHubRolePick('')
          }
        },
      }
    )
  }

  const departments = useMemo(
    () => departmentsData?.departments || [],
    [departmentsData?.departments]
  )

  return (
    <form id="create-role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Role Name */}
      <div>
        <Label htmlFor="name" required>
          {t('pages.roles.forms.roleName')}
        </Label>
        <Input
          id="name"
          {...register('name')}
          placeholder={t('pages.roles.forms.placeholders.roleName')}
          disabled={createMutation.isPending}
        />
        {errors.name && (
          <p className="text-error-500 mt-1 text-sm">{t(errors.name.message ?? '')}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description" required>
          {t('pages.roles.forms.description')}
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder={t('pages.roles.forms.placeholders.description')}
          rows={3}
          disabled={createMutation.isPending}
        />
        {errors.description && (
          <p className="text-error-500 mt-1 text-sm">{errors.description.message}</p>
        )}
      </div>

      {/* Department Selection */}
      <div>
        <Label htmlFor="department_id">
          {t('pages.roles.forms.department')}
          <span className="text-muted-foreground ml-1 text-sm font-light">
            {t('pages.roles.forms.optional')}
          </span>
        </Label>
        <select
          id="department_id"
          {...register('department_id', {
            setValueAs: (v) => (v === '' || v === 'null' ? null : Number(v)),
          })}
          disabled={createMutation.isPending || loadingDepartments}
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
        {errors.department_id && (
          <p className="text-error-500 mt-1 text-sm">{errors.department_id.message}</p>
        )}
      </div>

      {chatSettingsOn ? (
        // HUB chat template (board #1621) - create only, while the catalogue offers it
        <ChatTemplateSelect
          catalog={catalog.chat}
          value={chatTemplate}
          onChange={setTemplatePick}
          disabled={createMutation.isPending}
          refusal={refusal}
          impersonating={impersonating}
        />
      ) : (
        // HUB chat role (KAN-1476) - only while the catalogue offers it
        <HubRoleSelect
          catalog={catalog}
          value={hubRole}
          onChange={setHubRolePick}
          disabled={createMutation.isPending}
        />
      )}

      {/* Permissions Section */}
      <div>
        <Label>
          {t('pages.roles.forms.permissions')}
          <span className="text-muted-foreground ml-2 text-sm font-light">
            {t('pages.roles.forms.selectedPermissions', {
              selected: selectedPermissions.length,
              total: permissions.length,
            })}
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
                                disabled={!isSelected || createMutation.isPending}
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
          <p className="text-error-500 mt-1 text-sm">{t(errors.permission_ids.message ?? '')}</p>
        )}
      </div>

      {/* Error Alert */}
      {createMutation.isError && refusal === null && (
        <Alert variant="error">
          <p className="text-sm">
            {createMutation.error
              ? getErrorMessage(createMutation.error)
              : t('pages.roles.forms.errors.failedToCreate')}
          </p>
        </Alert>
      )}
    </form>
  )
}
