import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ReplyTemplateFormValues } from '@/pages/LawyerWorkplace/components/settings/templates/ReplyTemplateModal'
import type { SettingsReplyTemplate } from '@/pages/LawyerWorkplace/settings/types'
import { mapReplyTemplateFormToCreate, mapReplyTemplateFormToUpdate } from '../api/settingsMappers'
import {
  useCreateLegalReplyTemplate,
  useDeleteLegalReplyTemplate,
  useUpdateLegalReplyTemplate,
} from './useLegalMutations'

export function useLegalTemplateSettingsActions() {
  const { t } = useTranslation('common')
  const createReplyTemplate = useCreateLegalReplyTemplate()
  const updateReplyTemplate = useUpdateLegalReplyTemplate()
  const deleteReplyTemplate = useDeleteLegalReplyTemplate()

  const saveReplyTemplate = useCallback(
    async (values: ReplyTemplateFormValues, editingTemplate: SettingsReplyTemplate | null) => {
      if (editingTemplate) {
        await updateReplyTemplate.mutateAsync({
          templateId: editingTemplate.id,
          payload: mapReplyTemplateFormToUpdate(values),
        })
        toast.success(
          t(
            'pages.lawyerWorkplace.settings.templates.replyUpdateSuccess',
            'Letter template updated'
          )
        )
        return
      }

      await createReplyTemplate.mutateAsync(mapReplyTemplateFormToCreate(values))
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.replyAddSuccess', 'Letter template added')
      )
    },
    [createReplyTemplate, t, updateReplyTemplate]
  )

  const deleteReplyTemplateAction = useCallback(
    async (template: SettingsReplyTemplate) => {
      await deleteReplyTemplate.mutateAsync(template.id)
      toast.success(
        t('pages.lawyerWorkplace.settings.templates.replyDeleteSuccess', 'Letter template deleted')
      )
    },
    [deleteReplyTemplate, t]
  )

  return {
    saveReplyTemplate,
    deleteReplyTemplate: deleteReplyTemplateAction,
    isSavingReplyTemplate: createReplyTemplate.isPending || updateReplyTemplate.isPending,
    isDeletingReplyTemplate: deleteReplyTemplate.isPending,
  }
}
