/**
 * useHubRoles Hook
 *
 * The HUB chat-role catalogue of one project (KAN-1476), reduced to the one
 * question every caller asks: can the choice be offered right now, and with
 * which options. See `hubRoleCatalogView` for how a response is read.
 */

import { useQuery } from '@tanstack/react-query'
import { rolesApi } from '../api/rolesApi'
import { rolesKeys } from './useRoles'
import { hubRoleCatalogView, type HubRoleCatalogView } from '../hubRoles'

export function useHubRoles(projectId: number | undefined): HubRoleCatalogView {
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
  return hubRoleCatalogView({
    isPending: query.isPending,
    isError: query.isError,
    data: query.data,
  })
}
