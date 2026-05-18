import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { clientKeys } from '@/features/clients/hooks/useClients'
import { messagingApi } from '../api/messagingApi'
import type {
  MessagingCampaignCreate,
  MessagingChannel,
  MessagingDraftCreate,
  MessagingDraftUpdate,
  MessagingIntegrationCreate,
  MessagingIntegrationUpdate,
  MessagingSelectionPayload,
  MessagingSingleSendRequest,
} from '../api/types'
import { messagingKeys } from './useMessaging'

export function useCreateMessagingDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MessagingDraftCreate) => messagingApi.createDraft(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.drafts() })
      toast.success('Draft created successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateMessagingDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ draftId, payload }: { draftId: number; payload: MessagingDraftUpdate }) =>
      messagingApi.updateDraft(draftId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.drafts() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.draft(variables.draftId) })
      toast.success('Draft updated successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteMessagingDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draftId: number) => messagingApi.deleteDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.drafts() })
      toast.success('Draft deleted successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function usePreviewMessagingDraft() {
  return useMutation({
    mutationFn: ({
      draftId,
      variables,
      strict,
    }: {
      draftId: number
      variables: Record<string, unknown>
      strict?: boolean
    }) => messagingApi.previewDraft(draftId, variables, strict),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateMessagingIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MessagingIntegrationCreate) => messagingApi.createIntegration(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.integrations() })
      toast.success('Integration saved successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateMessagingIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ service, payload }: { service: string; payload: MessagingIntegrationUpdate }) =>
      messagingApi.updateIntegration(service, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.integrations() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.integration(variables.service) })
      toast.success('Integration updated successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteMessagingIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (service: string) => messagingApi.deleteIntegration(service),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.integrations() })
      toast.success('Integration deleted successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useTestMessagingIntegration() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (service: string) => messagingApi.testIntegration(service),
    onSuccess: (_, service) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.integrations() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.integration(service) })
      toast.success('Integration test completed')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useRevealMessagingIntegrationCredentials() {
  return useMutation({
    mutationFn: (service: string) => messagingApi.revealIntegrationCredentials(service),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useSetMessagingIntegrationChannels() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      service,
      enabledChannels,
    }: {
      service: string
      enabledChannels: MessagingChannel[]
    }) => messagingApi.setIntegrationEnabledChannels(service, enabledChannels),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.integrations() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.integration(variables.service) })
      toast.success('Enabled channels updated')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function usePreviewMessagingRecipients() {
  return useMutation({
    mutationFn: ({
      channel,
      selectionPayload,
    }: {
      channel: MessagingChannel
      selectionPayload: MessagingSelectionPayload
    }) => messagingApi.previewRecipients(channel, selectionPayload),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCreateMessagingCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MessagingCampaignCreate) => messagingApi.createCampaign(payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.campaigns() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.campaign(result.id) })
      toast.success(`Campaign ${result.code} launched`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useCancelMessagingCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (campaignId: number) => messagingApi.cancelCampaign(campaignId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.campaigns() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.campaign(result.id) })
      queryClient.invalidateQueries({ queryKey: messagingKeys.campaignRecipients(result.id) })
      toast.success(`Campaign ${result.code} cancelled`)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: MessagingSingleSendRequest) => messagingApi.sendSingle(payload),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.campaigns() })
      queryClient.invalidateQueries({ queryKey: messagingKeys.clientHistory(variables.client_id) })
      queryClient.invalidateQueries({ queryKey: clientKeys.callSmsHistory(variables.client_id) })
      toast.success('Message queued successfully')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
