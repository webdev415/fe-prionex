/**
 * DeleteTemplateModal Component
 *
 * Modal for confirming template deletion.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { mockSmsTemplates } from '../mockSmsTemplates'

interface DeleteTemplateModalProps {
  open: boolean
  templateId: number
  onClose: () => void
  onSuccess: () => void
}

export function DeleteTemplateModal({
  open,
  templateId,
  onClose,
  onSuccess,
}: DeleteTemplateModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  // TODO: Replace with actual API hook
  const template = mockSmsTemplates.find((t) => t.id === templateId)

  const handleDelete = async () => {
    if (!template) return

    setIsDeleting(true)
    try {
      // TODO: Replace with actual API call
      console.log('Deleting template:', template.id)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      onSuccess()
    } catch (error) {
      console.error('Failed to delete template:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!template) {
    return null
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-error-500 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-white" strokeWidth={2} />
          </div>
        }
        title="Delete Template"
      />
      <ModalContent>
        <div className="space-y-4">
          <p className="text-dark-500 text-sm">
            Are you sure you want to delete the template <strong>"{template.name}"</strong>?
          </p>
          {template.isSystem && (
            <Alert variant="error">
              <AlertTitle>Cannot Delete System Template</AlertTitle>
              <AlertDescription>
                System templates cannot be deleted. You can only disable them.
              </AlertDescription>
            </Alert>
          )}
          {!template.isSystem && (
            <Alert variant="warning">
              <AlertTitle>This action cannot be undone</AlertTitle>
              <AlertDescription>
                The template will be permanently removed from the system.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isDeleting}
          className="h-[45px] flex-1 rounded-lg border-none bg-gray-500 text-sm font-medium text-white"
        >
          Cancel
        </Button>
        {!template.isSystem && (
          <Button
            type="button"
            variant="primary"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-error-500 hover:bg-error-600 h-[45px] flex-1 rounded-lg border-none text-sm font-medium text-white"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
