/**
 * CreateUserForm Component
 *
 * Form for creating a new user with validation.
 * Uses React Hook Form + Zod for type-safe validation.
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateUser } from '../hooks/useCreateUser'
import {
  createUserSchema,
  type CreateUserFormData,
  languageOptions,
  timezoneOptions,
} from '../schemas/userSchemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'

interface Project {
  id: number
  name: string
  code: string
}

interface Role {
  id: number
  name: string
}

interface CreateUserFormProps {
  projects: Project[]
  roles: Role[]
  onSuccess: () => void
  onCancel: () => void
}

export function CreateUserForm({ projects, roles, onSuccess, onCancel }: CreateUserFormProps) {
  const { mutate, isPending, isError, error } = useCreateUser()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      must_change_password: true,
      language: 'en',
      timezone: 'UTC',
    },
  })

  const onSubmit = (data: CreateUserFormData) => {
    mutate(data, {
      onSuccess: () => {
        onSuccess()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* API Error Alert */}
      {isError && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold">Error creating user</h3>
            <p className="mt-1 text-sm">{error?.message || 'Failed to create user'}</p>
          </div>
        </Alert>
      )}

      {/* Username */}
      <div>
        <Label htmlFor="username">Username *</Label>
        <Input id="username" {...register('username')} aria-invalid={!!errors.username} />
        {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>}
      </div>

      {/* Email */}
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div>
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          aria-invalid={!!errors.password}
        />
        {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>}
        <p className="mt-1 text-xs text-gray-400">
          Must be at least 8 characters with uppercase, lowercase, number, and special character
        </p>
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="first_name">First Name *</Label>
          <Input id="first_name" {...register('first_name')} aria-invalid={!!errors.first_name} />
          {errors.first_name && (
            <p className="mt-1 text-sm text-red-500">{errors.first_name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="middle_name">Middle Name</Label>
          <Input id="middle_name" {...register('middle_name')} />
          {errors.middle_name && (
            <p className="mt-1 text-sm text-red-500">{errors.middle_name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="last_name">Last Name *</Label>
          <Input id="last_name" {...register('last_name')} aria-invalid={!!errors.last_name} />
          {errors.last_name && (
            <p className="mt-1 text-sm text-red-500">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          placeholder="+1-555-0101"
          {...register('phone')}
          aria-invalid={!!errors.phone}
        />
        {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
        <p className="mt-1 text-xs text-gray-400">Format: +1-555-0101</p>
      </div>

      {/* Language */}
      <div>
        <Label htmlFor="language">Language *</Label>
        <select
          id="language"
          {...register('language')}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          aria-invalid={!!errors.language}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.language && <p className="mt-1 text-sm text-red-500">{errors.language.message}</p>}
      </div>

      {/* Timezone */}
      <div>
        <Label htmlFor="timezone">Timezone *</Label>
        <select
          id="timezone"
          {...register('timezone')}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          aria-invalid={!!errors.timezone}
        >
          {timezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.timezone && <p className="mt-1 text-sm text-red-500">{errors.timezone.message}</p>}
      </div>

      {/* Project Selection */}
      <div>
        <Label htmlFor="project_id">Project *</Label>
        <select
          id="project_id"
          {...register('project_id', { valueAsNumber: true })}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          aria-invalid={!!errors.project_id}
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.code})
            </option>
          ))}
        </select>
        {errors.project_id && (
          <p className="mt-1 text-sm text-red-500">{errors.project_id.message}</p>
        )}
      </div>

      {/* Role Selection */}
      <div>
        <Label htmlFor="role_id">Role *</Label>
        <select
          id="role_id"
          {...register('role_id', { valueAsNumber: true })}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
          aria-invalid={!!errors.role_id}
        >
          <option value="">Select a role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        {errors.role_id && <p className="mt-1 text-sm text-red-500">{errors.role_id.message}</p>}
      </div>

      {/* Must Change Password */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="must_change_password"
          {...register('must_change_password')}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="must_change_password" className="mb-0">
          Must change password on first login
        </Label>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create User'}
        </Button>
      </div>
    </form>
  )
}
