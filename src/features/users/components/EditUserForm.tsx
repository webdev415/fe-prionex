/**
 * EditUserForm Component
 *
 * Form for updating existing user information.
 * Cannot update username, password, or project/role assignments (separate endpoints).
 */

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useUpdateUser } from '../hooks/useUpdateUser'
import {
  updateUserSchema,
  type UpdateUserFormData,
  languageOptions,
  timezoneOptions,
} from '../schemas/userSchemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import type { UserDetailResponse } from '../types'

interface EditUserFormProps {
  user: UserDetailResponse
  onSuccess: () => void
  onCancel: () => void
}

export function EditUserForm({ user, onSuccess, onCancel }: EditUserFormProps) {
  const { mutate, isPending, isError, error } = useUpdateUser()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name || '',
      phone: user.phone || '',
      language: user.language,
      timezone: user.timezone,
    },
  })

  const onSubmit = (data: UpdateUserFormData) => {
    mutate(
      { userId: user.id, data },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {isError && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold">Error updating user</h3>
            <p className="mt-1 text-sm">{error?.message || 'Failed to update user'}</p>
          </div>
        </Alert>
      )}

      {/* Username (read-only) */}
      <div>
        <Label>Username</Label>
        <Input value={user.username} disabled />
        <p className="mt-1 text-xs text-gray-400">Username cannot be changed</p>
      </div>

      {/* Email */}
      <div>
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
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
      </div>

      {/* Language */}
      <div>
        <Label htmlFor="language">Language *</Label>
        <select
          id="language"
          {...register('language')}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timezone */}
      <div>
        <Label htmlFor="timezone">Timezone *</Label>
        <select
          id="timezone"
          {...register('timezone')}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900"
        >
          {timezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
