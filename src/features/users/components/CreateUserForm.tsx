/**
 * CreateUserForm Component
 *
 * Form for creating a new user with validation.
 * Matches the design: User Credentials, Assign Projects, Role per Project, Status.
 * All fields match the backend API requirements from api-prionex.
 */

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateUser } from '../hooks/useCreateUser'
import { useRoles } from '@/features/roles'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { createUserSchema } from '../schemas/userSchemas'

interface Project {
  id: number
  name: string
  code: string
}

interface Role {
  id: number
  name: string
  project_id: number
}

interface CreateUserFormProps {
  projects: Project[]
  onSuccess: () => void
  onCancel?: () => void
}

// Extended schema to support multiple projects with roles (for UI)
// The API only accepts one project_id and role_id, so we'll use the first selected
const createUserFormSchema = createUserSchema
  .extend({
    confirmPassword: z.string(),
    selectedProjects: z.array(z.number()).min(1, 'Please select at least one project'),
    projectRoles: z.record(z.string(), z.number()),
  })
  .omit({ project_id: true, role_id: true })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      // Check if every selected project has a role assigned
      return data.selectedProjects.every((projectId) => {
        const projectIdStr = String(projectId)
        return data.projectRoles[projectIdStr] !== undefined
      })
    },
    {
      message: 'Please assign a role for each selected project',
      path: ['projectRoles'],
    }
  )

type CreateUserFormData = z.infer<typeof createUserFormSchema>

export function CreateUserForm({ projects, onSuccess }: CreateUserFormProps) {
  const { mutate, isError, error } = useCreateUser()
  const [selectedProjects, setSelectedProjects] = useState<number[]>([])
  const [projectRoles, setProjectRoles] = useState<Record<number, number>>({})

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<CreateUserFormData>({
    // zodResolver typing doesn't fully match our extended schema; cast is safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createUserFormSchema) as any,
    defaultValues: {
      language: 'uk' as const,
      timezone: 'Europe/Kyiv',
      must_change_password: false,
      selectedProjects: [] as number[],
      projectRoles: {} as Record<string, number>,
    },
  })

  // Fetch all roles and filter by project (exclude archived/inactive roles)
  const { data: rolesData } = useRoles({ is_active: true })
  const allRoles = (rolesData?.roles || []).filter((role) => role.is_active)

  const handleProjectToggle = async (projectId: number, checked: boolean) => {
    const newSelected = checked
      ? [...selectedProjects, projectId]
      : selectedProjects.filter((id) => id !== projectId)

    setSelectedProjects(newSelected)
    setValue('selectedProjects', newSelected, { shouldValidate: true })

    if (!checked) {
      // Remove role assignment when project is unchecked
      const newRoles = { ...projectRoles }
      delete newRoles[projectId]
      setProjectRoles(newRoles)
      // Convert number keys to string keys for form validation
      const projectRolesForForm: Record<string, number> = {}
      Object.keys(newRoles).forEach((key) => {
        projectRolesForForm[String(key)] = newRoles[Number(key)]
      })
      setValue('projectRoles', projectRolesForForm, { shouldValidate: true })
      // Manually trigger validation to ensure the error clears
      await trigger(['projectRoles', 'selectedProjects'])
    } else {
      // When a project is checked, trigger validation to show error if no role is assigned
      await trigger(['projectRoles', 'selectedProjects'])
    }
  }

  const handleRoleChange = async (projectId: number, roleId: number) => {
    const newRoles = { ...projectRoles, [projectId]: roleId }
    setProjectRoles(newRoles)
    // Convert number keys to string keys for form validation
    const projectRolesForForm: Record<string, number> = {}
    Object.keys(newRoles).forEach((key) => {
      projectRolesForForm[String(key)] = newRoles[Number(key)]
    })
    setValue('projectRoles', projectRolesForForm, { shouldValidate: true })
    // Manually trigger validation for both fields to ensure cross-field validation runs
    await trigger(['projectRoles', 'selectedProjects'])
  }

  // Get roles for a specific project (only active roles)
  const getRolesForProject = (projectId: number): Role[] => {
    return allRoles.filter((role) => role.project_id === projectId && role.is_active)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    const formData = data as CreateUserFormData
    // API only accepts one project_id and role_id, so we use the first selected
    const firstProjectId = formData.selectedProjects[0]
    const firstRoleId = formData.projectRoles[String(firstProjectId)]

    if (!firstProjectId || !firstRoleId) {
      return
    }

    // Note: status is not sent to API as users are always created as "active"
    mutate(
      {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || undefined,
        phone: formData.phone || undefined,
        language: formData.language || 'uk',
        timezone: formData.timezone || 'Europe/Kyiv',
        must_change_password: formData.must_change_password || false,
        project_id: firstProjectId,
        role_id: firstRoleId,
      },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  return (
    <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* API Error Alert */}
      {isError && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold">Error creating user</h3>
            <p className="mt-1 text-sm">{error?.message || 'Failed to create user'}</p>
          </div>
        </Alert>
      )}

      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username" required>
              Username:
            </Label>
            <Input
              id="username"
              placeholder="Enter your username"
              {...register('username')}
              aria-invalid={!!errors.username}
              variant={errors.username ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>
            )}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="password" required>
              Password:
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register('password')}
              aria-invalid={!!errors.password}
              variant={errors.password ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword" required>
              Confirm Password:
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              aria-invalid={!!errors.confirmPassword}
              variant={errors.confirmPassword ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="must_change_password"
            checked={getValues('must_change_password') || false}
            onCheckedChange={(checked) => setValue('must_change_password', checked === true)}
          />
          <Label htmlFor="must_change_password" className="mb-0 cursor-pointer">
            Must change password on first login
          </Label>
        </div>
      </div>

      {/* Name Fields Section - Required by API */}
      <div className="space-y-4">
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
      <div className="space-y-4">
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
                      borderColor: '#F2F3F0',
                      fontSize: '14px',
                      color: '#1A1A1A',
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
                      borderColor: '#F2F3F0',
                      fontSize: '14px',
                      color: '#1A1A1A',
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

      {/* Assign Projects Section */}
      <div className="mt-4 mb-0 space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A', fontSize: '14px' }}>
          Assign Projects:
        </h3>
        <div className="flex flex-wrap gap-4">
          {projects.map((project) => {
            const isChecked = selectedProjects.includes(project.id)
            return (
              <label
                key={project.id}
                className="flex cursor-pointer items-center gap-2 text-sm font-light"
                style={{ color: '#1A1A1A' }}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleProjectToggle(project.id, checked === true)}
                />
                <span className="font-light">{project.name}</span>
              </label>
            )
          })}
        </div>
        {errors.selectedProjects && (
          <p className="text-sm text-red-500">{errors.selectedProjects.message}</p>
        )}
      </div>

      {/* Role per Project Section */}
      {selectedProjects.length > 0 && (
        <div className="mt-4 mb-0 space-y-4">
          <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A', fontSize: '14px' }}>
            Role per Project:
          </h3>
          <div className="space-y-3">
            {selectedProjects.map((projectId) => {
              const project = projects.find((p) => p.id === projectId)
              const availableRoles = getRolesForProject(projectId)
              const selectedRoleId = projectRoles[projectId]

              return (
                <div key={projectId} className="grid w-full grid-cols-2 items-center gap-4">
                  <span className="text-sm font-light" style={{ color: '#1A1A1A' }}>
                    {project?.name}:
                  </span>
                  <Select
                    value={selectedRoleId?.toString() || ''}
                    onValueChange={(value) => {
                      const roleId = parseInt(value, 10)
                      handleRoleChange(projectId, roleId)
                    }}
                  >
                    <SelectTrigger
                      className="mt-1 w-full border"
                      style={{
                        borderColor: '#F2F3F0',
                        fontSize: '14px',
                        color: '#1A1A1A',
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
          {errors.projectRoles && (
            <p className="text-sm text-red-500">
              {typeof errors.projectRoles.message === 'string'
                ? errors.projectRoles.message
                : 'Please assign a role for each selected project'}
            </p>
          )}
        </div>
      )}

      {/* Form Actions - These will be rendered in ModalFooter */}
      <div className="hidden">
        <button type="submit" id="submit-form" />
      </div>
    </form>
  )
}
