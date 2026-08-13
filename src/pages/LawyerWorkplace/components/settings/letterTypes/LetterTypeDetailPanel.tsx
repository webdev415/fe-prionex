import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { LetterTypeConfig } from '../../../settings/types'
import { LetterTypeBasicInfoSection } from './detail/LetterTypeBasicInfoSection'
import { LetterTypeDetailFooter } from './detail/LetterTypeDetailFooter'
import { LetterTypeDetailHeader } from './detail/LetterTypeDetailHeader'
import { LetterTypeKeywordHintsSection } from './detail/LetterTypeKeywordHintsSection'
import { LetterTypePrioritySection } from './detail/LetterTypePrioritySection'
import { LetterTypeTrainingExamplesSection } from './detail/LetterTypeTrainingExamplesSection'

interface LetterTypeDetailPanelProps {
  draft: LetterTypeConfig
  isDirty: boolean
  onDraftChange: (draft: LetterTypeConfig) => void
  onDiscard: () => void
  onSave: () => void
  isSaving?: boolean
  onBack?: () => void
  onDelete?: () => void
  canDelete?: boolean
  isDeleting?: boolean
  readOnly?: boolean
}

export function LetterTypeDetailPanel({
  draft,
  isDirty,
  onDraftChange,
  onDiscard,
  onSave,
  isSaving = false,
  onBack,
  onDelete,
  canDelete = true,
  isDeleting = false,
  readOnly = false,
}: LetterTypeDetailPanelProps) {
  const { t } = useTranslation('common')
  const handleDraftChange = (next: LetterTypeConfig) => {
    if (readOnly) return
    onDraftChange(next)
  }

  return (
    <div className="bg-card/50 flex min-h-0 min-w-0 flex-1 flex-col rounded-[12px]">
      <LetterTypeDetailHeader
        draft={draft}
        onBack={onBack}
        onDelete={readOnly ? undefined : onDelete}
        canDelete={canDelete}
        isDeleting={isDeleting}
      />

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:space-y-8 sm:px-5 sm:py-6 lg:px-6">
        <LetterTypeBasicInfoSection
          draft={draft}
          readOnly={readOnly}
          onDraftChange={handleDraftChange}
        />
        <LetterTypePrioritySection
          draft={draft}
          readOnly={readOnly}
          onDraftChange={handleDraftChange}
        />
        <LetterTypeTrainingExamplesSection
          key={draft.id}
          draft={draft}
          readOnly={readOnly}
          onDraftChange={handleDraftChange}
        />
        <LetterTypeKeywordHintsSection
          draft={draft}
          readOnly={readOnly}
          onDraftChange={handleDraftChange}
        />
      </div>

      {readOnly ? (
        // Don't silently drop the Save/Discard footer — a hidden save button reads
        // as "the button disappeared". Show why it's unavailable instead.
        <div className="border-border flex shrink-0 items-start gap-2 border-t px-4 py-4 sm:px-5 lg:px-6">
          <Icons.Warning size={16} strokeWidth={1.5} className="text-warning-500 mt-0.5 shrink-0" />
          <p className="text-muted-foreground text-[12px] leading-snug">
            {t(
              'pages.lawyerWorkplace.settings.readOnlyFooterNotice',
              'Saving is unavailable — you do not have permission to change department settings. If you should have access, sign out and sign in again to refresh your permissions.'
            )}
          </p>
        </div>
      ) : (
        <LetterTypeDetailFooter
          isDirty={isDirty}
          isSaving={isSaving}
          onDiscard={onDiscard}
          onSave={onSave}
        />
      )}
    </div>
  )
}
