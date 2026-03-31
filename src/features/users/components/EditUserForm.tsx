/**
 * EditUserForm Component
 *
 * Form for updating existing user information.
 * Matches the CreateUserForm layout and styling.
 * Cannot update username, password, or project/role assignments (separate endpoints).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateUser } from '../hooks/useUpdateUser'
import { updateUserSchema, type UpdateUserFormData } from '../schemas/userSchemas'
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
import { useRoles } from '@/features/roles'
import type { ApiProject } from '@/features/projects/types'
import type { ApiRole } from '@/features/roles/types'
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
  // Fetch only active roles (exclude archived/inactive roles)
  const { data: rolesData } = useRoles({ is_active: true })
  const allRoles: ApiRole[] = (rolesData?.roles || []).filter((role) => role.is_active)

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

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: user?.email || '',
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      middle_name: user?.middle_name || '',
      phone: user?.phone || '',
      language: (user?.language as 'en' | 'uk') || 'uk',
      timezone: user?.timezone || 'Europe/Kyiv',
      asterisk_extension: user?.asterisk_extension || '',
      is_agent: user?.is_agent || false,
    },
  })

  // Reset form when user data changes (basic fields only)
  useEffect(() => {
    if (user) {
      reset({
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        middle_name: user.middle_name || '',
        phone: user.phone || '',
        language: (user.language as 'en' | 'uk') || 'uk',
        timezone: user.timezone || 'Europe/Kyiv',
        asterisk_extension: user.asterisk_extension || '',
        is_agent: user.is_agent || false,
      })
    }
  }, [user, reset])

  // Check if user data is available - AFTER all hooks
  if (!user) {
    return <div className="py-8 text-center text-gray-600">No user data available</div>
  }

  // Helpers for project/role editing (only active roles)
  const getRolesForProject = (projectId: number): ApiRole[] =>
    allRoles.filter((role) => role.project_id === projectId && role.is_active)

  const onSubmit = (data: UpdateUserFormData) => {
    // Build payload for update with project assignments
    const payload: UpdateUserInput = {
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      middle_name: data.middle_name,
      phone: data.phone,
      language: data.language,
      timezone: data.timezone,
      asterisk_extension: data.asterisk_extension || undefined,
      is_agent: data.is_agent,
    }

    // Build project assignments array from all selected projects
    if (selectedProjects.length > 0) {
      payload.project_assignments = selectedProjects.map((projectId) => ({
        project_id: projectId,
        role_id: projectRoles[projectId],
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
            <h3 className="font-semibold">Error updating user</h3>
            <p className="mt-1 text-sm">{error?.message || 'Failed to update user'}</p>
          </div>
        </Alert>
      )}

      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="username">Username:</Label>
            <Input id="username" value={user.username} disabled className="mt-1 bg-gray-50" />
            <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
          </div>

          <div>
            <Label htmlFor="email" required>
              Email:
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              {...register('email')}
              aria-invalid={!!errors.email}
              variant={errors.email ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first_name" required>
              First Name:
            </Label>
            <Input
              id="first_name"
              placeholder="Enter first name"
              {...register('first_name')}
              aria-invalid={!!errors.first_name}
              variant={errors.first_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-500">{errors.first_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="last_name" required>
              Last Name:
            </Label>
            <Input
              id="last_name"
              placeholder="Enter last name"
              {...register('last_name')}
              aria-invalid={!!errors.last_name}
              variant={errors.last_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-500">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="middle_name">Middle Name:</Label>
            <Input
              id="middle_name"
              placeholder="Enter middle name (optional)"
              {...register('middle_name')}
              aria-invalid={!!errors.middle_name}
              variant={errors.middle_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.middle_name && (
              <p className="mt-1 text-sm text-red-500">{errors.middle_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone:</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1-555-0101 (optional)"
              {...register('phone')}
              aria-invalid={!!errors.phone}
              variant={errors.phone ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="language" required>
              Language:
            </Label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'uk'} onValueChange={field.onChange}>
                  <SelectTrigger className="border-light-50 text-dark-500 mt-1 w-full border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">Ukrainian</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.language && (
              <p className="mt-1 text-sm text-red-500">{errors.language.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="timezone" required>
              Timezone:
            </Label>
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'Europe/Kyiv'} onValueChange={field.onChange}>
                  <SelectTrigger className="border-light-50 text-dark-500 mt-1 w-full border text-sm">
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
              <p className="mt-1 text-sm text-red-500">{errors.timezone.message}</p>
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
              {...register('asterisk_extension')}
              aria-invalid={!!errors.asterisk_extension}
              variant={errors.asterisk_extension ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.asterisk_extension && (
              <p className="mt-1 text-sm text-red-500">{errors.asterisk_extension.message}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {t('pages.users.forms.helpers.asteriskExtension')}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-7">
            <Controller
              name="is_agent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="is_agent"
                  checked={field.value || false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
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
        <h3 className="text-dark-500 text-sm font-semibold">Assign Projects:</h3>
        <div className="flex flex-wrap gap-4">
          {projects.map((project) => {
            const isChecked = selectedProjects.includes(project.id)
            return (
              <label
                key={project.id}
                className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm font-light"
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
          <h3 className="text-dark-500 text-sm font-semibold">
            {t('pages.users.forms.rolePerProject')}
          </h3>
          <div className="space-y-3">
            {selectedProjects.map((projectId) => {
              const project = projects.find((p) => p.id === projectId)
              const availableRoles = getRolesForProject(projectId)
              const selectedRoleId = projectRoles[projectId]

              return (
                <div
                  key={projectId}
                  className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4"
                >
                  <span className="text-dark-500 text-sm font-light">{project?.name}:</span>
                  <Select
                    value={selectedRoleId?.toString() || ''}
                    onValueChange={(value) => {
                      const roleId = parseInt(value, 10)
                      setProjectRoles((prev) => ({ ...prev, [projectId]: roleId }))
                    }}
                  >
                    <SelectTrigger className="border-light-50 text-dark-500 mt-1 w-full border text-sm">
                      <SelectValue placeholder={t('pages.users.forms.notAssigned')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.length > 0 ? (
                        availableRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
                          </SelectItem>
                        ))
                      ) : (
                        // Radix Select does not allow empty-string values for items
                        <SelectItem value="no-roles-available" disabled>
                          {t('pages.users.forms.noRolesAvailable')}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
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
