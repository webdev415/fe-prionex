import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig } from '../../../settings/types'
import { cloneLetterType } from '../../../settings/utils/letterTypeHelpers'
import { DeleteLetterTypeModal } from './DeleteLetterTypeModal'
import { LetterTypeDetailPanel } from './LetterTypeDetailPanel'
import { LetterTypeList } from './LetterTypeList'

interface LetterTypesPanelProps {
  letterTypes: LetterTypeConfig[]
  selectedId: string
  onSelectedIdChange: (id: string) => void
  onAddType: () => void
  onSaveLetterType: (draft: LetterTypeConfig, original: LetterTypeConfig) => Promise<void>
  onDeleteLetterType: (letterTypeId: string) => Promise<void>
  isSaving?: boolean
  isDeleting?: boolean
  readOnly?: boolean
}

interface LetterTypeDetailEditorProps {
  selectedType: LetterTypeConfig
  onSaveLetterType: (draft: LetterTypeConfig, original: LetterTypeConfig) => Promise<void>
  onRequestDelete: () => void
  canDelete: boolean
  isSaving?: boolean
  isDeleting?: boolean
  onBack?: () => void
  readOnly?: boolean
}

function LetterTypeDetailEditor({
  selectedType,
  onSaveLetterType,
  onRequestDelete,
  canDelete,
  isSaving = false,
  isDeleting = false,
  onBack,
  readOnly = false,
}: LetterTypeDetailEditorProps) {
  const { t } = useTranslation('common')
  const [baseline, setBaseline] = useState(() => cloneLetterType(selectedType))
  const [draft, setDraft] = useState(() => cloneLetterType(selectedType))
  const [isPersisting, setIsPersisting] = useState(false)

  useEffect(() => {
    const next = cloneLetterType(selectedType)
    setBaseline(next)
    setDraft(next)
  }, [selectedType])

  const isDirty = useMemo(
    () => JSON.stringify(baseline) !== JSON.stringify(draft),
    [baseline, draft]
  )

  const handleSave = async () => {
    if (!isDirty || isPersisting || isSaving) return
    setIsPersisting(true)
    try {
      await onSaveLetterType(draft, baseline)
    } catch {
      toast.error(t('pages.lawyerWorkplace.settings.saveError', 'Could not save changes'))
    } finally {
      setIsPersisting(false)
    }
  }

  const handleDiscard = () => {
    setDraft(cloneLetterType(baseline))
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
      onDelete={onRequestDelete}
      canDelete={canDelete}
      isDeleting={isDeleting}
      readOnly={readOnly}
    />
  )
}

export function LetterTypesPanel({
  letterTypes,
  selectedId,
  onSelectedIdChange,
  onAddType,
  onSaveLetterType,
  onDeleteLetterType,
  isSaving = false,
  isDeleting = false,
  readOnly = false,
}: LetterTypesPanelProps) {
  const { isCompact } = useLawyerWorkplaceLayout()
  const [mobilePane, setMobilePane] = useState<'list' | 'detail'>('list')
  const [deletingType, setDeletingType] = useState<LetterTypeConfig | null>(null)

  const selectedType = useMemo(
    () => letterTypes.find((type) => type.id === selectedId) ?? letterTypes[0] ?? null,
    [letterTypes, selectedId]
  )

  const canDeleteSelectedType = letterTypes.length > 1

  const handleSelect = (id: string) => {
    if (!letterTypes.some((item) => item.id === id)) return
    onSelectedIdChange(id)
    if (isCompact) {
      setMobilePane('detail')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingType) return
    try {
      await onDeleteLetterType(deletingType.id)
      setDeletingType(null)
      if (isCompact) {
        setMobilePane('list')
      }
    } catch {
      // mutation toast handles errors
    }
  }

  if (letterTypes.length === 0) {
    return (
      <div className="min-w-0 px-4 pb-6 sm:px-5 lg:px-7">
        <LetterTypeList
          letterTypes={letterTypes}
          selectedId={selectedId}
          onSelect={handleSelect}
          onAddType={onAddType}
          readOnly={readOnly}
        />
      </div>
    )
  }

  const showList = !isCompact || mobilePane === 'list'
  const showDetail = !isCompact || mobilePane === 'detail'

  return (
    <>
      <div
        className={cn(
          'min-w-0 gap-4 px-4 pb-6 sm:px-5 lg:px-7',
          isCompact
            ? 'flex min-h-0 flex-col'
            : 'grid min-h-[560px] grid-cols-[minmax(240px,280px)_1fr]'
        )}
      >
        {showList ? (
          <div className={cn(isCompact ? 'min-h-0 shrink-0' : 'h-full min-h-0')}>
            <LetterTypeList
              letterTypes={letterTypes}
              selectedId={selectedId}
              onSelect={handleSelect}
              onAddType={onAddType}
              readOnly={readOnly}
            />
          </div>
        ) : null}

        {showDetail && selectedType ? (
          <LetterTypeDetailEditor
            key={selectedId}
            selectedType={selectedType}
            onSaveLetterType={onSaveLetterType}
            onRequestDelete={() => setDeletingType(selectedType)}
            canDelete={canDeleteSelectedType}
            isSaving={isSaving}
            isDeleting={isDeleting}
            onBack={isCompact ? () => setMobilePane('list') : undefined}
            readOnly={readOnly}
          />
        ) : null}
      </div>

      <DeleteLetterTypeModal
        open={deletingType !== null}
        letterType={deletingType}
        onClose={() => setDeletingType(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </>
  )
}
