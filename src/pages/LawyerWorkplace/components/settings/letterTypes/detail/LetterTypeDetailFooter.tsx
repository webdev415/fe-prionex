import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { DoubleButton } from '@/components/ui/DoubleButton'

interface LetterTypeDetailFooterProps {
  isDirty: boolean
  onDiscard: () => void
  onSave: () => void
}

export function LetterTypeDetailFooter({
  isDirty,
  onDiscard,
  onSave,
}: LetterTypeDetailFooterProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-gray-100 px-5 py-5 sm:flex-row sm:justify-center sm:px-6">
      <Button
        variant="cancel"
        size="md"
        onClick={onDiscard}
        disabled={!isDirty}
        className="h-11 min-w-[170px] rounded-full"
      >
        {t('pages.lawyerWorkplace.settings.discardChanges', 'Discard changes')}
      </Button>
      <DoubleButton
        size="md"
        onClick={onSave}
        disabled={!isDirty}
        icon={<Icons.Tick02 size={20} strokeWidth={2} />}
        iconPosition="left"
        className="h-11 min-w-[170px] rounded-full text-white"
      >
        {t('pages.lawyerWorkplace.settings.saveChanges', 'Save Changes')}
      </DoubleButton>
    </div>
  )
}
