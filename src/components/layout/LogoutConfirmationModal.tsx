/**
 * LogoutConfirmationModal Component
 *
 * Confirmation modal for logging out.
 * Uses the global Modal component for consistent styling.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[400] }}
          >
            <Icons.LogoutSquare01 size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Confirm Logout"
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
          Are you sure you want to logout? You will need to login again to access the system.
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
          {isLoading ? 'Logging out...' : 'Logout'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
