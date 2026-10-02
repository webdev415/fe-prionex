/**
 * useHubRoles Hook
 *
 * The HUB catalogue of one project (KAN-1476; chat values board #1621),
 * reduced to what its callers ask: can the HUB chat role be offered and with
 * which options (`hubRoleCatalogView`), and which chat templates, screens and
 * dialogue values the role form may offer (`chat`, see `chatCatalogView`).
 */

import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'
import { rolesKeys } from './useRoles'
import { hubRoleCatalogView, type HubRoleCatalogView } from '../hubRoles'
import { chatCatalogView, type ChatCatalogView } from '../chatRoleSet'

export function useHubRoles(
  projectId: number | undefined
): HubRoleCatalogView & { chat: ChatCatalogView } {
  const enabled = projectId !== undefined && projectId > 0
  const query = useQuery({
    queryKey: rolesKeys.hubRoles(projectId ?? 0),
    queryFn: () => rolesApi.getHubRoles(projectId as number),
    enabled,
    // A refusal (feature off, no right in this project) does not heal on a
    // retry, and a slow retry would only keep the field hidden for longer.
    retry: false,
    staleTime: 60_000,
  })
  const answer = { isPending: query.isPending, isError: query.isError, data: query.data }
  return {
    ...hubRoleCatalogView(answer),
    chat: chatCatalogView({ ...answer, enabled, error: query.error }),
  }
}
