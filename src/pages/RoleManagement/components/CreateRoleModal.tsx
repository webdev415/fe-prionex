/**
 * CreateRoleModal Component
 *
 * Modal for creating a new role with permission selection.
 */

import { useState } from 'react'
import { Dialog, DialogTitle } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateRole } from '@/features/roles/hooks/useRoleMutations'
import { usePermissions } from '@/features/roles/hooks/usePermissions'

interface CreateRoleModalProps {
  open: boolean
  projectId: number
  onClose: () => void
  onSuccess: () => void
}

export function CreateRoleModal({ open, projectId, onClose, onSuccess }: CreateRoleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreateRole()
  const { data: permissionsData, isLoading: loadingPermissions } = usePermissions()

  const permissions = permissionsData?.permissions || []

  // Group permissions by category
  const permissionsByCategory = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = []
      }
      acc[perm.category].push(perm)
      return acc
    },
    {} as Record<string, typeof permissions>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      await createMutation.mutateAsync({
        project_id: projectId,
        name: formData.name,
        description: formData.description || undefined,
        permission_ids: selectedPermissions,
      })
      onSuccess()
      onClose()
      // Reset form
      setFormData({ name: '', description: '' })
      setSelectedPermissions([])
    } catch (error) {
      console.error('Failed to create role:', error)
      setError('Failed to create role. Please try again.')
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePermissionToggle = (permissionId: number) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    )
  }

  const handleSelectAllInCategory = (category: string) => {
    const categoryPermissions = permissionsByCategory[category] || []
    const categoryIds = categoryPermissions.map((p) => p.id)
    const allSelected = categoryIds.every((id) => selectedPermissions.includes(id))

    if (allSelected) {
      // Deselect all in category
      setSelectedPermissions((prev) => prev.filter((id) => !categoryIds.includes(id)))
    } else {
      // Select all in category
      setSelectedPermissions((prev) => [...new Set([...prev, ...categoryIds])])
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white px-6 py-6 shadow-xl">
        <DialogTitle className="mb-4 text-xl font-semibold text-gray-900">
          Create New Role
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Role Name *
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter role name"
              required
              disabled={createMutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter role description"
              rows={3}
              disabled={createMutation.isPending}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Permissions Section */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Permissions ({selectedPermissions.length} selected)
            </label>
            {loadingPermissions ? (
              <div className="py-4 text-sm text-gray-500">Loading permissions...</div>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border border-gray-300">
                {Object.entries(permissionsByCategory).map(([category, categoryPerms]) => {
                  const categoryIds = categoryPerms.map((p) => p.id)
                  const allSelected = categoryIds.every((id) => selectedPermissions.includes(id))
                  const someSelected = categoryIds.some((id) => selectedPermissions.includes(id))

                  return (
                    <div key={category} className="border-b border-gray-200 last:border-b-0">
                      <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                        <label className="flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected
                            }}
                            onChange={() => handleSelectAllInCategory(category)}
                            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-900">{category}</span>
                        </label>
                        <span className="text-xs text-gray-500">
                          {categoryPerms.filter((p) => selectedPermissions.includes(p.id)).length}/
                          {categoryPerms.length}
                        </span>
                      </div>
                      <div className="space-y-2 px-4 py-2">
                        {categoryPerms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex cursor-pointer items-start rounded p-2 hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(perm.id)}
                              onChange={() => handlePermissionToggle(perm.id)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            <div className="ml-3 flex-1">
                              <div className="text-sm font-medium text-gray-900">{perm.name}</div>
                              {perm.description && (
                                <div className="text-xs text-gray-500">{perm.description}</div>
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

          {(error || createMutation.isError) && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {error || 'Failed to create role. Please try again.'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Role'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
