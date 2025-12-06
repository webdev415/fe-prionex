/**
 * CreateUserModal Component
 *
 * Modal wrapper for CreateUserForm with project and role data fetching.
 */

import { Dialog, DialogTitle } from '@/components/ui/Dialog'
import { CreateUserForm } from '@/features/users/components/CreateUserForm'
import { useProjects } from '@/features/projects'
import { useRoles } from '@/features/roles'

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  // Fetch projects and roles
  const { data: projectsData, isLoading: projectsLoading } = useProjects()
  const { data: rolesData, isLoading: rolesLoading } = useRoles()

  const projects = projectsData?.results || []
  const roles = rolesData?.results || []
  const isLoading = projectsLoading || rolesLoading

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogTitle>Create New User</DialogTitle>
      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">Loading form data...</span>
          </div>
        ) : (
          <CreateUserForm
            projects={projects}
            roles={roles}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        )}
      </div>
    </Dialog>
  )
}
