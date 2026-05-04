import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/features/auth/api/authApi'
import type {
  TwoFactorEnableRequest,
  TwoFactorDisableRequest,
  TwoFactorRegenerateRequest,
} from '@/types/api'

export const TWO_FACTOR_QUERY_KEY = ['auth', 'two-factor', 'status'] as const

export function useTwoFactorStatus(enabled = true) {
  return useQuery({
    queryKey: TWO_FACTOR_QUERY_KEY,
    queryFn: async () => (await authApi.twoFactor.status()).data,
    enabled,
    staleTime: 30_000,
  })
}

export function useTwoFactorSetup() {
  return useMutation({
    mutationFn: async () => (await authApi.twoFactor.setup()).data,
  })
}

export function useTwoFactorEnable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: TwoFactorEnableRequest) => (await authApi.twoFactor.enable(data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TWO_FACTOR_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useTwoFactorDisable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: TwoFactorDisableRequest) =>
      (await authApi.twoFactor.disable(data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TWO_FACTOR_QUERY_KEY })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

export function useTwoFactorRegenerateBackupCodes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: TwoFactorRegenerateRequest) =>
      (await authApi.twoFactor.regenerateBackupCodes(data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TWO_FACTOR_QUERY_KEY })
    },
  })
}
