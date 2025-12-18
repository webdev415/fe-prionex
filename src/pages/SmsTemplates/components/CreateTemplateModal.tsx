/**
 * CreateTemplateModal Component
 *
 * Modal for creating a new SMS template.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { CreateTemplateForm } from '@/pages/SmsTemplates/components/CreateTemplateForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface CreateTemplateModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTemplateModal({ open, onClose, onSuccess }: CreateTemplateModalProps) {
  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title="Create SMS Template"
      />
      <ModalContent>
        <CreateTemplateForm onSuccess={handleSuccess} onCancel={onClose} />
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-template-form"
          variant="primary"
          className="text-dark-500 bg-primary-300 h-[45px] flex-1 rounded-md border-none text-sm font-medium"
        >
          Save
        </Button>
      </ModalFooter>
    </Modal>
  )
}
