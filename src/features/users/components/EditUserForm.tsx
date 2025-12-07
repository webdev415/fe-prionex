/**
 * EditUserForm Component
 *
 * Form for updating existing user information.
 * Matches the CreateUserForm layout and styling.
 * Cannot update username, password, or project/role assignments (separate endpoints).
 */

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateUser } from '../hooks/useUpdateUser'
import { updateUserSchema, type UpdateUserFormData } from '../schemas/userSchemas'
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
import { colors } from '@/lib/colors'
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
  const { mutate, isError, error } = useUpdateUser()

  // Project/role assignment state (UI only, similar to CreateUserForm)
  const { data: projectsData } = useProjects()
  const projects: ApiProject[] = projectsData?.projects || []
  const { data: rolesData } = useRoles({})
  const allRoles: ApiRole[] = rolesData?.roles || []

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
      language: (user?.language as 'uk' | 'ru' | 'en') || 'uk',
      timezone: user?.timezone || 'Europe/Kyiv',
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
        language: (user.language as 'uk' | 'ru' | 'en') || 'uk',
        timezone: user.timezone || 'Europe/Kyiv',
      })
    }
  }, [user, reset])

  // Check if user data is available - AFTER all hooks
  if (!user) {
    return <div className="py-8 text-center text-gray-600">No user data available</div>
  }

  // Helpers for project/role editing
  const getRolesForProject = (projectId: number): ApiRole[] =>
    allRoles.filter((role) => role.project_id === projectId)

  const onSubmit = (data: UpdateUserFormData) => {
    // Build payload for update
    const payload: UpdateUserFormData & { project_id?: number; role_id?: number } = {
      ...data,
    }

    // If there is at least one selected project with a role, send it to backend
    if (selectedProjects.length > 0) {
      const firstProjectId = selectedProjects[0]
      const firstRoleId = projectRoles[firstProjectId]
      if (firstProjectId && firstRoleId) {
        payload.project_id = firstProjectId
        payload.role_id = firstRoleId
      }
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">Username:</Label>
            <Input
              id="username"
              value={user.username}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
            <p className="mt-1 text-xs" style={{ color: colors.gray[500] }}>
              Username cannot be changed
            </p>
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
        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="language" required>
              Language:
            </Label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'uk'} onValueChange={field.onChange}>
                  <SelectTrigger
                    className="mt-1 w-full border"
                    style={{
                      borderColor: colors.light[100],
                      fontSize: '14px',
                      color: colors.neutral.dark[500],
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">Ukrainian</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ru">Russian</SelectItem>
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
                  <SelectTrigger
                    className="mt-1 w-full border"
                    style={{
                      borderColor: colors.light[100],
                      fontSize: '14px',
                      color: colors.neutral.dark[500],
                    }}
                  >
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

      {/* Assign Projects Section (editable, similar to CreateUserForm) */}
      <div className="mt-4 mb-0 space-y-4">
        <h3
          className="text-sm font-semibold"
          style={{ color: colors.neutral.dark[500], fontSize: '14px' }}
        >
          Assign Projects:
        </h3>
        <div className="flex flex-wrap gap-4">
          {projects.map((project) => {
            const isChecked = selectedProjects.includes(project.id)
            return (
              <label
                key={project.id}
                className="flex cursor-pointer items-center gap-2 text-sm font-light"
                style={{ color: colors.neutral.dark[500] }}
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
          <h3
            className="text-sm font-semibold"
            style={{ color: colors.neutral.dark[500], fontSize: '14px' }}
          >
            Role per Project:
          </h3>
          <div className="space-y-3">
            {selectedProjects.map((projectId) => {
              const project = projects.find((p) => p.id === projectId)
              const availableRoles = getRolesForProject(projectId)
              const selectedRoleId = projectRoles[projectId]

              return (
                <div key={projectId} className="grid w-full grid-cols-2 items-center gap-4">
                  <span className="text-sm font-light" style={{ color: colors.neutral.dark[500] }}>
                    {project?.name}:
                  </span>
                  <Select
                    value={selectedRoleId?.toString() || ''}
                    onValueChange={(value) => {
                      const roleId = parseInt(value, 10)
                      setProjectRoles((prev) => ({ ...prev, [projectId]: roleId }))
                    }}
                  >
                    <SelectTrigger
                      className="mt-1 w-full border"
                      style={{
                        borderColor: colors.light[100],
                        fontSize: '14px',
                        color: colors.neutral.dark[500],
                      }}
                    >
                      <SelectValue placeholder="Not assigned" />
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
                          No roles available
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
