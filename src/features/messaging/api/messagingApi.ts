import api from '@/lib/api'
import type {
  MessagingCampaignCreate,
  MessagingCampaignDetail,
  MessagingCampaignRecipient,
  MessagingCampaignListResponse,
  MessagingCsvParseResponse,
  MessagingChannel,
  MessagingClientHistoryItem,
  MessagingDestinationQuota,
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

import { readInitiatedByUserId } from '../utils/launcherNames'

const BASE_URL = '/api/v1/messaging'

function normalizeClientHistoryItem(raw: MessagingClientHistoryItem): MessagingClientHistoryItem {
  const initiated_by = readInitiatedByUserId(raw)
  return initiated_by != null ? { ...raw, initiated_by } : raw
}

async function enrichClientHistoryLaunchers(
  history: MessagingClientHistoryItem[]
): Promise<MessagingClientHistoryItem[]> {
  const normalized = history.map(normalizeClientHistoryItem)
  const campaignIdsNeedingLauncher = [
    ...new Set(
      normalized
        .filter((item) => readInitiatedByUserId(item) == null)
        .map((item) => item.campaign_id)
    ),
  ]
  if (campaignIdsNeedingLauncher.length === 0) return normalized

  const launcherByCampaignId = new Map<number, number>()
  await Promise.all(
    campaignIdsNeedingLauncher.map(async (campaignId) => {
      try {
        const campaign = await api
          .get<MessagingCampaignDetail>(`${BASE_URL}/campaigns/${campaignId}`)
          .then((response) => response.data)
        const initiatedBy = readInitiatedByUserId(campaign)
        if (initiatedBy != null) launcherByCampaignId.set(campaignId, initiatedBy)
      } catch {
        // Keep history usable when a campaign was removed or the caller lacks access.
      }
    })
  )

  return normalized.map((item) => {
    const initiated_by = readInitiatedByUserId(item) ?? launcherByCampaignId.get(item.campaign_id)
    return initiated_by != null ? { ...item, initiated_by } : item
  })
}

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
    launched_from?: string
    launched_to?: string
    initiated_by?: number
    search?: string
    limit?: number
    offset?: number
    tz?: string
  }) {
    return api
      .get<MessagingCampaignListResponse>(`${BASE_URL}/campaigns`, { params })
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

  uploadViberImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<{ url: string; stored_name: string }>(`${BASE_URL}/viber/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data)
  },

  deleteViberImage(storedName: string) {
    return api.delete(`${BASE_URL}/viber/images/${encodeURIComponent(storedName)}`)
  },

  parseCampaignCsv(channel: MessagingChannel, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<MessagingCsvParseResponse>(`${BASE_URL}/campaigns/recipients/parse-csv`, formData, {
        params: { channel },
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data)
  },

  async downloadCampaignCsvTemplate(channel: MessagingChannel): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/campaigns/recipients/csv-template`, {
      params: { channel },
      responseType: 'blob',
    })
    return response.data as Blob
  },

  async exportCampaign(campaignId: number): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/campaigns/${campaignId}/export`, {
      responseType: 'blob',
    })
    return response.data as Blob
  },

  getDestinationQuota(destination: string) {
    return api
      .get<MessagingDestinationQuota>(`${BASE_URL}/rate/destination`, {
        params: { destination },
      })
      .then((response) => response.data)
  },

  sendSingle(payload: MessagingSingleSendRequest) {
    return api
      .post<MessagingSingleSendResponse>(`${BASE_URL}/send`, payload)
      .then((response) => response.data)
  },

  async getClientHistory(
    clientId: number,
    params?: { channel?: MessagingChannel; limit?: number; offset?: number }
  ) {
    const history = await api
      .get<MessagingClientHistoryItem[]>(`${BASE_URL}/clients/${clientId}/history`, { params })
      .then((response) => response.data)
    return enrichClientHistoryLaunchers(history)
  },

  async exportClientHistory(
    clientId: number,
    params?: { channel?: MessagingChannel }
  ): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/clients/${clientId}/history/export`, {
      params,
      responseType: 'blob',
    })
    return response.data as Blob
  },
}
