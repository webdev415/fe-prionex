import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  mapLegalDocumentPresetToSettings,
  mapLegalLawyerToSettings,
  mapLegalLetterTypeToConfig,
  mapLegalReplyTemplateToSettings,
  mapLegalSettingsMailboxToSettings,
  mapSyncSettingsToUi,
  useLegalLawyers,
  useLegalLetterTypes,
  useLegalSettingsActions,
  useLegalSettingsDocumentPresets,
  useLegalSettingsMailboxes,
  useLegalSettingsReplyTemplates,
  useLegalSyncSettings,
  useLegalTemplateSettingsActions,
  useCanManageLegalWorkplaceSettings,
} from '@/features/lawyerWorkplace'
import { useLegalMailboxSettingsActions } from '@/features/lawyerWorkplace/hooks/useLegalMailboxSettingsActions'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/stores/authStore'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { SettingsSubTab } from '../../settings/types'
import { AddLetterTypeModal } from './letterTypes/AddLetterTypeModal'
import { LetterTypesPanel } from './letterTypes/LetterTypesPanel'
import { LawyersPanel } from './lawyers/LawyersPanel'
import { MailboxesPanel } from './mailboxes/MailboxesPanel'
import { TemplatesPanel } from './templates/TemplatesPanel'
import { SettingsToolbar } from './SettingsToolbar'

export function LegalSettingsTab() {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const canManageSettings = useCanManageLegalWorkplaceSettings()
  const readOnly = !canManageSettings
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('letterTypes')
  const [addTypeOpen, setAddTypeOpen] = useState(false)
  const [selectedLetterTypeId, setSelectedLetterTypeId] = useState('')
  const pendingLawyerTypeSelectRef = useRef<((typeId: string) => void) | null>(null)

  const lawyersTabEnabled = activeSubTab === 'lawyers'
  const templatesTabEnabled = activeSubTab === 'templates'
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)
  const projectId = activeProjectId ? Number(activeProjectId) : null

  const mailboxesEnabled = activeSubTab === 'mailboxes'
  const letterTypesQuery = useLegalLetterTypes({
    includeInactive: true,
    enabled:
      activeSubTab === 'letterTypes' ||
      lawyersTabEnabled ||
      mailboxesEnabled ||
      templatesTabEnabled,
  })
  const lawyersQuery = useLegalLawyers({
    includeInactive: true,
    enabled: lawyersTabEnabled,
  })
  const operatorsQuery = useOperators(lawyersTabEnabled ? projectId : null, {
    includeInactive: false,
  })
  const mailboxesQuery = useLegalSettingsMailboxes({ enabled: mailboxesEnabled })
  const syncQuery = useLegalSyncSettings({ enabled: mailboxesEnabled })
  const replyTemplatesQuery = useLegalSettingsReplyTemplates({ enabled: templatesTabEnabled })
  const documentPresetsQuery = useLegalSettingsDocumentPresets({ enabled: templatesTabEnabled })
  const templateLawyersQuery = useLegalLawyers({
    includeInactive: false,
    enabled: templatesTabEnabled,
  })
  const {
    addLetterType,
    saveLetterType,
    addLawyer,
    updateLawyerMaxInFlight,
    isSavingLetterType,
    isSavingLawyer,
  } = useLegalSettingsActions()
  const {
    saveMailbox,
    toggleMailboxStatus,
    changeSyncInterval,
    testSync,
    connectGmail,
    isSavingMailbox,
    isPolling,
    isSavingSync,
  } = useLegalMailboxSettingsActions()
  const {
    saveReplyTemplate,
    toggleReplyTemplateActive,
    saveDocumentPreset,
    toggleDocumentPresetActive,
    isSavingReplyTemplate,
    isSavingDocumentPreset,
  } = useLegalTemplateSettingsActions()

  const letterTypes = useMemo(
    () => (letterTypesQuery.data?.items ?? []).map(mapLegalLetterTypeToConfig),
    [letterTypesQuery.data?.items]
  )
  const lawyers = useMemo(
    () => (lawyersQuery.data?.items ?? []).map(mapLegalLawyerToSettings),
    [lawyersQuery.data?.items]
  )
  const mailboxes = useMemo(
    () => (mailboxesQuery.data?.items ?? []).map(mapLegalSettingsMailboxToSettings),
    [mailboxesQuery.data?.items]
  )
  const syncSettings = useMemo(
    () => (syncQuery.data ? mapSyncSettingsToUi(syncQuery.data) : null),
    [syncQuery.data]
  )
  const replyTemplates = useMemo(
    () => (replyTemplatesQuery.data?.items ?? []).map(mapLegalReplyTemplateToSettings),
    [replyTemplatesQuery.data?.items]
  )
  const documentPresets = useMemo(
    () => (documentPresetsQuery.data?.items ?? []).map(mapLegalDocumentPresetToSettings),
    [documentPresetsQuery.data?.items]
  )
  const templateLawyers = useMemo(
    () => (templateLawyersQuery.data?.items ?? []).map(mapLegalLawyerToSettings),
    [templateLawyersQuery.data?.items]
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
    return (operatorsQuery.data ?? [])
      .filter((user) => !existingLawyerIds.has(user.id))
      .map((user) => ({
        id: user.id,
        name: user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username,
      }))
  }, [lawyersQuery.data?.items, operatorsQuery.data])

  const letterTypesLoading = letterTypesQuery.isLoading
  const lawyersTabLoading = letterTypesQuery.isLoading || lawyersQuery.isLoading
  const mailboxesTabLoading =
    letterTypesQuery.isLoading || mailboxesQuery.isLoading || syncQuery.isLoading
  const templatesTabLoading =
    letterTypesQuery.isLoading ||
    replyTemplatesQuery.isLoading ||
    documentPresetsQuery.isLoading ||
    templateLawyersQuery.isLoading
  const settingsError =
    (activeSubTab === 'letterTypes' && letterTypesQuery.isError) ||
    (lawyersTabEnabled && (letterTypesQuery.isError || lawyersQuery.isError)) ||
    (mailboxesEnabled &&
      (letterTypesQuery.isError || mailboxesQuery.isError || syncQuery.isError)) ||
    (templatesTabEnabled &&
      (letterTypesQuery.isError ||
        replyTemplatesQuery.isError ||
        documentPresetsQuery.isError ||
        templateLawyersQuery.isError))

  const isLoading =
    activeSubTab === 'lawyers'
      ? lawyersTabLoading
      : activeSubTab === 'mailboxes'
        ? mailboxesTabLoading
        : activeSubTab === 'templates'
          ? templatesTabLoading
          : letterTypesLoading

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
    if (readOnly) return
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

      {readOnly && (
        <p className="text-light-600 mx-4 mb-2 rounded-lg border border-gray-100 bg-white px-4 py-2.5 text-[12px] sm:mx-5 lg:mx-7">
          {t(
            'pages.lawyerWorkplace.settings.readOnlyNotice',
            'View only — you do not have permission to change department settings.'
          )}
        </p>
      )}

      {isLoading &&
      (activeSubTab === 'letterTypes' ||
        activeSubTab === 'lawyers' ||
        activeSubTab === 'mailboxes' ||
        activeSubTab === 'templates') ? (
        <p className="text-light-600 px-4 py-10 text-center text-sm sm:px-5 lg:px-7">
          {t('pages.lawyerWorkplace.settings.loading', 'Loading settings…')}
        </p>
      ) : settingsError &&
        (activeSubTab === 'letterTypes' ||
          activeSubTab === 'lawyers' ||
          activeSubTab === 'mailboxes' ||
          activeSubTab === 'templates') ? (
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
          readOnly={readOnly}
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
          readOnly={readOnly}
        />
      )}

      {activeSubTab === 'mailboxes' && !isLoading && !settingsError && syncSettings && (
        <MailboxesPanel
          mailboxes={mailboxes}
          syncSettings={syncSettings}
          letterTypes={letterTypes}
          onSaveMailbox={saveMailbox}
          onToggleStatus={toggleMailboxStatus}
          onSyncIntervalChange={changeSyncInterval}
          onTestSync={testSync}
          onConnectGmail={connectGmail}
          isSavingMailbox={isSavingMailbox}
          isSavingSync={isSavingSync}
          isPolling={isPolling}
          readOnly={readOnly}
        />
      )}

      {activeSubTab === 'templates' && !isLoading && !settingsError && (
        <TemplatesPanel
          replyTemplates={replyTemplates}
          documentPresets={documentPresets}
          letterTypes={letterTypes}
          lawyerAssignees={templateLawyers}
          onSaveReplyTemplate={saveReplyTemplate}
          onToggleReplyTemplateActive={toggleReplyTemplateActive}
          onSaveDocumentPreset={saveDocumentPreset}
          onToggleDocumentPresetActive={toggleDocumentPresetActive}
          isSavingReplyTemplate={isSavingReplyTemplate}
          isSavingDocumentPreset={isSavingDocumentPreset}
          readOnly={readOnly}
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
