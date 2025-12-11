/**
 * DeleteProjectConfirmationModal Component
 *
 * Confirmation modal for deleting a project.
 * Uses the global Modal component for consistent styling.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface DeleteProjectConfirmationModalProps {
  open: boolean
  projectName: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function DeleteProjectConfirmationModal({
  open,
  projectName,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteProjectConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onCancel} maxWidth="md">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B0EDC7]">
            <Icons.Delete size={20} color="#05040D" strokeWidth={2} />
          </div>
        }
        title={`Delete Project: ${projectName}`}
      />
      <ModalContent>
        <p className="text-dark-500 text-base font-light">
          Are you sure you want to delete this project? This action cannot be undone.
        </p>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="bg-error-500 h-[45px] flex-1 rounded-md border-none text-sm font-medium text-white"
        >
          {isLoading ? 'Deleting...' : 'Delete Project'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
