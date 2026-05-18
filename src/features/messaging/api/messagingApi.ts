import api from '@/lib/api'
import type {
  MessagingCampaignCreate,
  MessagingCampaignDetail,
  MessagingCampaignRecipient,
  MessagingCampaignSummary,
  MessagingChannel,
  MessagingClientHistoryItem,
  MessagingDraft,
  MessagingDraftCreate,
  MessagingDraftPreviewResponse,
  MessagingDraftUpdate,
  MessagingIntegration,
  MessagingIntegrationCreate,
  MessagingIntegrationCredentialsReveal,
  MessagingIntegrationTestResult,
  MessagingIntegrationUpdate,
  MessagingRecipientPreview,
  MessagingSelectionPayload,
  MessagingSingleSendRequest,
  MessagingSingleSendResponse,
} from './types'

const BASE_URL = '/api/v1/messaging'

export const messagingApi = {
  listDrafts(params?: { channel?: MessagingChannel }) {
    return api
      .get<MessagingDraft[]>(`${BASE_URL}/drafts`, { params })
      .then((response) => response.data)
  },

  getDraft(draftId: number) {
    return api
      .get<MessagingDraft>(`${BASE_URL}/drafts/${draftId}`)
      .then((response) => response.data)
  },

  createDraft(payload: MessagingDraftCreate) {
    return api.post<MessagingDraft>(`${BASE_URL}/drafts`, payload).then((response) => response.data)
  },

  updateDraft(draftId: number, payload: MessagingDraftUpdate) {
    return api
      .put<MessagingDraft>(`${BASE_URL}/drafts/${draftId}`, payload)
      .then((response) => response.data)
  },

  deleteDraft(draftId: number) {
    return api.delete(`${BASE_URL}/drafts/${draftId}`).then(() => undefined)
  },

  previewDraft(draftId: number, variables: Record<string, unknown>, strict = false) {
    return api
      .post<MessagingDraftPreviewResponse>(`${BASE_URL}/drafts/${draftId}/preview`, {
        variables,
        strict,
      })
      .then((response) => response.data)
  },

  listIntegrations() {
    return api
      .get<MessagingIntegration[]>(`${BASE_URL}/integrations`)
      .then((response) => response.data)
  },

  getIntegration(service: string) {
    return api
      .get<MessagingIntegration>(`${BASE_URL}/integrations/${service}`)
      .then((response) => response.data)
  },

  createIntegration(payload: MessagingIntegrationCreate) {
    return api
      .post<MessagingIntegration>(`${BASE_URL}/integrations`, payload)
      .then((response) => response.data)
  },

  updateIntegration(service: string, payload: MessagingIntegrationUpdate) {
    return api
      .put<MessagingIntegration>(`${BASE_URL}/integrations/${service}`, payload)
      .then((response) => response.data)
  },

  deleteIntegration(service: string) {
    return api.delete(`${BASE_URL}/integrations/${service}`).then(() => undefined)
  },

  testIntegration(service: string) {
    return api
      .post<MessagingIntegrationTestResult>(`${BASE_URL}/integrations/${service}/test`)
      .then((response) => response.data)
  },

  revealIntegrationCredentials(service: string) {
    return api
      .post<MessagingIntegrationCredentialsReveal>(
        `${BASE_URL}/integrations/${service}/reveal-credentials`
      )
      .then((response) => response.data)
  },

  setIntegrationEnabledChannels(service: string, enabledChannels: MessagingChannel[]) {
    return api
      .patch<MessagingIntegration>(`${BASE_URL}/integrations/${service}/enabled-channels`, {
        enabled_channels: enabledChannels,
      })
      .then((response) => response.data)
  },

  previewRecipients(channel: MessagingChannel, selectionPayload: MessagingSelectionPayload) {
    return api
      .post<MessagingRecipientPreview>(`${BASE_URL}/campaigns/recipients/preview`, {
        channel,
        selection_payload: selectionPayload,
      })
      .then((response) => response.data)
  },

  listCampaigns(params?: {
    status?: string
    channel?: MessagingChannel
    limit?: number
    offset?: number
  }) {
    return api
      .get<MessagingCampaignSummary[]>(`${BASE_URL}/campaigns`, { params })
      .then((response) => response.data)
  },

  getCampaign(campaignId: number) {
    return api
      .get<MessagingCampaignDetail>(`${BASE_URL}/campaigns/${campaignId}`)
      .then((response) => response.data)
  },

  listCampaignRecipients(
    campaignId: number,
    params?: { status?: string; limit?: number; offset?: number }
  ) {
    return api
      .get<
        MessagingCampaignRecipient[]
      >(`${BASE_URL}/campaigns/${campaignId}/recipients`, { params })
      .then((response) => response.data)
  },

  createCampaign(payload: MessagingCampaignCreate) {
    return api
      .post<MessagingCampaignDetail>(`${BASE_URL}/campaigns`, payload)
      .then((response) => response.data)
  },

  cancelCampaign(campaignId: number) {
    return api
      .post<MessagingCampaignSummary>(`${BASE_URL}/campaigns/${campaignId}/cancel`)
      .then((response) => response.data)
  },

  getCampaignExportUrl(campaignId: number) {
    return `${api.defaults.baseURL}${BASE_URL}/campaigns/${campaignId}/export`
  },

  sendSingle(payload: MessagingSingleSendRequest) {
    return api
      .post<MessagingSingleSendResponse>(`${BASE_URL}/send`, payload)
      .then((response) => response.data)
  },

  getClientHistory(
    clientId: number,
    params?: { channel?: MessagingChannel; limit?: number; offset?: number }
  ) {
    return api
      .get<MessagingClientHistoryItem[]>(`${BASE_URL}/clients/${clientId}/history`, { params })
      .then((response) => response.data)
  },
}
