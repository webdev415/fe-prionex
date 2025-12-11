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
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUpdateRole } from '../hooks/useRoleMutations'
import { usePermissions } from '../hooks/useRoleMutations'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import type { RoleDetailResponse } from '../types'

interface EditRoleFormProps {
  role: RoleDetailResponse
  projectName: string
  onSuccess: () => void
  onCancel?: () => void
}

// Schema for default roles: only permissions
const defaultRoleSchema = z.object({
  permission_ids: z.array(z.number()).min(1, 'Please select at least one permission'),
})

// Schema for custom roles: name, description, and permissions
const customRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
  permission_ids: z.array(z.number()).min(1, 'Please select at least one permission'),
})

type CustomRoleFormData = z.infer<typeof customRoleSchema>

export function EditRoleForm({ role, projectName, onSuccess }: EditRoleFormProps) {
  const updateMutation = useUpdateRole()
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions()
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])

  const isDefaultRole = role.is_default
  const editRoleSchema = useMemo(
    () => (isDefaultRole ? defaultRoleSchema : customRoleSchema),
    [isDefaultRole]
  )

  // Initialize selected permissions from role
  const initialPermissions = useMemo(
    () => role.permissions?.map((p) => p.id) || [],
    [role.permissions]
  )

  // Initialize selected permissions from role
  useEffect(() => {
    setSelectedPermissions(initialPermissions)
  }, [initialPermissions])

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
  } = useForm({
    resolver: zodResolver(editRoleSchema),
    defaultValues: isDefaultRole
      ? {
          permission_ids: role.permissions?.map((p) => p.id) || [],
        }
      : {
          name: role.name,
          description: role.description || '',
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

  const onSubmit = (data: unknown) => {
    const updateData: {
      permission_ids: number[]
      name?: string
      description?: string
    } = {
      permission_ids: selectedPermissions,
    }

    // Only include name/description for custom roles (backend allows this)
    if (!isDefaultRole) {
      const customData = data as CustomRoleFormData
      updateData.name = customData.name
      updateData.description = customData.description || undefined
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
        <Label>Project</Label>
        <div
          className="rounded-lg border bg-white px-4 py-2"
          style={{
            borderColor: '#F2F3F0',
            fontSize: '14px',
            fontWeight: 300,
            color: '#030712',
            height: '45px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {projectName}
        </div>
      </div>

      {/* Role Name */}
      <div>
        <Label required={!isDefaultRole}>Role Name</Label>
        {isDefaultRole ? (
          // Default role: read-only (backend prevents changes)
          <div
            className="rounded-lg border bg-white px-4 py-2"
            style={{
              borderColor: '#F2F3F0',
              fontSize: '14px',
              fontWeight: 300,
              color: '#030712',
              height: '45px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {role.name}
          </div>
        ) : (
          // Custom role: editable
          <>
            <Input
              id="name"
              {...register('name' as const)}
              placeholder="Enter Role Name"
              disabled={updateMutation.isPending}
            />
            {errors.name && (
              <p className="mt-1 text-sm" style={{ color: '#EF4444' }}>
                {(errors.name as { message?: string })?.message}
              </p>
            )}
          </>
        )}
      </div>

      {/* Description */}
      <div>
        <Label>Description</Label>
        {isDefaultRole ? (
          // Default role: read-only
          <div
            className="rounded-lg border bg-white px-4 py-2"
            style={{
              borderColor: '#F2F3F0',
              fontSize: '14px',
              fontWeight: 300,
              color: '#030712',
              minHeight: '80px',
              display: 'flex',
              alignItems: 'flex-start',
              paddingTop: '12px',
            }}
          >
            {role.description || '—'}
          </div>
        ) : (
          // Custom role: editable
          <Textarea
            id="description"
            {...register('description' as const)}
            placeholder="Enter role description"
            disabled={updateMutation.isPending}
          />
        )}
      </div>

      {/* Permissions Section (Always Editable - No Backend Restriction) */}
      <div>
        <Label>
          Permissions
          <span className="ml-2 font-light" style={{ fontSize: '14px', color: '#6B7280' }}>
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
            <div className="py-4 text-sm" style={{ color: '#6B7280' }}>
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
                        style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                      >
                        {category}
                      </span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>
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
                              style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                            >
                              {perm.name}
                            </span>
                            {perm.description && (
                              <span
                                className="ml-2 font-light"
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 300,
                                  color: '#6B7280',
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
