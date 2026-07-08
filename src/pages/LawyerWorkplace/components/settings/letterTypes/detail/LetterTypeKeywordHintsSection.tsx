import { useTranslation } from 'react-i18next'
import type { LetterTypeConfig } from '../../../../settings/types'
import { KeywordHintsField } from './KeywordHintsField'
import { LetterTypeDetailSectionHeader } from './LetterTypeDetailSectionHeader'

interface LetterTypeKeywordHintsSectionProps {
  draft: LetterTypeConfig
  onDraftChange: (draft: LetterTypeConfig) => void
}

export function LetterTypeKeywordHintsSection({
  draft,
  onDraftChange,
}: LetterTypeKeywordHintsSectionProps) {
  const { t } = useTranslation('common')

  return (
    <section>
      <LetterTypeDetailSectionHeader
        title={t('pages.lawyerWorkplace.settings.letterTypes.keywordHints', 'Keyword hints')}
        hint={t(
          'pages.lawyerWorkplace.settings.letterTypes.keywordHintsHint',
          'used to auto-suggest letter type when the sender email matches a CRM client'
        )}
      />

      <KeywordHintsField
        keywords={draft.keywordHints}
        onChange={(keywordHints) => onDraftChange({ ...draft, keywordHints })}
      />
    </section>
  )
}
