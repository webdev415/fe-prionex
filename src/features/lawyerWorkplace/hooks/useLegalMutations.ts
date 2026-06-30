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
  LegalOutgoingLetterRequest,
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
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.thread(data.thread_id),
      })
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
      queryClient.invalidateQueries({
        queryKey: legalWorkplaceKeys.thread(data.thread_id),
      })
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
