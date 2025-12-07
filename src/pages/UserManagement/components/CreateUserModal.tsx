/**
 * CreateUserModal Component
 *
 * Modal wrapper for CreateUserForm with project data fetching.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { CreateUserForm } from '@/features/users/components/CreateUserForm'
import { useProjects } from '@/features/projects'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/colors'

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading } = useProjects()

  const projects = projectsData?.projects || []
  const isLoading = projectsLoading

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: '#A0F229' }}
          >
            <Icons.Add size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Create New User"
        onClose={onClose}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">Loading form data...</span>
          </div>
        ) : (
          <CreateUserForm projects={projects} onSuccess={handleSuccess} onCancel={onClose} />
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.gray[500],
            color: '#FFFFFF',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-user-form"
          variant="primary"
          disabled={isLoading}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Save
        </Button>
      </ModalFooter>
    </Modal>
  )
}
