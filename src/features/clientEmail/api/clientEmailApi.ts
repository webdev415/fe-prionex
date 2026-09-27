/**
 * Client e-mail channel — doors of email-service under `/api/v1/email`.
 *
 * Every call goes through the shared CRM client: the caller's JWT is what the
 * server scopes by (active project, rights), so there is nothing to add here.
 * Errors are handed back untouched; `clientEmailFailureText` turns one into the
 * sentence the operator reads where it is shown.
 */
import axios from 'axios'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
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

/**
 * The sentence an operator reads when one of these doors fails.
 *
 * A coded refusal (`{detail, code, params}`) is translated by its code. A failure
 * WITHOUT a code carries text meant for developers, in English: the gateway's
 * `404 Not Found` once the channel is switched off while the card still holds the
 * old answer, the door's own `404 Message not found`, FastAPI's `422`, a `403`
 * naming the permission slug. Those get the sentence for the HTTP status instead —
 * the same `http.*` dictionary and the same code path the rest of the CRM uses,
 * reached by handing `getErrorMessage` the status without the body.
 */
export function clientEmailFailureText(error: unknown): string {
  if (axios.isAxiosError(error) && error.response) {
    const data: unknown = error.response.data
    const code = data && typeof data === 'object' ? (data as { code?: unknown }).code : undefined
    if (typeof code !== 'string' || code === '') {
      return getErrorMessage({
        isAxiosError: true,
        message: '',
        response: { status: error.response.status, data: undefined },
      })
    }
  }
  return getErrorMessage(error)
}
