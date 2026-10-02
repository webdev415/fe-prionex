/**
 * EditRoleForm Component
 *
 * Form for editing an existing role.
 * Logic matches backend:
 * - Default roles: name/description are read-only (backend prevents changes)
 * - Custom roles: name/description are editable
 * - Permissions: always editable (no backend restriction)
 * - HUB chat rights: one of two, by the build flag VITE_ROLE_CHAT_SETTINGS_ENABLED
 *   (roleChatSettingsFlag.ts):
 *   - off: HUB chat role (KAN-1476): shown only while the catalogue is
 *     enabled; read only for default roles and for a value the caller may not
 *     grant (see hubRoleLock); sent only when somebody changed it to a value
 *     the current catalogue offers (see effectiveHubRoleValue and
 *     buildRolePayload.ts)
 *   - on: HUB chat settings (board #1621): the eight switches and the role
 *     screen as GET returned them; editable with manage_roles while the
 *     catalogue's values are known, shown as text otherwise; sent only when
 *     they differ from the stored ones or fill a role that is not filled (see
 *     buildRolePayload.ts). «Роль у чаті (HUB)» is not in the form, and
 *     hub_role is never sent.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUpdateRole } from '../hooks/useRoleMutations'
import { usePermissions } from '../hooks/useRoleMutations'
import { useHubRoles } from '../hooks/useHubRoles'
import { useHasPermission } from '@/hooks/usePermissions'
import { useAuthStore } from '@/stores/authStore'
import { PERMISSIONS } from '@/constants/permissions'
import { useDepartments } from '@/features/departments'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import type { RoleDetailResponse, UpdateRoleInput } from '../types'
import { ACCESS_LEVEL_OPTIONS, DEFAULT_ACCESS_LEVEL, isTabAccessPermission } from '../accessLevels'
import {
  DEFAULT_HOME_PLANE,
  NO_ACCESS_SWITCHES,
  chatRefusal,
  dropsChatDraft,
  orderedSwitches,
  storedChatSwitches,
  type ChatDraft,
} from '../chatRoleSet'
import { effectiveHubRoleValue, hubRoleLock, isStaleHubCatalogueRefusal } from '../hubRoles'
import { chatUpdatePatch, hubRoleUpdatePatch } from '../buildRolePayload'
import { isRoleChatSettingsEnabled } from '../roleChatSettingsFlag'
import { ChatSettingsSection } from './ChatSettingsSection'
import { HubRoleSelect } from './HubRoleSelect'
import { getErrorMessage } from '@/lib/errors'

interface EditRoleFormProps {
  role: RoleDetailResponse
  projectName: string
  onSuccess: () => void
  onCancel?: () => void
}

// Schema for editing roles - always use full schema, disable fields for default roles
const editRoleSchema = z.object({
  name: z.string().min(1, 'pages.roles.validation.nameRequired'),
  description: z.string().optional(),
  department_id: z.number().nullable().optional(),
  permission_ids: z.array(z.number()).min(1, 'pages.roles.validation.permissionsRequired'),
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

  // Board #1621, rule 28.5: the chat settings replace «Роль у чаті (HUB)»
  // only on a build with the flag on; off, the form is as it was before them.
  // Both states are prepared on every render (hooks may not depend on it).
  const chatSettingsOn = isRoleChatSettingsEnabled()
  const catalog = useHubRoles(role.project_id)

  // Flag off - KAN-1476: HUB chat role; '' is "not set". The select shows the
  // stored value until somebody picks one, and only a pick is ever sent. The
  // stored value is read from `role` on every render, never copied at mount:
  // EditRoleModal renders the cached detail first and its background refetch
  // hands this form a new `role`. A copy would send the old value back with a
  // save of permissions only, as if somebody had chosen it. The pick, in
  // turn, holds only while the current catalogue offers it as assignable -
  // otherwise the select shows, and the save sends, the stored value again.
  const storedHubRole = role.hub_role ?? null
  const [hubRolePick, setHubRolePick] = useState<string | null>(null)
  const hubLock = hubRoleLock(catalog.options, storedHubRole, isDefaultRole)
  const hubRole = effectiveHubRoleValue({
    options: catalog.options,
    stored: storedHubRole,
    pick: hubRolePick,
    lock: hubLock,
  })

  // Flag on - board #1621: the HUB chat settings. The section shows the
  // stored values until somebody changes one, and only such a draft is ever
  // sent. The stored values are read from `role` on every render, never
  // copied at mount: EditRoleModal renders the cached detail first and its
  // background refetch hands this form a new `role`; a copy would send the
  // old values back with a save of permissions only. The values to choose
  // from come from the catalogue - without them the section shows text only.
  const canManageRoles = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_ROLES)
  // Under impersonation the API refuses any chat field (403
  // HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING), so the section shows values only.
  const impersonating = useAuthStore((state) => state.isImpersonating)
  const chatEditable =
    chatSettingsOn && canManageRoles && !impersonating && catalog.chat.status === 'ready'
  const stored = storedChatSwitches(role.chat_switches)
  const storedSwitches = stored.kind === 'filled' ? stored.switches : null
  const storedHomePlane = role.home_plane ?? DEFAULT_HOME_PLANE
  // The draft remembers the stored values it was started from. When those
  // change under the open form (the detail is refetched - somebody else
  // saved), the draft is dropped and the section says so: resending it would
  // silently undo the other change. A section that stops being editable
  // drops its draft too, so a hidden draft can never come back and be sent.
  // The key is built from the values read, not the raw object: a refetch that
  // returns the same values with the keys in another order is no change.
  const storedKey = JSON.stringify([
    stored.kind === 'filled' ? orderedSwitches(stored.switches) : stored.kind,
    storedHomePlane,
  ])
  const [chatDraft, setChatDraft] = useState<{ value: ChatDraft; base: string } | null>(null)
  const [chatDraftOutdated, setChatDraftOutdated] = useState(false)
  if (chatDraft !== null && (!chatEditable || chatDraft.base !== storedKey)) {
    setChatDraft(null)
    setChatDraftOutdated(chatDraft.base !== storedKey)
  }
  const draft =
    chatDraft !== null && chatEditable && chatDraft.base === storedKey ? chatDraft.value : null
  const startDraft = (value: ChatDraft) => {
    setChatDraft({ value, base: storedKey })
    setChatDraftOutdated(false)
  }
  // A chat refusal is said once, in the section (not again in the alert).
  // Without the section every refusal stays in the alert, as before it.
  const refusal =
    chatSettingsOn && updateMutation.isError ? chatRefusal(updateMutation.error) : null

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
    } & UpdateRoleInput = {
      permission_ids: selectedPermissions,
      access_levels,
      ...(chatSettingsOn
        ? chatUpdatePatch({
            editable: chatEditable,
            stored: storedSwitches,
            storedHomePlane,
            draft,
          })
        : hubRoleUpdatePatch({
            status: catalog.status,
            lock: hubLock,
            stored: storedHubRole,
            selected: hubRole,
            options: catalog.options,
          })),
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
        onError: (error) => {
          if (chatSettingsOn) {
            // The caller may not make this chat change now (403): drop the
            // draft, so the section shows the stored values a retry leaves
            // alone, and the refusal stays said in words. A 422 keeps the
            // draft, to be corrected.
            if (dropsChatDraft(chatRefusal(error))) setChatDraft(null)
          } else if (isStaleHubCatalogueRefusal(error)) {
            // The backend refused the HUB chat role itself: drop the pick, so
            // the select shows the stored value a retry leaves alone, and the
            // refusal stays said in words below.
            setHubRolePick(null)
          }
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
                {t((errors.name as { message?: string })?.message ?? '')}
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
            <span className="text-muted-foreground ml-1 text-sm font-light">
              {t('pages.roles.forms.optional')}
            </span>
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

      {chatSettingsOn ? (
        // HUB chat settings (board #1621)
        <ChatSettingsSection
          switches={draft ? draft.switches : storedSwitches}
          homePlane={draft ? draft.homePlane : storedHomePlane}
          editable={chatEditable}
          catalog={catalog.chat}
          followsHubRole={role.chat_set_follows_hub_role}
          unreadable={stored.kind === 'unreadable'}
          outdated={chatDraftOutdated}
          filling={storedSwitches === null && draft !== null}
          onFill={() =>
            startDraft({ switches: { ...NO_ACCESS_SWITCHES }, homePlane: storedHomePlane })
          }
          onCancelFill={() => setChatDraft(null)}
          onChange={(switches, homePlane) => startDraft({ switches, homePlane })}
          disabled={updateMutation.isPending}
          refusal={refusal}
          readOnlyNote={
            !canManageRoles || catalog.chat.forbidden
              ? 'noRight'
              : impersonating
                ? 'impersonating'
                : catalog.chat.status === 'unavailable'
                  ? 'catalogue'
                  : null
          }
        />
      ) : (
        // HUB chat role (KAN-1476) - only while the catalogue offers it
        <HubRoleSelect
          catalog={catalog}
          value={hubRole}
          onChange={setHubRolePick}
          stored={storedHubRole}
          lock={hubLock}
          disabled={updateMutation.isPending}
        />
      )}

      {/* Permissions Section (Always Editable - No Backend Restriction) */}
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
          <p className="text-error-500 mt-1 text-sm">{t(errors.permission_ids.message ?? '')}</p>
        )}
      </div>

      {/* Error Alert */}
      {updateMutation.isError && refusal === null && (
        <Alert variant="error">
          <p className="text-sm">
            {updateMutation.error
              ? getErrorMessage(updateMutation.error)
              : t('pages.roles.forms.errors.failedToUpdate')}
          </p>
        </Alert>
      )}
    </form>
  )
}
