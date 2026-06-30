import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { DocumentPresetFormValues } from '@/pages/LawyerWorkplace/components/settings/templates/DocumentPresetModal'
import type { ReplyTemplateFormValues } from '@/pages/LawyerWorkplace/components/settings/templates/ReplyTemplateModal'
import type {
  SettingsDocumentPreset,
  SettingsReplyTemplate,
} from '@/pages/LawyerWorkplace/settings/types'
import {
  mapDocumentPresetFormToCreate,
  mapDocumentPresetFormToUpdate,
  mapReplyTemplateFormToCreate,
  mapReplyTemplateFormToUpdate,
} from '../api/settingsMappers'
import {
  useCreateLegalDocumentPreset,
  useCreateLegalReplyTemplate,
  useUpdateLegalDocumentPreset,
  useUpdateLegalReplyTemplate,
} from './useLegalMutations'

export function useLegalTemplateSettingsActions() {
  const { t } = useTranslation('common')
  const createReplyTemplate = useCreateLegalReplyTemplate()
  const updateReplyTemplate = useUpdateLegalReplyTemplate()
  const createDocumentPreset = useCreateLegalDocumentPreset()
  const updateDocumentPreset = useUpdateLegalDocumentPreset()

  const saveReplyTemplate = useCallback(
    async (values: ReplyTemplateFormValues, editingTemplate: SettingsReplyTemplate | null) => {
      if (editingTemplate) {
        await updateReplyTemplate.mutateAsync({
          templateId: editingTemplate.id,
          payload: mapReplyTemplateFormToUpdate(values),
        })
        toast.success(
          t('pages.lawyerWorkplace.settings.templates.replyUpdateSuccess', 'Reply template updated')
        )
        return
      }

      await createReplyTemplate.mutateAsync(mapReplyTemplateFormToCreate(values))
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.replyAddSuccess', 'Reply template added')
      )
    },
    [createReplyTemplate, t, updateReplyTemplate]
  )

  const toggleReplyTemplateActive = useCallback(
    async (template: SettingsReplyTemplate) => {
      await updateReplyTemplate.mutateAsync({
        templateId: template.id,
        payload: { is_active: !template.isActive },
      })
    },
    [updateReplyTemplate]
  )

  const saveDocumentPreset = useCallback(
    async (values: DocumentPresetFormValues, editingPreset: SettingsDocumentPreset | null) => {
      if (editingPreset) {
        await updateDocumentPreset.mutateAsync({
          presetId: editingPreset.id,
          payload: mapDocumentPresetFormToUpdate(values),
        })
        toast.success(
          t(
            'pages.lawyerWorkplace.settings.templates.presetUpdateSuccess',
            'Document preset updated'
          )
        )
        return
      }

      await createDocumentPreset.mutateAsync(mapDocumentPresetFormToCreate(values))
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.presetAddSuccess', 'Document preset added')
      )
    },
    [createDocumentPreset, t, updateDocumentPreset]
  )

  const toggleDocumentPresetActive = useCallback(
    async (preset: SettingsDocumentPreset) => {
      await updateDocumentPreset.mutateAsync({
        presetId: preset.id,
        payload: { is_active: !preset.isActive },
      })
    },
    [updateDocumentPreset]
  )

  return {
    saveReplyTemplate,
    toggleReplyTemplateActive,
    saveDocumentPreset,
    toggleDocumentPresetActive,
    isSavingReplyTemplate: createReplyTemplate.isPending || updateReplyTemplate.isPending,
    isSavingDocumentPreset: createDocumentPreset.isPending || updateDocumentPreset.isPending,
  }
}
