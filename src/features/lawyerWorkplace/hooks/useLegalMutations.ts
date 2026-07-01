import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskApi } from '@/features/clients/api/taskApi'
import { getErrorMessage } from '@/lib/errors'
import { legalApi } from '../api/legalApi'
import type {
  LegalLawyerCreate,
  LegalLawyerUpdate,
  LegalLetterTypeCreate,
  LegalLetterTypePrioritiesUpdate,
  LegalLetterTypeUpdate,
  LegalGenerateDocumentRequest,
  LegalMailboxCreate,
  LegalMailboxUpdate,
  LegalDepartmentSyncSettingsUpdate,
  LegalDocumentPresetCreate,
  LegalDocumentPresetUpdate,
  LegalOutgoingLetterRequest,
  LegalReplyTemplateCreate,
  LegalReplyTemplateUpdate,
  LegalThreadReplyRequest,
  LegalTrainingExampleCreate,
  LegalTrainingExampleUpdate,
} from '../api/types'
import { legalWorkplaceKeys } from './useLegalInbox'

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
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyers() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalLawyer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ lawyerId, payload }: { lawyerId: string; payload: LegalLawyerUpdate }) =>
      legalApi.updateLawyer(lawyerId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyers() })
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
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.lawyers() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useReplyToLegalThread() {
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
      if (data.legal_document_number) {
        toast.success(`EDO registered: ${data.legal_document_number}`)
      } else {
        toast.success('Reply sent')
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useSendOutgoingLetter() {
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
      if (data.legal_document_number) {
        toast.success(`EDO registered: ${data.legal_document_number}`)
      } else {
        toast.success('Letter sent')
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalKanbanTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: Record<string, unknown> }) =>
      taskApi.updateTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
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
      payload: { letter_type_id?: string; client_id?: number | null }
    }) => legalApi.patchKanbanTask(taskId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalKanbanTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Parameters<typeof legalApi.createKanbanTask>[0]) =>
      legalApi.createKanbanTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.kanban() })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'my-tasks'] })
      toast.success('Task created')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

function invalidateLegalDocuments(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.documents() })
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
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.replyTemplates() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.composerReplyTemplates() })
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
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.replyTemplates() })
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.composerReplyTemplates() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateLegalDocumentPreset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: LegalDocumentPresetCreate) =>
      legalApi.createSettingsDocumentPreset(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.documentPresets() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateLegalDocumentPreset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ presetId, payload }: { presetId: string; payload: LegalDocumentPresetUpdate }) =>
      legalApi.updateSettingsDocumentPreset(presetId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: legalWorkplaceKeys.documentPresets() })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
