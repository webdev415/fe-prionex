import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'
import { useAuthStore } from '@/stores/authStore'
import { clientEmailApi } from '../api/clientEmailApi'
import type {
  ClientEmailCapabilities,
  ClientEmailListParams,
  SendClientEmailRequest,
} from '../api/types'

export const clientEmailKeys = {
  all: ['clientEmail'] as const,
  /** Per active project: the answer depends on the project of the token. */
  capabilities: (projectId: string | null) =>
    [...clientEmailKeys.all, 'capabilities', projectId] as const,
  /** Prefix of everything about one client — sending invalidates it whole. */
  client: (clientId: number) => [...clientEmailKeys.all, 'clients', clientId] as const,
  messages: (clientId: number, params?: ClientEmailListParams) =>
    [...clientEmailKeys.client(clientId), 'messages', params ?? {}] as const,
  message: (clientId: number, messageId: string) =>
    [...clientEmailKeys.client(clientId), 'message', messageId] as const,
}

/** The server's answer about the channel, fetched only while `enabled`. */
export function useClientEmailCapabilities(enabled = true) {
  const projectId = useAuthStore((s) => s.user?.active_project_id ?? null)
  return useQuery({
    queryKey: clientEmailKeys.capabilities(projectId),
    queryFn: () => clientEmailApi.getCapabilities(),
    enabled,
    staleTime: 60_000,
  })
}

export interface ClientEmailTab {
  /** Draw the «Пошта» sub-tab at all. */
  visible: boolean
  capabilities: ClientEmailCapabilities | undefined
}

/**
 * Whether the client card shows «Пошта».
 *
 * Three answers are required: the caller's right to read client e-mail, the
 * server saying the channel is on, AND the server saying the caller may read.
 * The right alone would show a tab on an api whose channel is off (or on an older
 * api that does not have it at all); the server alone would show correspondence
 * to someone without the right.
 *
 * Why the local right is not enough on its own: it comes from `/me`, which reads
 * the role in the database and is refreshed every few minutes, while the
 * email-service door checks the claims of the TOKEN, which live until the next
 * sign-in. A right granted in the middle of the day would open the tab minutes
 * later and every read would answer 403 for hours. `can_read` is the door's own
 * view of the same token.
 *
 * `active` is the lazy gate of the card (the call/SMS tab is open): nobody pays
 * for the question until it matters, and a caller without the right never asks.
 */
export function useClientEmailTab(active: boolean): ClientEmailTab {
  const canRead = useHasPermission(PERMISSIONS.EMAIL.CLIENT_READ)
  const { data } = useClientEmailCapabilities(active && canRead)
  return {
    visible: canRead && data?.enabled === true && data?.can_read === true,
    capabilities: data,
  }
}

export function useClientEmailMessages(
  clientId: number,
  params?: ClientEmailListParams,
  enabled = true
) {
  return useQuery({
    queryKey: clientEmailKeys.messages(clientId, params),
    queryFn: () => clientEmailApi.listClientMessages(clientId, params),
    enabled: enabled && clientId > 0,
    staleTime: 10_000,
  })
}

export function useClientEmailMessage(clientId: number, messageId: string | null) {
  return useQuery({
    queryKey: clientEmailKeys.message(clientId, messageId ?? ''),
    queryFn: () => clientEmailApi.getClientMessage(clientId, messageId as string),
    enabled: clientId > 0 && !!messageId,
  })
}

/**
 * Send a letter from the project mailbox to the client.
 *
 * No retry: the door has no idempotency key, and a second attempt after a lost
 * answer can deliver the same letter twice.
 */
export function useSendClientEmail(clientId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: SendClientEmailRequest) =>
      clientEmailApi.sendClientMessage(clientId, request),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientEmailKeys.client(clientId) })
    },
  })
}
