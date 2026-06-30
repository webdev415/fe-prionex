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
  readOnly = false,
}: LetterTypeDetailPanelProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[12px] bg-white/50">
      <LetterTypeDetailHeader draft={draft} onBack={onBack} />

      <fieldset disabled={readOnly} className="min-h-0 flex-1 border-0 p-0 disabled:opacity-90">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:space-y-8 sm:px-5 sm:py-6 lg:px-6">
          <LetterTypeBasicInfoSection draft={draft} onDraftChange={onDraftChange} />
          <LetterTypePrioritySection draft={draft} onDraftChange={onDraftChange} />
          <LetterTypeTrainingExamplesSection
            key={draft.id}
            draft={draft}
            onDraftChange={onDraftChange}
          />
          <LetterTypeKeywordHintsSection draft={draft} onDraftChange={onDraftChange} />
        </div>
      </fieldset>

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
