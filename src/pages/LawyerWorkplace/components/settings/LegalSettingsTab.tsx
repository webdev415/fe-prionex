import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  mapLegalLawyerToSettings,
  mapLegalLetterTypeToConfig,
  useLegalLawyers,
  useLegalLetterTypes,
  useLegalSettingsActions,
} from '@/features/lawyerWorkplace'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import {
  INITIAL_DEPARTMENT_SYNC,
  INITIAL_DOCUMENT_PRESETS,
  INITIAL_REPLY_TEMPLATES,
  INITIAL_SETTINGS_MAILBOXES,
} from '../../settings/settingsData'
import type {
  DepartmentSyncSettings,
  SettingsDocumentPreset,
  SettingsMailbox,
  SettingsReplyTemplate,
  SettingsSubTab,
} from '../../settings/types'
import { cloneMailbox, cloneSyncSettings } from '../../settings/utils/mailboxHelpers'
import { cloneDocumentPreset, cloneReplyTemplate } from '../../settings/utils/templateHelpers'
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
  const [selectedLetterTypeId, setSelectedLetterTypeId] = useState('')
  const pendingLawyerTypeSelectRef = useRef<((typeId: string) => void) | null>(null)

  const letterTypesQuery = useLegalLetterTypes({ includeInactive: true })
  const lawyersQuery = useLegalLawyers({ includeInactive: true })
  const usersQuery = useUsers({ page: 1, page_size: 200, status: 'active' })
  const {
    addLetterType,
    saveLetterType,
    addLawyer,
    updateLawyerMaxInFlight,
    isSavingLetterType,
    isSavingLawyer,
  } = useLegalSettingsActions()

  const letterTypes = useMemo(
    () => (letterTypesQuery.data?.items ?? []).map(mapLegalLetterTypeToConfig),
    [letterTypesQuery.data?.items]
  )
  const lawyers = useMemo(
    () => (lawyersQuery.data?.items ?? []).map(mapLegalLawyerToSettings),
    [lawyersQuery.data?.items]
  )

  const activeSelectedLetterTypeId = useMemo(() => {
    if (letterTypes.length === 0) return ''
    if (selectedLetterTypeId && letterTypes.some((type) => type.id === selectedLetterTypeId)) {
      return selectedLetterTypeId
    }
    return letterTypes[0]?.id ?? ''
  }, [letterTypes, selectedLetterTypeId])

  const availableUsers = useMemo(() => {
    const existingLawyerIds = new Set(
      (lawyersQuery.data?.items ?? []).map((lawyer) => lawyer.user_id)
    )
    return (usersQuery.data?.users ?? [])
      .filter((user) => !existingLawyerIds.has(user.id))
      .map((user) => ({
        id: user.id,
        name: user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username,
      }))
  }, [lawyersQuery.data?.items, usersQuery.data?.users])

  const letterTypesLoading = letterTypesQuery.isLoading
  const lawyersTabLoading =
    letterTypesQuery.isLoading || lawyersQuery.isLoading || usersQuery.isLoading
  const settingsError = letterTypesQuery.isError || lawyersQuery.isError

  const isLoading = activeSubTab === 'lawyers' ? lawyersTabLoading : letterTypesLoading

  const handleAddLetterType = async (input: { nameFallback: string; colorId: string }) => {
    try {
      const newTypeId = await addLetterType(input)
      setSelectedLetterTypeId(newTypeId)
      pendingLawyerTypeSelectRef.current?.(newTypeId)
      pendingLawyerTypeSelectRef.current = null
      toast.success(t('pages.lawyerWorkplace.settings.modals.addType.success', 'Letter type added'))
    } catch {
      // mutation toast handles errors
    }
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

      {isLoading && (activeSubTab === 'letterTypes' || activeSubTab === 'lawyers') ? (
        <p className="text-light-600 px-4 py-10 text-center text-sm sm:px-5 lg:px-7">
          {t('pages.lawyerWorkplace.settings.loading', 'Loading settings…')}
        </p>
      ) : settingsError && (activeSubTab === 'letterTypes' || activeSubTab === 'lawyers') ? (
        <p className="px-4 py-10 text-center text-sm text-red-500 sm:px-5 lg:px-7">
          {t('pages.lawyerWorkplace.settings.loadError', 'Could not load settings')}
        </p>
      ) : null}

      {activeSubTab === 'letterTypes' && !isLoading && !settingsError && (
        <LetterTypesPanel
          letterTypes={letterTypes}
          selectedId={activeSelectedLetterTypeId}
          onSelectedIdChange={setSelectedLetterTypeId}
          onAddType={() => openAddLetterType()}
          onSaveLetterType={saveLetterType}
          isSaving={isSavingLetterType}
        />
      )}

      {activeSubTab === 'lawyers' && !isLoading && !settingsError && (
        <LawyersPanel
          lawyers={lawyers}
          letterTypes={letterTypes}
          availableUsers={availableUsers}
          onAddLawyer={addLawyer}
          onUpdateLawyerMaxInFlight={updateLawyerMaxInFlight}
          isSaving={isSavingLawyer}
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
        isSubmitting={isSavingLetterType}
      />
    </div>
  )
}
