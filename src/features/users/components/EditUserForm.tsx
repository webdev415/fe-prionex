/**
 * EditUserForm Component
 *
 * Form for updating existing user information.
 * Matches the CreateUserForm layout and styling.
 * Cannot update username, password, or project/role assignments (separate endpoints).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateUser } from '../hooks/useUpdateUser'
import {
  AGENT_EXTENSION_REQUIRED_MESSAGE,
  updateUserSchema,
  type UpdateUserFormData,
} from '../schemas/userSchemas'
import type { UpdateUserInput } from '../types'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import type { UserDetailResponse } from '../types'
import { useProjects } from '@/features/projects'
import { ProjectRoleGroupRow } from './ProjectRoleGroupRow'
import type { ApiProject } from '@/features/projects/types'
import { Checkbox } from '@/components/ui/Checkbox'

interface EditUserFormProps {
  user: UserDetailResponse
  onSuccess: () => void
  onCancel?: () => void
}

export function EditUserForm({ user, onSuccess }: EditUserFormProps) {
  const { t } = useTranslation('common')
  const { mutate, isError, error } = useUpdateUser()

  // Project/role assignment state (UI only, similar to CreateUserForm)
  const { data: projectsData } = useProjects()
  const projects: ApiProject[] = projectsData?.projects || []

  const [selectedProjects, setSelectedProjects] = useState<number[]>(() =>
    (user.projects || []).map((p) => p.project_id)
  )
  const [projectRoles, setProjectRoles] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {}
    ;(user.projects || []).forEach((p) => {
      initial[p.project_id] = p.role_id
    })
    return initial
  })
  const [projectGroups, setProjectGroups] = useState<Record<number, number | undefined>>(() => {
    const initial: Record<number, number | undefined> = {}
    ;(user.projects || []).forEach((p) => {
      initial[p.project_id] = p.group_id ?? undefined
    })
    return initial
  })

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: user?.email || '',
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      middle_name: user?.middle_name || '',
      phone: user?.phone || '',
      language: (user?.language as 'en' | 'uk' | 'es') || 'uk',
      timezone: user?.timezone || 'Europe/Kyiv',
      asterisk_extension: user?.asterisk_extension || '',
      dialer_extension: user?.dialer_extension || '',
      is_agent: user?.is_agent || false,
    },
  })

  const isAgent = useWatch({ control, name: 'is_agent' }) === true

  const loadedIsAgent = user.is_agent || false

  /**
   * Is Agent decides whether the extensions belong to this account, so a real
   * change of that answer empties them. A toggle that ends where it started is
   * not a change of answer, though, and two stray clicks are not a decision.
   *
   * Both directions matter, because the account decides which one a double
   * click takes. An operator starts checked, so it reads as uncheck then
   * check. An account that predates this rule starts unchecked with an
   * extension still stored against it, so the same two clicks read as check
   * then uncheck and end on the clear. Keying the restore on returning to the
   * loaded state covers both; keying it on the clear covers only the first,
   * and leaves exactly the accounts this protects losing both fields to a
   * misclick, with nothing in the interface to get them back.
   */
  const handleIsAgentToggle = (next: boolean, onChange: (value: boolean) => void) => {
    onChange(next)
    if (!next) clearAgentExtensions()
    if (next === loadedIsAgent) restoreAgentExtensions()
  }

  /**
   * Called from the toggle rather than an effect watching `is_agent`. An
   * effect also runs on mount and again on the reset() that seeds the form,
   * and some accounts predate this rule: unchecked while an extension is still
   * stored against them. Their values must survive an open-and-close, so
   * emptying the fields has to be something the admin did rather than
   * something the state is.
   *
   * `shouldDirty` matters as much as the value: the payload sends a cleared
   * extension only when the field is dirty, so without it the field empties on
   * screen and the record keeps its extension.
   */
  const clearAgentExtensions = () => {
    setValue('asterisk_extension', '', { shouldDirty: true, shouldValidate: true })
    setValue('dialer_extension', '', { shouldDirty: true, shouldValidate: true })
  }

  /**
   * Puts back what the record holds, not what was on screen a moment ago.
   *
   * Reading from `user` rather than remembering the field's last value is the
   * whole point. Remembering it meant deciding, at clear time, whether a field
   * was worth keeping -- and a field the admin had typed into looked not worth
   * keeping, because re-checking is not meant to bring a typed value back. But
   * a typed field still has a stored value sitting behind it, and skipping the
   * field threw that away too: the box ended where it started while the record
   * lost an extension nobody chose to remove.
   *
   * A typed value is still not restored. The field goes back to what the
   * record says, which is not what they entered. And since that is the form's
   * default, the dirty flag clears with it and the payload omits the key, so a
   * no-op toggle sends nothing at all.
   */
  const restoreAgentExtensions = () => {
    setValue('asterisk_extension', user.asterisk_extension || '', {
      shouldDirty: true,
      shouldValidate: true,
    })
    setValue('dialer_extension', user.dialer_extension || '', {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  // Reset form when user data changes (basic fields only)
  useEffect(() => {
    if (user) {
      reset({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        middle_name: user.middle_name || '',
        phone: user.phone || '',
        language: (user.language as 'en' | 'uk' | 'es') || 'uk',
        timezone: user.timezone || 'Europe/Kyiv',
        asterisk_extension: user.asterisk_extension || '',
        dialer_extension: user.dialer_extension || '',
        is_agent: user.is_agent || false,
      })
    }
  }, [user, reset])

  // Check if user data is available - AFTER all hooks
  if (!user) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        {t('pages.users.forms.edit.noUserData')}
      </div>
    )
  }

  const onSubmit = (data: UpdateUserFormData) => {
    // Enforced here rather than in the schema, and only once the admin has had
    // a hand in it. A few accounts predate this rule and are already agents
    // with no extension; a schema-level rule would block their form over a
    // field nobody touched, which is the same inherited inconsistency the
    // unchecked-but-populated case is deliberately left alone.
    if (
      (dirtyFields.is_agent || dirtyFields.asterisk_extension) &&
      data.is_agent &&
      !data.asterisk_extension
    ) {
      setError('asterisk_extension', {
        type: 'manual',
        message: AGENT_EXTENSION_REQUIRED_MESSAGE,
      })
      return
    }

    // Build payload for update with project assignments
    const payload: UpdateUserInput = {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_name: data.middle_name,
      phone: data.phone,
      language: data.language,
      timezone: data.timezone,
      // Both extensions are sent only when they actually changed, so an
      // emptied field arrives as '' (which the backend clears — and
      // deprovisions the operator), while an untouched field is omitted and
      // left alone.
      //
      // `|| undefined` was wrong for asterisk_extension: a cleared field is
      // '', which that turns into undefined, which the payload drops. The
      // backend applies exclude_unset, so unchecking Is Agent emptied the box
      // on screen, saved without complaint, and left the extension assigned to
      // a user who is no longer an operator.
      asterisk_extension: dirtyFields.asterisk_extension
        ? (data.asterisk_extension ?? '')
        : undefined,
      dialer_extension: dirtyFields.dialer_extension ? (data.dialer_extension ?? '') : undefined,
      is_agent: data.is_agent,
    }

    // Build project assignments array from all selected projects
    if (selectedProjects.length > 0) {
      payload.project_assignments = selectedProjects.map((projectId) => ({
        project_id: projectId,
        role_id: projectRoles[projectId],
        group_id: projectGroups[projectId],
      }))
    }

    mutate(
      { userId: user.id, data: payload },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  return (
    <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {isError && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold">{t('pages.users.forms.edit.errorUpdating')}</h3>
            <p className="mt-1 text-sm">
              {error?.message || t('pages.users.forms.edit.failedToUpdate')}
            </p>
          </div>
        </Alert>
      )}

      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="username">{t('pages.users.forms.edit.username')}</Label>
            <Input id="username" value={user.username} disabled className="bg-muted mt-1" />
            <p className="text-muted-foreground mt-1 text-xs">
              {t('pages.users.forms.edit.usernameCannotChange')}
            </p>
          </div>

          <div>
            <Label htmlFor="email" required>
              {t('pages.users.forms.edit.email')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t('pages.users.forms.placeholders.email')}
              {...register('email')}
              aria-invalid={!!errors.email}
              variant={errors.email ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{t(errors.email.message ?? '')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first_name" required>
              {t('pages.users.forms.edit.firstName')}
            </Label>
            <Input
              id="first_name"
              placeholder={t('pages.users.forms.placeholders.firstName')}
              {...register('first_name')}
              aria-invalid={!!errors.first_name}
              variant={errors.first_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-500">{t(errors.first_name.message ?? '')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="last_name" required>
              {t('pages.users.forms.edit.lastName')}
            </Label>
            <Input
              id="last_name"
              placeholder={t('pages.users.forms.placeholders.lastName')}
              {...register('last_name')}
              aria-invalid={!!errors.last_name}
              variant={errors.last_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-500">{t(errors.last_name.message ?? '')}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="middle_name">{t('pages.users.forms.edit.middleName')}</Label>
            <Input
              id="middle_name"
              placeholder={t('pages.users.forms.placeholders.middleName')}
              {...register('middle_name')}
              aria-invalid={!!errors.middle_name}
              variant={errors.middle_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.middle_name && (
              <p className="mt-1 text-sm text-red-500">{t(errors.middle_name.message ?? '')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">{t('pages.users.forms.edit.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t('pages.users.forms.placeholders.phone')}
              {...register('phone')}
              aria-invalid={!!errors.phone}
              variant={errors.phone ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-500">{t(errors.phone.message ?? '')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="language" required>
              {t('pages.users.forms.edit.language')}
            </Label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'uk'} onValueChange={field.onChange}>
                  <SelectTrigger className="border-border text-foreground mt-1 w-full border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">{t('language.uk')}</SelectItem>
                    <SelectItem value="en">{t('language.en')}</SelectItem>
                    <SelectItem value="es">{t('language.es')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.language && (
              <p className="mt-1 text-sm text-red-500">{t(errors.language.message ?? '')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="timezone" required>
              {t('pages.users.forms.edit.timezone')}
            </Label>
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'Europe/Kyiv'} onValueChange={field.onChange}>
                  <SelectTrigger className="border-border text-foreground mt-1 w-full border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Kyiv">Europe/Kyiv (EET/EEST)</SelectItem>
                    <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                    <SelectItem value="America/New_York">America/New York (EST/EDT)</SelectItem>
                    <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                    <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      America/Los Angeles (PST/PDT)
                    </SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                    <SelectItem value="Europe/Kiev">Europe/Kiev (EET/EEST)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.timezone && (
              <p className="mt-1 text-sm text-red-500">{t(errors.timezone.message ?? '')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Call Settings Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="asterisk_extension">{t('pages.users.forms.asteriskExtension')}</Label>
            <Input
              id="asterisk_extension"
              placeholder="1001"
              disabled={!isAgent}
              {...register('asterisk_extension')}
              aria-invalid={!!errors.asterisk_extension}
              variant={errors.asterisk_extension ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.asterisk_extension && (
              <p className="mt-1 text-sm text-red-500">
                {t(errors.asterisk_extension.message ?? '')}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t('pages.users.forms.helpers.asteriskExtension')}
            </p>
          </div>

          <div>
            <Label htmlFor="dialer_extension">{t('pages.users.forms.dialerExtension')}</Label>
            <Input
              id="dialer_extension"
              placeholder="9001"
              disabled={!isAgent}
              {...register('dialer_extension')}
              aria-invalid={!!errors.dialer_extension}
              variant={errors.dialer_extension ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.dialer_extension && (
              <p className="mt-1 text-sm text-red-500">
                {t(errors.dialer_extension.message ?? '')}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t('pages.users.forms.helpers.dialerExtension')}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:pt-1">
            <Controller
              name="is_agent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="is_agent"
                  checked={field.value || false}
                  onCheckedChange={(checked) =>
                    handleIsAgentToggle(checked === true, field.onChange)
                  }
                />
              )}
            />
            <Label htmlFor="is_agent" className="mb-0 cursor-pointer">
              {t('pages.users.forms.isAgent')}
            </Label>
          </div>
        </div>
      </div>

      {/* Assign Projects Section (editable, similar to CreateUserForm) */}
      <div className="mt-4 mb-0 space-y-4">
        <h3 className="text-foreground text-sm font-semibold">
          {t('pages.users.forms.edit.assignProjects')}
        </h3>
        <div className="flex flex-wrap gap-4">
          {projects.map((project) => {
            const isChecked = selectedProjects.includes(project.id)
            return (
              <label
                key={project.id}
                className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-light"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    const isNowChecked = checked === true
                    setSelectedProjects((prev) =>
                      isNowChecked ? [...prev, project.id] : prev.filter((id) => id !== project.id)
                    )
                    if (!isNowChecked) {
                      setProjectRoles((prev) => {
                        const next = { ...prev }
                        delete next[project.id]
                        return next
                      })
                      setProjectGroups((prev) => {
                        const next = { ...prev }
                        delete next[project.id]
                        return next
                      })
                    }
                  }}
                />
                <span className="font-light">{project.name}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Role per Project Section (editable) */}
      {selectedProjects.length > 0 && (
        <div className="mt-4 mb-0 space-y-4">
          <h3 className="text-foreground text-sm font-semibold">
            {t('pages.users.forms.rolePerProject')}
          </h3>
          <div className="space-y-3">
            {selectedProjects.map((projectId) => (
              <ProjectRoleGroupRow
                key={projectId}
                projectId={projectId}
                projectName={projects.find((p) => p.id === projectId)?.name}
                selectedRoleId={projectRoles[projectId]}
                selectedGroupId={projectGroups[projectId]}
                onRoleChange={(roleId) => {
                  setProjectRoles((prev) => ({ ...prev, [projectId]: roleId }))
                  setProjectGroups((prev) => {
                    const next = { ...prev }
                    delete next[projectId]
                    return next
                  })
                }}
                onGroupChange={(groupId) =>
                  setProjectGroups((prev) => ({ ...prev, [projectId]: groupId }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Form Actions - These will be rendered in ModalFooter */}
      <div className="hidden">
        <button type="submit" id="submit-form" />
      </div>
    </form>
  )
}
