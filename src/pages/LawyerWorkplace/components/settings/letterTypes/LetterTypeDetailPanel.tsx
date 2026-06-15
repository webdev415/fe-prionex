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
}

export function LetterTypeDetailPanel({
  draft,
  isDirty,
  onDraftChange,
  onDiscard,
  onSave,
}: LetterTypeDetailPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[12px] bg-white/50">
      <LetterTypeDetailHeader draft={draft} />

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-6">
        <LetterTypeBasicInfoSection draft={draft} onDraftChange={onDraftChange} />
        <LetterTypePrioritySection draft={draft} onDraftChange={onDraftChange} />
        <LetterTypeTrainingExamplesSection
          key={draft.id}
          draft={draft}
          onDraftChange={onDraftChange}
        />
        <LetterTypeKeywordHintsSection draft={draft} onDraftChange={onDraftChange} />
      </div>

      <LetterTypeDetailFooter isDirty={isDirty} onDiscard={onDiscard} onSave={onSave} />
    </div>
  )
}
