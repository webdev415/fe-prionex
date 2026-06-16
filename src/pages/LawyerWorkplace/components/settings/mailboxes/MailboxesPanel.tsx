import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type {
  DepartmentSyncSettings,
  LetterTypeConfig,
  SettingsMailbox,
} from '../../../settings/types'
import {
  cloneMailbox,
  createMailboxFromForm,
  toggleMailboxStatus,
  updateMailbox,
} from '../../../settings/utils/mailboxHelpers'
import { MailboxModal, type MailboxFormValues } from './MailboxModal'
import { MailboxesTable } from './MailboxesTable'
import { SyncSettingsCard } from './SyncSettingsCard'

interface MailboxesPanelProps {
  mailboxes: SettingsMailbox[]
  syncSettings: DepartmentSyncSettings
  letterTypes: LetterTypeConfig[]
  onMailboxesChange: (mailboxes: SettingsMailbox[]) => void
  onSyncSettingsChange: (settings: DepartmentSyncSettings) => void
}

export function MailboxesPanel({
  mailboxes,
  syncSettings,
  letterTypes,
  onMailboxesChange,
  onSyncSettingsChange,
}: MailboxesPanelProps) {
  const { t } = useTranslation('common')
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

  const handleSave = (values: MailboxFormValues) => {
    if (editingMailbox) {
      onMailboxesChange(
        updateMailbox(mailboxes, editingMailbox.id, {
          email: values.email.trim().toLowerCase(),
          displayNameFallback: values.displayName,
          displayNameKey: `custom-mailbox:${editingMailbox.id}`,
          defaultLetterTypeId: values.defaultLetterTypeId,
          isDefaultOutgoing: values.isDefaultOutgoing,
          routingRules: values.routingRules,
        })
      )
      toast.success(t('pages.lawyerWorkplace.settings.mailboxes.updateSuccess', 'Mailbox updated'))
    } else {
      const created = createMailboxFromForm(values)
      const next = values.isDefaultOutgoing
        ? [created, ...mailboxes.map((item) => ({ ...item, isDefaultOutgoing: false }))]
        : [...mailboxes, created]
      onMailboxesChange(next)
      toast.success(t('pages.lawyerWorkplace.settings.mailboxes.addSuccess', 'Mailbox added'))
    }
    closeModal()
  }

  const handleToggleStatus = (mailboxId: string) => {
    onMailboxesChange(toggleMailboxStatus(mailboxes, mailboxId))
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
        <SyncSettingsCard syncSettings={syncSettings} onSyncSettingsChange={onSyncSettingsChange} />
        <MailboxesTable
          mailboxes={mailboxes}
          letterTypes={letterTypes}
          onEdit={openEdit}
          onToggleStatus={handleToggleStatus}
          onAddMailbox={openAdd}
        />
      </div>

      <MailboxModal
        open={modalOpen}
        mailbox={editingMailbox}
        letterTypes={letterTypes}
        existingEmails={mailboxes.map((item) => item.email)}
        onClose={closeModal}
        onSave={handleSave}
      />
    </>
  )
}
