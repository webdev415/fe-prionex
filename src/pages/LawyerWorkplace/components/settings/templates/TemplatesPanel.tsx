import { useState } from 'react'
import type { LetterTypeConfig, SettingsReplyTemplate } from '../../../settings/types'
import { cloneReplyTemplate } from '../../../settings/utils/templateHelpers'
import { DeleteLetterTemplateModal } from './DeleteLetterTemplateModal'
import { ReplyTemplateModal, type ReplyTemplateFormValues } from './ReplyTemplateModal'
import { ReplyTemplatesTable } from './ReplyTemplatesTable'

interface TemplatesPanelProps {
  replyTemplates: SettingsReplyTemplate[]
  letterTypes: LetterTypeConfig[]
  onSaveReplyTemplate: (
    values: ReplyTemplateFormValues,
    editingTemplate: SettingsReplyTemplate | null
  ) => Promise<void>
  onDeleteReplyTemplate: (template: SettingsReplyTemplate) => Promise<void>
  isSavingReplyTemplate: boolean
  isDeletingReplyTemplate: boolean
  readOnly?: boolean
}

export function TemplatesPanel({
  replyTemplates,
  letterTypes,
  onSaveReplyTemplate,
  onDeleteReplyTemplate,
  isSavingReplyTemplate,
  isDeletingReplyTemplate,
  readOnly = false,
}: TemplatesPanelProps) {
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [editingReply, setEditingReply] = useState<SettingsReplyTemplate | null>(null)
  const [deletingReply, setDeletingReply] = useState<SettingsReplyTemplate | null>(null)

  const openAddReply = () => {
    setEditingReply(null)
    setReplyModalOpen(true)
  }

  const openEditReply = (template: SettingsReplyTemplate) => {
    setEditingReply(cloneReplyTemplate(template))
    setReplyModalOpen(true)
  }

  const handleSaveReply = async (values: ReplyTemplateFormValues) => {
    try {
      await onSaveReplyTemplate(values, editingReply)
      setReplyModalOpen(false)
      setEditingReply(null)
    } catch {
      // mutation toast handles errors
    }
  }

  const handleDeleteReply = async () => {
    if (!deletingReply) return
    try {
      await onDeleteReplyTemplate(deletingReply)
      setDeletingReply(null)
    } catch {
      // mutation toast handles errors
    }
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
        <ReplyTemplatesTable
          templates={replyTemplates}
          letterTypes={letterTypes}
          onEdit={openEditReply}
          onDelete={setDeletingReply}
          onAdd={openAddReply}
          readOnly={readOnly}
        />
      </div>

      <DeleteLetterTemplateModal
        open={deletingReply !== null}
        template={deletingReply}
        onClose={() => setDeletingReply(null)}
        onConfirm={handleDeleteReply}
        isDeleting={isDeletingReplyTemplate}
      />

      <ReplyTemplateModal
        open={replyModalOpen}
        template={editingReply}
        letterTypes={letterTypes}
        onClose={() => {
          setReplyModalOpen(false)
          setEditingReply(null)
        }}
        onSave={handleSaveReply}
        isSubmitting={isSavingReplyTemplate}
      />
    </>
  )
}
