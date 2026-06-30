import { useState } from 'react'
import type {
  LetterTypeConfig,
  SettingsDocumentPreset,
  SettingsLawyer,
  SettingsReplyTemplate,
} from '../../../settings/types'
import { cloneDocumentPreset, cloneReplyTemplate } from '../../../settings/utils/templateHelpers'
import { DocumentPresetModal, type DocumentPresetFormValues } from './DocumentPresetModal'
import { DocumentPresetsTable } from './DocumentPresetsTable'
import { ReplyTemplateModal, type ReplyTemplateFormValues } from './ReplyTemplateModal'
import { ReplyTemplatesTable } from './ReplyTemplatesTable'

interface TemplatesPanelProps {
  replyTemplates: SettingsReplyTemplate[]
  documentPresets: SettingsDocumentPreset[]
  letterTypes: LetterTypeConfig[]
  lawyerAssignees: SettingsLawyer[]
  onSaveReplyTemplate: (
    values: ReplyTemplateFormValues,
    editingTemplate: SettingsReplyTemplate | null
  ) => Promise<void>
  onToggleReplyTemplateActive: (template: SettingsReplyTemplate) => Promise<void>
  onSaveDocumentPreset: (
    values: DocumentPresetFormValues,
    editingPreset: SettingsDocumentPreset | null
  ) => Promise<void>
  onToggleDocumentPresetActive: (preset: SettingsDocumentPreset) => Promise<void>
  isSavingReplyTemplate: boolean
  isSavingDocumentPreset: boolean
  readOnly?: boolean
}

export function TemplatesPanel({
  replyTemplates,
  documentPresets,
  letterTypes,
  lawyerAssignees,
  onSaveReplyTemplate,
  onToggleReplyTemplateActive,
  onSaveDocumentPreset,
  onToggleDocumentPresetActive,
  isSavingReplyTemplate,
  isSavingDocumentPreset,
  readOnly = false,
}: TemplatesPanelProps) {
  const [replyModalOpen, setReplyModalOpen] = useState(false)
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [editingReply, setEditingReply] = useState<SettingsReplyTemplate | null>(null)
  const [editingPreset, setEditingPreset] = useState<SettingsDocumentPreset | null>(null)

  const openAddReply = () => {
    setEditingReply(null)
    setReplyModalOpen(true)
  }

  const openEditReply = (template: SettingsReplyTemplate) => {
    setEditingReply(cloneReplyTemplate(template))
    setReplyModalOpen(true)
  }

  const openAddPreset = () => {
    setEditingPreset(null)
    setPresetModalOpen(true)
  }

  const openEditPreset = (preset: SettingsDocumentPreset) => {
    setEditingPreset(cloneDocumentPreset(preset))
    setPresetModalOpen(true)
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

  const handleSavePreset = async (values: DocumentPresetFormValues) => {
    try {
      await onSaveDocumentPreset(values, editingPreset)
      setPresetModalOpen(false)
      setEditingPreset(null)
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
          onToggleActive={(templateId) => {
            const template = replyTemplates.find((item) => item.id === templateId)
            if (template) void onToggleReplyTemplateActive(template)
          }}
          onAdd={openAddReply}
          readOnly={readOnly}
        />
        <DocumentPresetsTable
          presets={documentPresets}
          lawyerAssignees={lawyerAssignees}
          onEdit={openEditPreset}
          onToggleActive={(presetId) => {
            const preset = documentPresets.find((item) => item.id === presetId)
            if (preset) void onToggleDocumentPresetActive(preset)
          }}
          onAdd={openAddPreset}
          readOnly={readOnly}
        />
      </div>

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

      <DocumentPresetModal
        open={presetModalOpen}
        preset={editingPreset}
        lawyerAssignees={lawyerAssignees}
        onClose={() => {
          setPresetModalOpen(false)
          setEditingPreset(null)
        }}
        onSave={handleSavePreset}
        isSubmitting={isSavingDocumentPreset}
      />
    </>
  )
}
