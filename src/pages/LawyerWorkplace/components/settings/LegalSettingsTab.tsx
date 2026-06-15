import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import { INITIAL_LETTER_TYPES, INITIAL_SETTINGS_LAWYERS } from '../../settings/settingsData'
import type { LetterTypeConfig, SettingsLawyer, SettingsSubTab } from '../../settings/types'
import { cloneLetterType, createLetterTypeFromInput } from '../../settings/utils/letterTypeHelpers'
import { AddLetterTypeModal } from './letterTypes/AddLetterTypeModal'
import { LetterTypesPanel } from './letterTypes/LetterTypesPanel'
import { LawyersPanel } from './lawyers/LawyersPanel'
import { SettingsPlaceholderPanel } from './SettingsPlaceholderPanel'
import { SettingsToolbar } from './SettingsToolbar'

export function LegalSettingsTab() {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('letterTypes')
  const [letterTypes, setLetterTypes] = useState<LetterTypeConfig[]>(() =>
    INITIAL_LETTER_TYPES.map((type) => cloneLetterType(type))
  )
  const [lawyers, setLawyers] = useState<SettingsLawyer[]>(() =>
    INITIAL_SETTINGS_LAWYERS.map((lawyer) => ({ ...lawyer }))
  )
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [selectedLetterTypeId, setSelectedLetterTypeId] = useState(letterTypes[0]?.id ?? '')
  const pendingLawyerTypeSelectRef = useRef<((typeId: string) => void) | null>(null)

  const handleAddLetterType = (input: Pick<LetterTypeConfig, 'nameFallback' | 'colorId'>) => {
    const newType = createLetterTypeFromInput(input)
    setLetterTypes((previous) => [newType, ...previous])
    setSelectedLetterTypeId(newType.id)
    pendingLawyerTypeSelectRef.current?.(newType.id)
    pendingLawyerTypeSelectRef.current = null
    toast.success(t('pages.lawyerWorkplace.settings.modals.addType.success', 'Letter type added'))
  }

  const openAddLetterType = (onCreated?: (typeId: string) => void) => {
    pendingLawyerTypeSelectRef.current = onCreated ?? null
    setAddTypeOpen(true)
  }

  const closeAddLetterType = () => {
    pendingLawyerTypeSelectRef.current = null
    setAddTypeOpen(false)
  }

  return (
    <div className={cn('min-w-0', isCompact ? 'pb-8' : 'pb-6')}>
      <SettingsToolbar activeSubTab={activeSubTab} onSubTabChange={setActiveSubTab} />

      {activeSubTab === 'letterTypes' && (
        <LetterTypesPanel
          letterTypes={letterTypes}
          onLetterTypesChange={setLetterTypes}
          selectedId={selectedLetterTypeId}
          onSelectedIdChange={setSelectedLetterTypeId}
          onAddType={() => openAddLetterType()}
        />
      )}

      {activeSubTab === 'lawyers' && (
        <LawyersPanel
          lawyers={lawyers}
          letterTypes={letterTypes}
          onLawyersChange={setLawyers}
          onAddLetterType={openAddLetterType}
        />
      )}

      {activeSubTab === 'mailboxes' && (
        <SettingsPlaceholderPanel
          titleKey="pages.lawyerWorkplace.settings.mailboxes.title"
          titleFallback="Mailboxes"
          descriptionKey="pages.lawyerWorkplace.settings.mailboxes.description"
          descriptionFallback="Configure connected legal mailboxes, sync intervals, and routing rules."
        />
      )}

      {activeSubTab === 'templates' && (
        <SettingsPlaceholderPanel
          titleKey="pages.lawyerWorkplace.settings.templates.title"
          titleFallback="Templates"
          descriptionKey="pages.lawyerWorkplace.settings.templates.description"
          descriptionFallback="Manage outgoing letter templates and document generation presets."
        />
      )}

      <AddLetterTypeModal
        open={addTypeOpen}
        onClose={closeAddLetterType}
        onAdd={handleAddLetterType}
      />
    </div>
  )
}
