import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LetterTypeConfig, TrainingExample } from '../../../../settings/types'
import {
  createTrainingExampleFromForm,
  removeTrainingExample,
  upsertTrainingExample,
} from '../../../../settings/utils/letterTypeHelpers'
import { getSourcePrefix } from '../../../../settings/utils/settingsI18n'
import {
  EditTrainingExampleModal,
  type TrainingExampleFormValues,
} from './EditTrainingExampleModal'
import { LetterTypeDetailSectionHeader } from './LetterTypeDetailSectionHeader'
import { TrainingExampleRow } from './TrainingExampleRow'

interface LetterTypeTrainingExamplesSectionProps {
  draft: LetterTypeConfig
  onDraftChange: (draft: LetterTypeConfig) => void
  readOnly?: boolean
}

export function LetterTypeTrainingExamplesSection({
  draft,
  onDraftChange,
  readOnly = false,
}: LetterTypeTrainingExamplesSectionProps) {
  const { t } = useTranslation('common')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExample, setEditingExample] = useState<TrainingExample | null>(null)

  const savedExamples = useMemo(
    () => draft.examples.filter((example) => !example.isPlaceholder),
    [draft.examples]
  )

  const openCreateModal = () => {
    if (readOnly) return
    setEditingExample(null)
    setModalOpen(true)
  }

  const openEditModal = (example: TrainingExample) => {
    if (readOnly) return
    setEditingExample(example)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingExample(null)
  }

  const handleSave = (values: TrainingExampleFormValues) => {
    if (readOnly) return
    const example = createTrainingExampleFromForm(editingExample?.id, values, getSourcePrefix(t))
    onDraftChange(upsertTrainingExample(draft, example))
    closeModal()
  }

  return (
    <>
      <section>
        <LetterTypeDetailSectionHeader
          title={t(
            'pages.lawyerWorkplace.settings.letterTypes.trainingExamples',
            'Training examples'
          )}
          hint={t('pages.lawyerWorkplace.settings.letterTypes.examplesMeta', {
            count: savedExamples.length,
            defaultValue: `${savedExamples.length} saved examples for manual reference`,
          })}
        />

        <div className="space-y-2">
          {savedExamples.map((example) => (
            <TrainingExampleRow
              key={example.id}
              example={example}
              onClick={readOnly ? undefined : () => openEditModal(example)}
              onRemove={
                readOnly ? undefined : () => onDraftChange(removeTrainingExample(draft, example.id))
              }
            />
          ))}

          {!readOnly ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="text-light-600 hover:border-secondary-300 hover:text-dark-500 hover:bg-card flex w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-transparent px-4 py-4 text-[13px] transition-colors"
            >
              {t(
                'pages.lawyerWorkplace.settings.letterTypes.addTrainingExample',
                '+ Add training example (paste a real letter)'
              )}
            </button>
          ) : null}
        </div>
      </section>

      {!readOnly ? (
        <EditTrainingExampleModal
          open={modalOpen}
          example={editingExample}
          onClose={closeModal}
          onSave={handleSave}
        />
      ) : null}
    </>
  )
}
