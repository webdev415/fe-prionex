import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { legalRegistryApi } from '../api/registryApi'
import type { IncomingRegistryFilters, OutgoingRegistryFilters } from '../api/registryApi'
import { legalWorkplaceKeys } from './useLegalInbox'

export const legalRegistryKeys = {
  root: () => [...legalWorkplaceKeys.all, 'registry'] as const,
  incoming: (filters: IncomingRegistryFilters) =>
    [...legalRegistryKeys.root(), 'incoming', filters] as const,
  outgoing: (filters: OutgoingRegistryFilters) =>
    [...legalRegistryKeys.root(), 'outgoing', filters] as const,
}

export function useIncomingRegistry(
  filters: IncomingRegistryFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: legalRegistryKeys.incoming(filters),
    queryFn: () => legalRegistryApi.listIncoming(filters),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
    // Reopening the registry tab must always show freshly generated rows,
    // even within the stale window (CEO: rows "appeared not immediately").
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  })
}

export function useOutgoingRegistry(
  filters: OutgoingRegistryFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: legalRegistryKeys.outgoing(filters),
    queryFn: () => legalRegistryApi.listOutgoing(filters),
    enabled: options?.enabled !== false,
    staleTime: 15_000,
    // Reopening the registry tab must always show freshly generated rows,
    // even within the stale window (CEO: rows "appeared not immediately").
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  })
}
