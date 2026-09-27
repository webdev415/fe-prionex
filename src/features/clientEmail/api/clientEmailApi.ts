/**
 * Client e-mail channel — doors of email-service under `/api/v1/email`.
 *
 * Every call goes through the shared CRM client: the caller's JWT is what the
 * server scopes by (active project, rights), so there is nothing to add here.
 * Errors are handed back untouched — the coded refusals (`{detail, code,
 * params}`) are translated where they are shown.
 */
import axios from 'axios'
import api from '@/lib/api'
import {
  CLIENT_EMAIL_DISABLED,
  type ClientEmailCapabilities,
  type ClientEmailListParams,
  type ClientEmailMessageDetail,
  type ClientEmailMessageList,
  type SendClientEmailRequest,
  type SendClientEmailResponse,
} from './types'

const BASE_URL = '/api/v1/email'

function clientMessagesUrl(clientId: number): string {
  return `${BASE_URL}/clients/${clientId}/messages`
}

/**
 * Is the channel on for the active project, and what may the caller do.
 *
 * `404` means an api build without the channel (or no gateway route yet) — it is
 * the same answer as «off», not an error to show: the card just has no «Пошта».
 * Any other failure is thrown, and the card keeps the sub-tab hidden as well.
 */
export async function getCapabilities(): Promise<ClientEmailCapabilities> {
  try {
    const response = await api.get<ClientEmailCapabilities>(`${BASE_URL}/capabilities`)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { ...CLIENT_EMAIL_DISABLED }
    }
    throw error
  }
}

export async function listClientMessages(
  clientId: number,
  params?: ClientEmailListParams
): Promise<ClientEmailMessageList> {
  const response = await api.get<ClientEmailMessageList>(clientMessagesUrl(clientId), { params })
  return response.data
}

export async function getClientMessage(
  clientId: number,
  messageId: string
): Promise<ClientEmailMessageDetail> {
  const response = await api.get<ClientEmailMessageDetail>(
    `${clientMessagesUrl(clientId)}/${encodeURIComponent(messageId)}`
  )
  return response.data
}

export async function sendClientMessage(
  clientId: number,
  request: SendClientEmailRequest
): Promise<SendClientEmailResponse> {
  const response = await api.post<SendClientEmailResponse>(clientMessagesUrl(clientId), request)
  return response.data
}

export const clientEmailApi = {
  getCapabilities,
  listClientMessages,
  getClientMessage,
  sendClientMessage,
}
