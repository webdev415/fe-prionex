/**
 * LogoutConfirmationModal Component
 *
 * Confirmation modal for logging out.
 * Uses the global Modal component for consistent styling.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface LogoutConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function LogoutConfirmationModal({
  open,
  onConfirm,
  onCancel,
  isLoading = false,
}: LogoutConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onCancel} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.LogoutSquare01 size={20} color="#05040D" strokeWidth={2} />
          </div>
        }
        title="Confirm Logout"
      />
      <ModalContent>
        <p className="text-dark-500 text-base font-light">
          Are you sure you want to logout? You will need to login again to access the system.
        </p>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
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
          variant="danger"
          className="h-[45px] flex-1 rounded-md border-none text-sm font-medium text-white"
        >
          {isLoading ? 'Logging out...' : 'Logout'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
