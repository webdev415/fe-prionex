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
import { TrainingExampleEmptySlot } from './TrainingExampleEmptySlot'
import { TrainingExampleRow } from './TrainingExampleRow'

const EMPTY_TRAINING_SLOT_COUNT = 3

function getFirstVisibleEmptySlotIndex(hiddenSlots: Set<number>): number | null {
  for (let index = 0; index < EMPTY_TRAINING_SLOT_COUNT; index += 1) {
    if (!hiddenSlots.has(index)) return index
  }
  return null
}

interface LetterTypeTrainingExamplesSectionProps {
  draft: LetterTypeConfig
  onDraftChange: (draft: LetterTypeConfig) => void
}

export function LetterTypeTrainingExamplesSection({
  draft,
  onDraftChange,
}: LetterTypeTrainingExamplesSectionProps) {
  const { t } = useTranslation('common')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExample, setEditingExample] = useState<TrainingExample | null>(null)
  const [hiddenEmptySlots, setHiddenEmptySlots] = useState<Set<number>>(() => new Set())
  const [creatingFromSlotIndex, setCreatingFromSlotIndex] = useState<number | null>(null)

  const savedExamples = useMemo(
    () => draft.examples.filter((example) => !example.isPlaceholder),
    [draft.examples]
  )

  const openCreateModal = (slotIndex?: number) => {
    setEditingExample(null)
    setCreatingFromSlotIndex(slotIndex ?? null)
    setModalOpen(true)
  }

  const openEditModal = (example: TrainingExample) => {
    setEditingExample(example)
    setCreatingFromSlotIndex(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingExample(null)
    setCreatingFromSlotIndex(null)
  }

  const handleSave = (values: TrainingExampleFormValues) => {
    const isCreate = editingExample === null
    const example = createTrainingExampleFromForm(editingExample?.id, values, getSourcePrefix(t))
    onDraftChange(upsertTrainingExample(draft, example))

    if (isCreate) {
      setHiddenEmptySlots((previous) => {
        const slotToConsume = creatingFromSlotIndex ?? getFirstVisibleEmptySlotIndex(previous)
        if (slotToConsume === null) return previous

        const next = new Set(previous)
        next.add(slotToConsume)
        return next
      })
    }

    closeModal()
  }

  const dismissEmptySlot = (index: number) => {
    setHiddenEmptySlots((previous) => new Set(previous).add(index))
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
            defaultValue: `${savedExamples.length} examples - feeds the vector database`,
          })}
        />

        <div className="space-y-2">
          {savedExamples.map((example) => (
            <TrainingExampleRow
              key={example.id}
              example={example}
              onClick={() => openEditModal(example)}
              onRemove={() => onDraftChange(removeTrainingExample(draft, example.id))}
            />
          ))}

          {Array.from({ length: EMPTY_TRAINING_SLOT_COUNT }, (_, index) =>
            hiddenEmptySlots.has(index) ? null : (
              <TrainingExampleEmptySlot
                key={`empty-slot-${index}`}
                onClick={() => openCreateModal(index)}
                onRemove={() => dismissEmptySlot(index)}
              />
            )
          )}

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="text-light-600 hover:border-secondary-300 hover:text-dark-500 flex w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-transparent px-4 py-4 text-[13px] transition-colors hover:bg-white"
          >
            {t(
              'pages.lawyerWorkplace.settings.letterTypes.addTrainingExample',
              '+ Add training example (paste a real letter)'
            )}
          </button>
        </div>
      </section>

      <EditTrainingExampleModal
        open={modalOpen}
        example={editingExample}
        onClose={closeModal}
        onSave={handleSave}
      />
    </>
  )
}
