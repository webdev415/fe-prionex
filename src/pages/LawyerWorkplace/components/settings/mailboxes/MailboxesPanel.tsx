import { useState } from 'react'
import type {
  DepartmentSyncSettings,
  LetterTypeConfig,
  SettingsMailbox,
} from '../../../settings/types'
import { cloneMailbox } from '../../../settings/utils/mailboxHelpers'
import { MailboxModal, type MailboxFormValues } from './MailboxModal'
import { MailboxesTable } from './MailboxesTable'
import { SyncSettingsCard } from './SyncSettingsCard'

interface MailboxesPanelProps {
  mailboxes: SettingsMailbox[]
  syncSettings: DepartmentSyncSettings
  letterTypes: LetterTypeConfig[]
  onSaveMailbox: (
    values: MailboxFormValues,
    editingMailbox: SettingsMailbox | null
  ) => Promise<void>
  onToggleStatus: (mailbox: SettingsMailbox) => Promise<void>
  onSyncIntervalChange: (interval: DepartmentSyncSettings['interval']) => Promise<void>
  onTestSync: () => Promise<void>
  isSavingMailbox: boolean
  isSavingSync: boolean
  isPolling: boolean
}

export function MailboxesPanel({
  mailboxes,
  syncSettings,
  letterTypes,
  onSaveMailbox,
  onToggleStatus,
  onSyncIntervalChange,
  onTestSync,
  isSavingMailbox,
  isSavingSync,
  isPolling,
}: MailboxesPanelProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMailbox, setEditingMailbox] = useState<SettingsMailbox | null>(null)

  const openAdd = () => {
    setEditingMailbox(null)
    setModalOpen(true)
  }

  const openEdit = (mailbox: SettingsMailbox) => {
    setEditingMailbox(cloneMailbox(mailbox))
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingMailbox(null)
  }

  const handleSave = async (values: MailboxFormValues) => {
    try {
      await onSaveMailbox(values, editingMailbox)
      closeModal()
    } catch {
      // mutation toast handles errors
    }
  }

  const handleToggleStatus = async (mailbox: SettingsMailbox) => {
    try {
      await onToggleStatus(mailbox)
    } catch {
      // mutation toast handles errors
    }
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
        <SyncSettingsCard
          syncSettings={syncSettings}
          onSyncIntervalChange={onSyncIntervalChange}
          isSaving={isSavingSync}
        />
        <MailboxesTable
          mailboxes={mailboxes}
          letterTypes={letterTypes}
          onEdit={openEdit}
          onToggleStatus={handleToggleStatus}
          onAddMailbox={openAdd}
          onTestSync={onTestSync}
          isPolling={isPolling}
        />
      </div>

      <MailboxModal
        open={modalOpen}
        mailbox={editingMailbox}
        letterTypes={letterTypes}
        existingEmails={mailboxes.map((item) => item.email)}
        onClose={closeModal}
        onSave={handleSave}
        isSubmitting={isSavingMailbox}
      />
    </>
  )
}
