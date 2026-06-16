import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import {
  INITIAL_DEPARTMENT_SYNC,
  INITIAL_DOCUMENT_PRESETS,
  INITIAL_LETTER_TYPES,
  INITIAL_REPLY_TEMPLATES,
  INITIAL_SETTINGS_LAWYERS,
  INITIAL_SETTINGS_MAILBOXES,
} from '../../settings/settingsData'
import type {
  DepartmentSyncSettings,
  LetterTypeConfig,
  SettingsDocumentPreset,
  SettingsLawyer,
  SettingsMailbox,
  SettingsReplyTemplate,
  SettingsSubTab,
} from '../../settings/types'
import { cloneMailbox, cloneSyncSettings } from '../../settings/utils/mailboxHelpers'
import { cloneDocumentPreset, cloneReplyTemplate } from '../../settings/utils/templateHelpers'
import { cloneLetterType, createLetterTypeFromInput } from '../../settings/utils/letterTypeHelpers'
import { AddLetterTypeModal } from './letterTypes/AddLetterTypeModal'
import { LetterTypesPanel } from './letterTypes/LetterTypesPanel'
import { LawyersPanel } from './lawyers/LawyersPanel'
import { MailboxesPanel } from './mailboxes/MailboxesPanel'
import { TemplatesPanel } from './templates/TemplatesPanel'
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
  const [mailboxes, setMailboxes] = useState<SettingsMailbox[]>(() =>
    INITIAL_SETTINGS_MAILBOXES.map((mailbox) => cloneMailbox(mailbox))
  )
  const [syncSettings, setSyncSettings] = useState<DepartmentSyncSettings>(() =>
    cloneSyncSettings(INITIAL_DEPARTMENT_SYNC)
  )
  const [replyTemplates, setReplyTemplates] = useState<SettingsReplyTemplate[]>(() =>
    INITIAL_REPLY_TEMPLATES.map((template) => cloneReplyTemplate(template))
  )
  const [documentPresets, setDocumentPresets] = useState<SettingsDocumentPreset[]>(() =>
    INITIAL_DOCUMENT_PRESETS.map((preset) => cloneDocumentPreset(preset))
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
        <MailboxesPanel
          mailboxes={mailboxes}
          syncSettings={syncSettings}
          letterTypes={letterTypes}
          onMailboxesChange={setMailboxes}
          onSyncSettingsChange={setSyncSettings}
        />
      )}

      {activeSubTab === 'templates' && (
        <TemplatesPanel
          replyTemplates={replyTemplates}
          documentPresets={documentPresets}
          letterTypes={letterTypes}
          onReplyTemplatesChange={setReplyTemplates}
          onDocumentPresetsChange={setDocumentPresets}
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
