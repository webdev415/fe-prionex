/**
 * CreateUserModal Component
 *
 * Modal wrapper for CreateUserForm with project data fetching.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { CreateUserForm } from '@/features/users/components/CreateUserForm'
import { useProjects } from '@/features/projects'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateUserModal({ open, onClose, onSuccess }: CreateUserModalProps) {
  const { t } = useTranslation('common')
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
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} color="#05040D" strokeWidth={2} />
          </div>
        }
        title={t('pages.users.modals.create.title')}
        onClose={onClose}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">
              {t('pages.users.modals.create.loadingFormData')}
            </span>
          </div>
        ) : (
          <CreateUserForm projects={projects} onSuccess={handleSuccess} onCancel={onClose} />
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="create-user-form"
          variant="primary"
          disabled={isLoading}
          className="text-dark-500 h-[45px] flex-1 rounded-md border-none text-sm font-medium"
        >
          {t('pages.users.modals.create.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
