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

      {!readOnly && (
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
