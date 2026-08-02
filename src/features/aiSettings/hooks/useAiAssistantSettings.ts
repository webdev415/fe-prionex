/**
 * useAiAssistantSettings — the global assistant kill-switch.
 *
 * Auth-gated GET cached for 60s (the header button mounts this hook on
 * every dashboard page; an admin flip becoming visible within a minute
 * is fine for a kill-switch). The mutation seeds the cache with the PUT
 * response.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import {
  aiAssistantSettingsKey,
  getAiAssistantSettings,
  updateAiAssistantSettings,
  type AiAssistantSettings,
} from '../api/aiAssistantSettingsService'

export function useAiAssistantSettings() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return useQuery({
    queryKey: aiAssistantSettingsKey,
    queryFn: getAiAssistantSettings,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })
}

export function useUpdateAiAssistantSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AiAssistantSettings) => updateAiAssistantSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(aiAssistantSettingsKey, data)
    },
  })
}
