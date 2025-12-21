/**
 * EditTemplateModal Component
 *
 * Modal for editing an existing SMS template.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { EditTemplateForm } from './EditTemplateForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { mockSmsTemplates } from '../mockSmsTemplates'

interface EditTemplateModalProps {
  open: boolean
  templateId: number
  onClose: () => void
  onSuccess: () => void
}

export function EditTemplateModal({
  open,
  templateId,
  onClose,
  onSuccess,
}: EditTemplateModalProps) {
  // TODO: Replace with actual API hook
  const template = mockSmsTemplates.find((t) => t.id === templateId)
  const isLoading = false // TODO: Replace with actual loading state

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title="Edit Template"
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : template ? (
          <EditTemplateForm template={template} onSuccess={handleSuccess} onCancel={onClose} />
        ) : (
          <div className="py-8 text-center text-gray-600">Template not found</div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="h-[45px] flex-1 rounded-lg border-none bg-gray-500 text-sm font-medium text-white"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-template-form"
          variant="primary"
          className="text-dark-500 bg-primary-300 h-[45px] flex-1 rounded-lg border-none text-sm font-medium"
        >
          Save
        </Button>
      </ModalFooter>
    </Modal>
  )
}
