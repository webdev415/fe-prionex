import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import i18n from '@/lib/i18n'
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
import { messagingKeys, useCanReadMessagingDrafts } from './useMessaging'

const messagingToast = (
  key: string,
  defaultValue: string,
  interpolation?: Record<string, string | number>
) => i18n.t(key, { ns: 'common', defaultValue, ...interpolation })

export function useCreateMessagingDraft() {
  const queryClient = useQueryClient()
  const canReadDrafts = useCanReadMessagingDrafts()

  return useMutation({
    mutationFn: (payload: MessagingDraftCreate) => messagingApi.createDraft(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.drafts() })
      toast.success(
        canReadDrafts
          ? messagingToast('pages.messagingDrafts.toasts.created', 'Draft created successfully')
          : messagingToast(
              'pages.messagingDrafts.createdOutOfSight',
              'Draft saved. It will not appear in the list below, which needs a messaging send or launch permission.'
            )
      )
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
      toast.success(
        messagingToast('pages.messagingDrafts.toasts.updated', 'Draft updated successfully')
      )
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
      toast.success(
        messagingToast('pages.messagingDrafts.toasts.deleted', 'Draft deleted successfully')
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useRestoreMessagingDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (draftId: number) => messagingApi.restoreDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.drafts() })
      toast.success(
        messagingToast('pages.messagingDrafts.toasts.restored', 'Draft restored successfully')
      )
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
      toast.success(
        messagingToast('pages.messagingIntegrations.toasts.saved', 'Integration saved successfully')
      )
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
      toast.success(
        messagingToast(
          'pages.messagingIntegrations.toasts.updated',
          'Integration updated successfully'
        )
      )
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
      toast.success(
        messagingToast(
          'pages.messagingIntegrations.toasts.deleted',
          'Integration deleted successfully'
        )
      )
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
      toast.success(
        messagingToast(
          'pages.messagingIntegrations.toasts.testCompleted',
          'Integration test completed'
        )
      )
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
      toast.success(messagingToast('toasts.messaging.channelsUpdated', 'Enabled channels updated'))
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
      toast.success(
        messagingToast(
          'pages.clients.modals.bulkSendMessage.campaignLaunched',
          'Campaign {{code}} launched',
          {
            code: result.code,
          }
        )
      )
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
      toast.success(
        messagingToast(
          'pages.clients.modals.sendMessage.toastQueued',
          'Message queued successfully'
        )
      )
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
