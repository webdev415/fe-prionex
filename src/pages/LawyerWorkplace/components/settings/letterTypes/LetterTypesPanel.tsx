import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig } from '../../../settings/types'
import { cloneLetterType } from '../../../settings/utils/letterTypeHelpers'
import { LetterTypeDetailPanel } from './LetterTypeDetailPanel'
import { LetterTypeList } from './LetterTypeList'

interface LetterTypesPanelProps {
  letterTypes: LetterTypeConfig[]
  onLetterTypesChange: (letterTypes: LetterTypeConfig[]) => void
  selectedId: string
  onSelectedIdChange: (id: string) => void
  onAddType: () => void
}

interface LetterTypeDetailEditorProps {
  selectedType: LetterTypeConfig
  letterTypes: LetterTypeConfig[]
  onLetterTypesChange: (letterTypes: LetterTypeConfig[]) => void
}

function LetterTypeDetailEditor({
  selectedType,
  letterTypes,
  onLetterTypesChange,
}: LetterTypeDetailEditorProps) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState(() => cloneLetterType(selectedType))

  const isDirty = useMemo(
    () => JSON.stringify(selectedType) !== JSON.stringify(draft),
    [draft, selectedType]
  )

  const handleSave = () => {
    if (!isDirty) return
    onLetterTypesChange(letterTypes.map((type) => (type.id === draft.id ? draft : type)))
    toast.success(t('pages.lawyerWorkplace.settings.saveSuccess', 'Changes saved'))
  }

  const handleDiscard = () => {
    setDraft(cloneLetterType(selectedType))
  }

  return (
    <LetterTypeDetailPanel
      draft={draft}
      isDirty={isDirty}
      onDraftChange={setDraft}
      onDiscard={handleDiscard}
      onSave={handleSave}
    />
  )
}

export function LetterTypesPanel({
  letterTypes,
  onLetterTypesChange,
  selectedId,
  onSelectedIdChange,
  onAddType,
}: LetterTypesPanelProps) {
  const { isCompact } = useLawyerWorkplaceLayout()

  const selectedType = useMemo(
    () => letterTypes.find((type) => type.id === selectedId) ?? letterTypes[0] ?? null,
    [letterTypes, selectedId]
  )

  const handleSelect = (id: string) => {
    if (!letterTypes.some((item) => item.id === id)) return
    onSelectedIdChange(id)
  }

  if (!selectedType) {
    return null
  }

  return (
    <div
      className={cn(
        'min-h-[560px] gap-4 px-4 pb-6 sm:px-5 lg:px-7',
        isCompact ? 'flex flex-col' : 'grid grid-cols-[minmax(240px,280px)_1fr]'
      )}
    >
      <div className={cn(isCompact ? 'shrink-0' : 'min-h-0')}>
        <LetterTypeList
          letterTypes={letterTypes}
          selectedId={selectedId}
          onSelect={handleSelect}
          onAddType={onAddType}
        />
      </div>

      <LetterTypeDetailEditor
        key={selectedId}
        selectedType={selectedType}
        letterTypes={letterTypes}
        onLetterTypesChange={onLetterTypesChange}
      />
    </div>
  )
}
