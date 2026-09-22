import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'

export interface SectionDialogProps {
  open: boolean
  title: string
  formId: string
  saving: boolean
  error?: string | null
  onClose: () => void
  children: ReactNode
}

/**
 * The frame every section dialog shares.
 *
 * A save the server refuses has to say so inside the dialog. Closing on a
 * refusal is how somebody loses what they typed and never learns why.
 */
export function SectionDialog({
  open,
  title,
  formId,
  saving,
  error,
  onClose,
  children,
}: SectionDialogProps) {
  const { t } = useTranslation()

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={title} />
      <ModalContent>
        {error && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {error}
          </p>
        )}
        {children}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={saving}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form={formId}
          variant="primary"
          disabled={saving}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
