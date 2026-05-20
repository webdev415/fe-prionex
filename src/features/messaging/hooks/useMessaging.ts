import { useQuery } from '@tanstack/react-query'
import { messagingApi } from '../api/messagingApi'
import type { MessagingChannel } from '../api/types'

export const messagingKeys = {
  all: ['messaging'] as const,
  drafts: () => [...messagingKeys.all, 'drafts'] as const,
  draftList: (channel?: MessagingChannel) => [...messagingKeys.drafts(), { channel }] as const,
  draft: (draftId: number) => [...messagingKeys.drafts(), draftId] as const,
  integrations: () => [...messagingKeys.all, 'integrations'] as const,
  integration: (service: string) => [...messagingKeys.integrations(), service] as const,
  campaigns: () => [...messagingKeys.all, 'campaigns'] as const,
  campaignList: (params?: {
    status?: string
    channel?: MessagingChannel
    limit?: number
    offset?: number
  }) => [...messagingKeys.campaigns(), 'list', params ?? {}] as const,
  campaign: (campaignId: number) => [...messagingKeys.campaigns(), campaignId] as const,
  campaignRecipients: (
    campaignId: number,
    params?: { status?: string; limit?: number; offset?: number }
  ) => [...messagingKeys.campaign(campaignId), 'recipients', params ?? {}] as const,
  clientHistory: (
    clientId: number,
    params?: { channel?: MessagingChannel; limit?: number; offset?: number }
  ) => [...messagingKeys.all, 'clients', clientId, 'history', params ?? {}] as const,
  destinationQuota: (destination: string) =>
    [...messagingKeys.all, 'rate', 'destination', destination] as const,
} as const

export function useMessagingDrafts(channel?: MessagingChannel) {
  return useQuery({
    queryKey: messagingKeys.draftList(channel),
    queryFn: () => messagingApi.listDrafts(channel ? { channel } : undefined),
    staleTime: 30000,
  })
}

export function useMessagingDraft(draftId: number, enabled = true) {
  return useQuery({
    queryKey: messagingKeys.draft(draftId),
    queryFn: () => messagingApi.getDraft(draftId),
    enabled: enabled && draftId > 0,
    staleTime: 30000,
  })
}

export function useMessagingIntegrations(enabled = true) {
  return useQuery({
    queryKey: messagingKeys.integrations(),
    queryFn: () => messagingApi.listIntegrations(),
    enabled,
    staleTime: 30000,
  })
}

export function useMessagingCampaigns(params?: {
  status?: string
  channel?: MessagingChannel
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: messagingKeys.campaignList(params),
    queryFn: () => messagingApi.listCampaigns(params),
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
    refetchInterval: 30000,
  })
}

export function useMessagingCampaign(campaignId: number, enabled = true) {
  return useQuery({
    queryKey: messagingKeys.campaign(campaignId),
    queryFn: () => messagingApi.getCampaign(campaignId),
    enabled: enabled && campaignId > 0,
    staleTime: 10000,
    refetchInterval: 15000,
  })
}

export function useMessagingCampaignRecipients(
  campaignId: number,
  params?: { status?: string; limit?: number; offset?: number },
  enabled = true
) {
  return useQuery({
    queryKey: messagingKeys.campaignRecipients(campaignId, params),
    queryFn: () => messagingApi.listCampaignRecipients(campaignId, params),
    enabled: enabled && campaignId > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
    refetchInterval: 15000,
  })
}

export function useDestinationQuota(destination: string, enabled = true) {
  return useQuery({
    queryKey: messagingKeys.destinationQuota(destination),
    queryFn: () => messagingApi.getDestinationQuota(destination),
    enabled: enabled && destination.trim().length > 0,
    staleTime: 15000,
    refetchInterval: 30000,
  })
}

export function useMessagingClientHistory(
  clientId: number,
  params?: { channel?: MessagingChannel; limit?: number; offset?: number },
  enabled = true
) {
  return useQuery({
    queryKey: messagingKeys.clientHistory(clientId, params),
    queryFn: () => messagingApi.getClientHistory(clientId, params),
    enabled: enabled && clientId > 0,
    staleTime: 10000,
  })
}
