import { useEffect, useMemo, useState } from 'react'
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
  selectedId: string
  onSelectedIdChange: (id: string) => void
  onAddType: () => void
  onSaveLetterType: (draft: LetterTypeConfig, original: LetterTypeConfig) => Promise<void>
  isSaving?: boolean
}

interface LetterTypeDetailEditorProps {
  selectedType: LetterTypeConfig
  onSaveLetterType: (draft: LetterTypeConfig, original: LetterTypeConfig) => Promise<void>
  isSaving?: boolean
  onBack?: () => void
}

function LetterTypeDetailEditor({
  selectedType,
  onSaveLetterType,
  isSaving = false,
  onBack,
}: LetterTypeDetailEditorProps) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState(() => cloneLetterType(selectedType))
  const [isPersisting, setIsPersisting] = useState(false)

  useEffect(() => {
    setDraft(cloneLetterType(selectedType))
  }, [selectedType])

  const isDirty = useMemo(
    () => JSON.stringify(selectedType) !== JSON.stringify(draft),
    [draft, selectedType]
  )

  const handleSave = async () => {
    if (!isDirty || isPersisting || isSaving) return
    setIsPersisting(true)
    try {
      await onSaveLetterType(draft, selectedType)
    } catch {
      toast.error(t('pages.lawyerWorkplace.settings.saveError', 'Could not save changes'))
    } finally {
      setIsPersisting(false)
    }
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
      isSaving={isPersisting || isSaving}
      onBack={onBack}
    />
  )
}

export function LetterTypesPanel({
  letterTypes,
  selectedId,
  onSelectedIdChange,
  onAddType,
  onSaveLetterType,
  isSaving = false,
}: LetterTypesPanelProps) {
  const { isCompact } = useLawyerWorkplaceLayout()
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list')

  const selectedType = useMemo(
    () => letterTypes.find((type) => type.id === selectedId) ?? letterTypes[0] ?? null,
    [letterTypes, selectedId]
  )

  const handleSelect = (id: string) => {
    if (!letterTypes.some((item) => item.id === id)) return
    onSelectedIdChange(id)
    if (isCompact) {
      setMobilePane('detail')
    }
  }

  if (!selectedType) {
    return null
  }

  const showList = !isCompact || mobilePane === 'list'
  const showDetail = !isCompact || mobilePane === 'detail'

  return (
    <div
      className={cn(
        'min-w-0 gap-4 px-4 pb-6 sm:px-5 lg:px-7',
        isCompact
          ? 'flex min-h-0 flex-col'
          : 'grid min-h-[560px] grid-cols-[minmax(240px,280px)_1fr]'
      )}
    >
      {showList ? (
        <div className={cn(isCompact ? 'min-h-0 shrink-0' : 'min-h-0')}>
          <LetterTypeList
            letterTypes={letterTypes}
            selectedId={selectedId}
            onSelect={handleSelect}
            onAddType={onAddType}
          />
        </div>
      ) : null}

      {showDetail ? (
        <LetterTypeDetailEditor
          key={selectedId}
          selectedType={selectedType}
          onSaveLetterType={onSaveLetterType}
          isSaving={isSaving}
          onBack={isCompact ? () => setMobilePane('list') : undefined}
        />
      ) : null}
    </div>
  )
}
