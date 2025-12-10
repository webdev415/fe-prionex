/**
 * DeleteProjectConfirmationModal Component
 *
 * Confirmation modal for deleting a project.
 * Uses the global Modal component for consistent styling.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[400] }}
          >
            <Icons.Delete size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title={`Delete Project: ${projectName}`}
      />
      <ModalContent>
        <p
          className="font-light"
          style={{
            fontSize: '16px',
            fontWeight: 300,
            color: colors.neutral.dark[500],
          }}
        >
          Are you sure you want to delete this project? This action cannot be undone.
        </p>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
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
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {isLoading ? 'Deleting...' : 'Delete Project'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

