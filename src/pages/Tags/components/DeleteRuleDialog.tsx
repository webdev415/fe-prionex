/**
 * Delete Rule Dialog
 *
 * Confirmation dialog for deleting automation rules.
 */

import { useTranslation } from 'react-i18next'
import { useDeleteRule } from '@/features/tags'
import type { TagRule } from '@/features/tags'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'

interface DeleteRuleDialogProps {
  open: boolean
  rule: TagRule
  onClose: () => void
  onSuccess: () => void
}

export function DeleteRuleDialog({ open, rule, onClose, onSuccess }: DeleteRuleDialogProps) {
  const { t } = useTranslation('common')
  const deleteMutation = useDeleteRule()

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(rule.id)
      onSuccess()
    } catch (error) {
      console.error('Failed to delete rule:', error)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-error-100 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Cancel01 size={20} className="text-error-600" strokeWidth={2} />
          </div>
        }
        title={t('pages.tags.deleteRule', 'Delete Rule')}
      />

      <ModalContent>
        <div className="space-y-4">
          <p className="text-foreground text-base font-light">
            {t(
              'pages.tags.deleteRuleConfirmation',
              'Are you sure you want to delete the rule "{{name}}"?',
              { name: rule.name }
            )}
          </p>

          {rule.is_active && (
            <Alert variant="warning">
              <div className="space-y-2">
                <p className="font-medium">
                  {t('pages.tags.ruleActiveWarning', 'This rule is currently active')}
                </p>
                <p className="text-sm">
                  {t(
                    'pages.tags.deleteRuleWarningMessage',
                    'Deleting an active rule will stop all automatic tag operations it performs. This action cannot be undone.'
                  )}
                </p>
              </div>
            </Alert>
          )}

          {!rule.is_active && (
            <Alert variant="info">
              <p className="text-sm">
                {t(
                  'pages.tags.deleteRuleNotice',
                  'This action cannot be undone. The rule will be permanently removed.'
                )}
              </p>
            </Alert>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={deleteMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {deleteMutation.isPending
            ? t('pages.tags.deleting', 'Deleting...')
            : t('actions.delete', 'Delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
