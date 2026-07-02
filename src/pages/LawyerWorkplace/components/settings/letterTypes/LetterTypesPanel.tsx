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
  readOnly?: boolean
}

interface LetterTypeDetailEditorProps {
  selectedType: LetterTypeConfig
  onSaveLetterType: (draft: LetterTypeConfig, original: LetterTypeConfig) => Promise<void>
  isSaving?: boolean
  onBack?: () => void
  readOnly?: boolean
}

function LetterTypeDetailEditor({
  selectedType,
  onSaveLetterType,
  isSaving = false,
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
      // Baseline/draft sync from refetched selectedType in useEffect — do not setBaseline(draft)
      // here; draft in this closure still has local example ids/keys and would mark the form dirty again.
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
  isSaving = false,
  readOnly = false,
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
            readOnly={readOnly}
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
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}
