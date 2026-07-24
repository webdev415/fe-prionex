import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { taskApi } from '@/features/clients/api/taskApi'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type {
  LegalLawyerCreate,
  LegalLawyerListResponse,
  LegalLawyerUpdate,
  LegalLetterTypeCreate,
  LegalLetterTypePrioritiesUpdate,
  LegalLetterTypeUpdate,
  LegalGenerateDocumentRequest,
  LegalMailboxCreate,
  LegalMailboxConnectionTest,
  LegalMailboxUpdate,
  LegalDepartmentSyncSettingsUpdate,
  LegalOutgoingLetterRequest,
  LegalReplyTemplateCreate,
  LegalReplyTemplateUpdate,
  LegalThreadReplyRequest,
  LegalTrainingExampleCreate,
  LegalTrainingExampleUpdate,
} from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

function invalidateLegalDocuments(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.documents() })
}

function invalidateLegalWorkload(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
}

export function useCreateLegalLetterType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalLetterTypeCreate) => legalApi.createLetterType(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalLetterType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      letterTypeId,
      payload,
    }: {
      letterTypeId: string
      payload: LegalLetterTypeUpdate
    }) => legalApi.updateLetterType(letterTypeId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.letterType(variables.letterTypeId),
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useArchiveLegalLetterType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (letterTypeId: string) => legalApi.archiveLetterType(letterTypeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useReplaceLegalLetterTypePriorities() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      letterTypeId,
      payload,
    }: {
      letterTypeId: string
      payload: LegalLetterTypePrioritiesUpdate
    }) => legalApi.replaceLetterTypePriorities(letterTypeId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.letterType(variables.letterTypeId),
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalTrainingExample() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      letterTypeId,
      payload,
    }: {
      letterTypeId: string
      payload: LegalTrainingExampleCreate
    }) => legalApi.createTrainingExample(letterTypeId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.trainingExamples(variables.letterTypeId),
      })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.letterType(variables.letterTypeId),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalTrainingExample() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      letterTypeId,
      exampleId,
      payload,
    }: {
      letterTypeId: string
      exampleId: string
      payload: LegalTrainingExampleUpdate
    }) => legalApi.updateTrainingExample(letterTypeId, exampleId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.trainingExamples(variables.letterTypeId),
      })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.letterType(variables.letterTypeId),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteLegalTrainingExample() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ letterTypeId, exampleId }: { letterTypeId: string; exampleId: string }) =>
      legalApi.deleteTrainingExample(letterTypeId, exampleId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.trainingExamples(variables.letterTypeId),
      })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.letterType(variables.letterTypeId),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.letterTypes() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalLawyer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalLawyerCreate) => legalApi.createLawyer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalLawyer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ lawyerId, payload }: { lawyerId: string; payload: LegalLawyerUpdate }) =>
      legalApi.updateLawyer(lawyerId, payload),
    onSuccess: (data, variables) => {
      queryClient.setQueriesData<LegalLawyerListResponse>(
        { queryKey: legalWorkplaceKeys.lawyersRoot() },
        (current) => {
          if (!current?.items) return current
          return {
            ...current,
            items: current.items.map((lawyer) =>
              lawyer.id === variables.lawyerId ? data : lawyer
            ),
          }
        }
      )
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.lawyer(variables.lawyerId),
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useArchiveLegalLawyer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (lawyerId: string) => legalApi.archiveLawyer(lawyerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyersRoot() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useReplyToLegalThread() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ threadId, payload }: { threadId: string; payload: LegalThreadReplyRequest }) =>
      legalApi.replyToThread(threadId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.threads() })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.message(data.message_id),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      if (data.legal_document_id || data.legal_document_number) {
        invalidateLegalDocuments(queryClient)
      }
      if (data.legal_document_number) {
        toast.success(
          t('pages.lawyerWorkplace.mutations.edoRegistered', 'EDO registered: {{number}}', {
            number: data.legal_document_number,
          })
        )
      } else {
        toast.success(t('pages.lawyerWorkplace.mutations.replySent', 'Reply sent'))
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useSendOutgoingLetter() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalOutgoingLetterRequest) => legalApi.sendOutgoingLetter(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.threads() })
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.message(data.message_id),
      })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      if (data.legal_document_id || data.legal_document_number) {
        invalidateLegalDocuments(queryClient)
      }
      if (data.legal_document_number) {
        toast.success(
          t('pages.lawyerWorkplace.mutations.edoRegistered', 'EDO registered: {{number}}', {
            number: data.legal_document_number,
          })
        )
      } else {
        toast.success(t('pages.lawyerWorkplace.mutations.letterSent', 'Letter sent'))
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalKanbanTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      taskId,
      payload,
    }: {
      taskId: number
      payload: Record<string, unknown>
    }) => {
      await taskApi.updateTask(taskId, payload)
      const status = typeof payload.status === 'string' ? payload.status : undefined
      if (status) {
        await legalApi.syncKanbanTaskStatus(taskId, { status })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      invalidateLegalWorkload(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function usePatchLegalKanbanTaskMetadata() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: number
      payload: {
        letter_type_id?: string
        client_id?: number | null
        assigned_to_user_id?: number | null
        due_date?: string | null
      }
    }) => legalApi.patchKanbanTask(taskId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      if ('assigned_to_user_id' in variables.payload) {
        invalidateLegalWorkload(queryClient)
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useTransitionLegalKanbanTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      taskId,
      targetColumn,
      timezone,
    }: {
      taskId: number
      targetColumn: 'not_defined' | 'in_progress' | 'overdue' | 'completed'
      timezone?: string
    }) => legalApi.transitionKanbanTask(taskId, { target_column: targetColumn, timezone }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.messages() })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      invalidateLegalWorkload(queryClient)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalKanbanTask() {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Parameters<typeof legalApi.createKanbanTask>[0]) =>
      legalApi.createKanbanTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.threads() })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      invalidateLegalWorkload(queryClient)
      toast.success(t('pages.lawyerWorkplace.mutations.taskCreated', 'Task created'))
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUploadIncomingLegalDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      file: File
      title: string
      client_id: number
      assigned_to_user_id?: number
      contract_number?: string | null
      related_letter_number?: string | null
      sender_email?: string | null
      summary?: string | null
    }) => legalApi.uploadIncomingDocument(payload),
    onSuccess: () => invalidateLegalDocuments(queryClient),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useGenerateLegalDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalGenerateDocumentRequest) => legalApi.generateDocument(payload),
    onSuccess: () => invalidateLegalDocuments(queryClient),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalSettingsMailbox() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalMailboxCreate) => legalApi.createSettingsMailbox(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.settingsMailboxes() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.mailboxes() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalSettingsMailbox() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ mailboxId, payload }: { mailboxId: string; payload: LegalMailboxUpdate }) =>
      legalApi.updateSettingsMailbox(mailboxId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.settingsMailboxes() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.mailboxes() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useTestLegalSettingsMailboxConnection() {
  return useMutation({
    mutationFn: (payload: LegalMailboxConnectionTest) =>
      legalApi.testSettingsMailboxConnection(payload),
  })
}

export function useUpdateLegalSyncSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalDepartmentSyncSettingsUpdate) =>
      legalApi.updateSyncSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.syncSettings() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function usePollAllLegalMailboxes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => legalApi.pollAllSettingsMailboxes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.settingsMailboxes() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.syncSettings() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.inbox() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalReplyTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalReplyTemplateCreate) =>
      legalApi.createSettingsReplyTemplate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.replyTemplatesRoot() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.composerReplyTemplatesRoot() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalReplyTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      templateId,
      payload,
    }: {
      templateId: string
      payload: LegalReplyTemplateUpdate
    }) => legalApi.updateSettingsReplyTemplate(templateId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.replyTemplatesRoot() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.composerReplyTemplatesRoot() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteLegalReplyTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => legalApi.deleteSettingsReplyTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.replyTemplatesRoot() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.composerReplyTemplatesRoot() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
