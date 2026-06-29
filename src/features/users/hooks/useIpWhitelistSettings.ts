/**
 * useIpWhitelistSettings Hooks
 *
 * React Query hooks for the global IP-whitelist enforcement flag:
 *   GET /api/v1/admin/settings/ip-whitelist
 *   PUT /api/v1/admin/settings/ip-whitelist
 *
 * The flag ships disabled by default. While disabled, the per-user
 * whitelist is dormant — admins can still stage entries; nothing is
 * enforced at the login gate until the flag is turned on.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../api/usersApi'
import type { UpdateIpWhitelistSettingsInput } from '../types'

export const ipWhitelistSettingsKey = ['ipWhitelistSettings'] as const

export function useIpWhitelistSettings() {
  return useQuery({
    queryKey: ipWhitelistSettingsKey,
    queryFn: () => usersApi.getIpWhitelistSettings(),
  })
}

export function useUpdateIpWhitelistSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateIpWhitelistSettingsInput) =>
      usersApi.updateIpWhitelistSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(ipWhitelistSettingsKey, data)
    },
  })
}
