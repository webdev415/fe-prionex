import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { LetterTypeConfig } from '../../../settings/types'
import { getLetterTypeName } from '../letterTypeDisplay'

interface DeleteLetterTypeModalProps {
  open: boolean
  letterType: LetterTypeConfig | null
  onClose: () => void
  onConfirm: () => void | Promise<void>
  isDeleting?: boolean
}

export function DeleteLetterTypeModal({
  open,
  letterType,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteLetterTypeModalProps) {
  const { t } = useTranslation('common')

  const typeName = letterType ? getLetterTypeName(letterType, t) : ''

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <div className="flex flex-col gap-4">
        <DialogPrimitive.Title className="text-dark-500 text-lg font-semibold">
          {t('pages.lawyerWorkplace.settings.letterTypes.deleteTypeTitle', 'Delete letter type')}
        </DialogPrimitive.Title>
        <p className="text-sm text-gray-700">
          {t(
            'pages.lawyerWorkplace.settings.letterTypes.deleteTypeConfirm',
            'Are you sure you want to delete this letter type?'
          )}{' '}
          <span className="text-dark-500 font-medium">{typeName}</span>
        </p>
        {letterType && letterType.letterCount > 0 ? (
          <p className="text-warning-700 text-xs">
            {t('pages.lawyerWorkplace.settings.letterTypes.deleteTypeLetterCountWarning', {
              count: letterType.letterCount,
              defaultValue: `This type is linked to ${letterType.letterCount} letters.`,
            })}
          </p>
        ) : null}
        <p className="text-xs text-gray-500">
          {t(
            'pages.lawyerWorkplace.settings.letterTypes.deleteTypeWarning',
            'It will be removed from active lists. Historical letters keep their classification.'
          )}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={isDeleting}>
            {isDeleting ? t('actions.deleting', 'Deleting…') : t('actions.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
