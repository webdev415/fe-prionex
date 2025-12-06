/**
 * RoleDetailModal Component
 *
 * Modal for viewing role details.
 */

import { Dialog, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useRole } from '@/features/roles/hooks/useRole'

interface RoleDetailModalProps {
  open: boolean
  roleId: number
  onClose: () => void
}

export function RoleDetailModal({ open, roleId, onClose }: RoleDetailModalProps) {
  const { data: role, isLoading } = useRole(roleId)

  if (isLoading || !role) {
    return (
      <Dialog open={open} onClose={onClose}>
        <div className="w-full max-w-2xl rounded-lg bg-white px-6 py-6 shadow-xl">
          <div className="text-center text-gray-400">Loading role details...</div>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white px-6 py-6 shadow-xl">
        <DialogTitle className="mb-4 text-xl font-semibold text-gray-900">Role Details</DialogTitle>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Role Name</label>
            <p className="mt-1 text-base text-gray-900">{role.name}</p>
          </div>

          {role.description && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Description</label>
              <p className="mt-1 text-base text-gray-700">{role.description}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500">Type</label>
            <span
              className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                role.is_default ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {role.is_default ? 'Default Role' : 'Custom Role'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Status</label>
            <span
              className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                role.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {role.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Permissions</label>
            <p className="mt-1 text-base text-gray-700">
              {role.permission_count} permissions assigned
            </p>
            {role.permissions && role.permissions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {role.permissions.map((permission) => (
                  <span
                    key={permission.id}
                    className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                  >
                    {permission.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Users</label>
            <p className="mt-1 text-base text-gray-700">
              {role.user_count} users assigned to this role
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
