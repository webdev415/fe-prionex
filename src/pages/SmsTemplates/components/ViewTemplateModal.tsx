/**
 * ViewTemplateModal Component
 *
 * Modal for viewing SMS template details.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { ViewTemplateForm } from './ViewTemplateForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { mockSmsTemplates } from '../mockSmsTemplates'

interface ViewTemplateModalProps {
  open: boolean
  templateId: number
  onClose: () => void
}

export function ViewTemplateModal({ open, templateId, onClose }: ViewTemplateModalProps) {
  // TODO: Replace with actual API hook
  const template = mockSmsTemplates.find((t) => t.id === templateId)
  const isLoading = false // TODO: Replace with actual loading state

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.View size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title="View Template"
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : template ? (
          <ViewTemplateForm template={template} />
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
          Close
        </Button>
      </ModalFooter>
    </Modal>
  )
}
