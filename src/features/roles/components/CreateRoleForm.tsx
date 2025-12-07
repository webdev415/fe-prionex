/**
 * CreateRoleForm Component
 *
 * Form for creating a new role with permission selection.
 * Matches the design pattern from CreateUserForm.
 */

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateRole } from '../hooks/useRoleMutations'
import { usePermissions } from '../hooks/useRoleMutations'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import { colors } from '@/lib/colors'

interface CreateRoleFormProps {
  projectId: number
  onSuccess: () => void
  onCancel?: () => void
}

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
  permission_ids: z.array(z.number()).min(1, 'Please select at least one permission'),
})

type CreateRoleFormData = z.infer<typeof createRoleSchema>

export function CreateRoleForm({ projectId, onSuccess }: CreateRoleFormProps) {
  const createMutation = useCreateRole()
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions()
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])

  const permissions = permissionsData?.permissions || []

  // Group permissions by category
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

  const onSubmit = (data: CreateRoleFormData) => {
    createMutation.mutate(
      {
        project_id: projectId,
        name: data.name,
        description: data.description || undefined,
        permission_ids: selectedPermissions,
      },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  return (
    <form id="create-role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Role Name */}
      <div>
        <Label htmlFor="name" required>
          Role Name:
        </Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Enter Role Name"
          disabled={createMutation.isPending}
        />
        {errors.name && (
          <p className="mt-1 text-sm" style={{ color: '#EF4444' }}>
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description" required>
          Description
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Describe this role"
          rows={3}
          disabled={createMutation.isPending}
        />
        {errors.description && (
          <p className="mt-1 text-sm" style={{ color: '#EF4444' }}>
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Permissions Section */}
      <div>
        <Label>
          Permissions
          <span className="ml-2 font-light" style={{ fontSize: '14px', color: colors.gray[500] }}>
            (Selected: {selectedPermissions.length} of {permissions.length} permissions)
          </span>
        </Label>

        <div
          className="max-h-96 overflow-y-auto rounded-xl"
          style={{
            backgroundColor: '#FFFFFF',
            padding: '24px',
          }}
        >
          {loadingPermissions ? (
            <div className="py-4 text-sm" style={{ color: colors.gray[500] }}>
              Loading permissions...
            </div>
          ) : (
            <div>
              {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => {
                return (
                  <div key={category} className="mb-6 last:mb-0">
                    <div
                      className="mb-3 flex items-center justify-between"
                      style={{ backgroundColor: 'transparent' }}
                    >
                      <span
                        className="font-light"
                        style={{ fontSize: '14px', fontWeight: 300, color: colors.gray[950] }}
                      >
                        {category}
                      </span>
                      <span className="text-xs" style={{ color: colors.gray[500] }}>
                        {categoryPerms.filter((p) => selectedPermissions.includes(p.id)).length}/
                        {categoryPerms.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {categoryPerms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex cursor-pointer items-center gap-3 rounded p-2 transition-colors hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={selectedPermissions.includes(perm.id)}
                            onCheckedChange={() => handlePermissionToggle(perm.id)}
                            aria-label={perm.name}
                          />
                          <div className="flex-1">
                            <span
                              className="font-light"
                              style={{ fontSize: '14px', fontWeight: 300, color: colors.gray[950] }}
                            >
                              {perm.name}
                            </span>
                            {perm.description && (
                              <span
                                className="ml-2 font-light"
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 300,
                                  color: colors.gray[500],
                                }}
                              >
                                {perm.description}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {errors.permission_ids && (
          <p className="mt-1 text-sm" style={{ color: '#EF4444' }}>
            {errors.permission_ids.message}
          </p>
        )}
      </div>

      {/* Error Alert */}
      {createMutation.isError && (
        <Alert variant="error">
          <p className="text-sm">
            {createMutation.error?.message || 'Failed to create role. Please try again.'}
          </p>
        </Alert>
      )}
    </form>
  )
}
