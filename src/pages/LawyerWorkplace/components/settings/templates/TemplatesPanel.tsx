import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type {
  LetterTypeConfig,
  SettingsDocumentPreset,
  SettingsReplyTemplate,
} from '../../../settings/types'
import {
  cloneDocumentPreset,
  cloneReplyTemplate,
  createDocumentPresetFromForm,
  createReplyTemplateFromForm,
  toggleDocumentPresetActive,
  toggleReplyTemplateActive,
  updateDocumentPreset,
  updateReplyTemplate,
} from '../../../settings/utils/templateHelpers'
import { DocumentPresetModal, type DocumentPresetFormValues } from './DocumentPresetModal'
import { DocumentPresetsTable } from './DocumentPresetsTable'
import { ReplyTemplateModal, type ReplyTemplateFormValues } from './ReplyTemplateModal'
import { ReplyTemplatesTable } from './ReplyTemplatesTable'

interface TemplatesPanelProps {
  replyTemplates: SettingsReplyTemplate[]
  documentPresets: SettingsDocumentPreset[]
  letterTypes: LetterTypeConfig[]
  onReplyTemplatesChange: (templates: SettingsReplyTemplate[]) => void
  onDocumentPresetsChange: (presets: SettingsDocumentPreset[]) => void
}

export function TemplatesPanel({
  replyTemplates,
  documentPresets,
  letterTypes,
  onReplyTemplatesChange,
  onDocumentPresetsChange,
}: TemplatesPanelProps) {
  const { t } = useTranslation('common')
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

  const handleSaveReply = (values: ReplyTemplateFormValues) => {
    if (editingReply) {
      onReplyTemplatesChange(
        updateReplyTemplate(replyTemplates, editingReply.id, {
          nameFallback: values.name,
          nameKey: `custom-reply:${editingReply.id}`,
          bodyFallback: values.body,
          bodyKey: `custom-reply-body:${editingReply.id}`,
          letterTypeIds: values.letterTypeIds,
          isActive: values.isActive,
        })
      )
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.replyUpdateSuccess', 'Reply template updated')
      )
    } else {
      onReplyTemplatesChange([...replyTemplates, createReplyTemplateFromForm(values)])
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.replyAddSuccess', 'Reply template added')
      )
    }
    setReplyModalOpen(false)
    setEditingReply(null)
  }

  const handleSavePreset = (values: DocumentPresetFormValues) => {
    if (editingPreset) {
      onDocumentPresetsChange(
        updateDocumentPreset(documentPresets, editingPreset.id, {
          nameFallback: values.name,
          nameKey: `custom-preset:${editingPreset.id}`,
          documentType: values.documentType,
          defaultAssigneeId: values.defaultAssigneeId,
          isActive: values.isActive,
        })
      )
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.presetUpdateSuccess', 'Document preset updated')
      )
    } else {
      onDocumentPresetsChange([...documentPresets, createDocumentPresetFromForm(values)])
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.presetAddSuccess', 'Document preset added')
      )
    }
    setPresetModalOpen(false)
    setEditingPreset(null)
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
        <ReplyTemplatesTable
          templates={replyTemplates}
          letterTypes={letterTypes}
          onEdit={openEditReply}
          onToggleActive={(id) =>
            onReplyTemplatesChange(toggleReplyTemplateActive(replyTemplates, id))
          }
          onAdd={openAddReply}
        />
        <DocumentPresetsTable
          presets={documentPresets}
          onEdit={openEditPreset}
          onToggleActive={(id) =>
            onDocumentPresetsChange(toggleDocumentPresetActive(documentPresets, id))
          }
          onAdd={openAddPreset}
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
      />

      <DocumentPresetModal
        open={presetModalOpen}
        preset={editingPreset}
        onClose={() => {
          setPresetModalOpen(false)
          setEditingPreset(null)
        }}
        onSave={handleSavePreset}
      />
    </>
  )
}
