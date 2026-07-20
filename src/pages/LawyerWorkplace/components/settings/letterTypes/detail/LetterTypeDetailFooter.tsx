import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../../context/lawyerWorkplaceLayout'
import { DoubleButton } from '@/components/ui/DoubleButton'

interface LetterTypeDetailFooterProps {
  isDirty: boolean
  isSaving?: boolean
  onDiscard: () => void
  onSave: () => void
}

export function LetterTypeDetailFooter({
  isDirty,
  isSaving = false,
  onDiscard,
  onSave,
}: LetterTypeDetailFooterProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()

  return (
    <div
      className={cn(
        'border-border flex shrink-0 flex-col gap-3 border-t px-4 py-4 sm:px-5 sm:py-5 lg:px-6',
        isCompact ? 'items-stretch' : 'sm:flex-row sm:justify-center'
      )}
    >
      <Button
        variant="cancel"
        size="md"
        onClick={onDiscard}
        disabled={!isDirty || isSaving}
        className={cn('h-11 rounded-full', isCompact ? 'w-full' : 'min-w-[170px]')}
      >
        {t('pages.lawyerWorkplace.settings.discardChanges', 'Discard changes')}
      </Button>
      <DoubleButton
        size="md"
        onClick={onSave}
        disabled={!isDirty || isSaving}
        icon={<Icons.Tick02 size={20} strokeWidth={2} />}
        iconPosition="left"
        className={cn('h-11 rounded-full text-white', isCompact ? 'w-full' : 'min-w-[170px]')}
      >
        {isSaving
          ? t('pages.lawyerWorkplace.settings.saving', 'Saving…')
          : t('pages.lawyerWorkplace.settings.saveChanges', 'Save Changes')}
      </DoubleButton>
    </div>
  )
}
