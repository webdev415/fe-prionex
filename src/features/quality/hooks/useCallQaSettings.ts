/**
 * useCallQaSettings — the global Call QA («AI call analysis») switch.
 *
 * The GET is auth-gated (nothing fires on the login screen) and cached for
 * 60s: every opened call modal mounts this hook, and an admin flip becoming
 * visible within a minute is fine for a kill-switch.
 *
 * The mutation seeds the cache with the PUT response and invalidates cached
 * transcript queries — they belong to the previous switch state (including
 * memoised 403 call_qa_disabled errors).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import {
  callQaSettingsKey,
  getCallQaSettings,
  updateCallQaSettings,
  type CallQaSettings,
} from '../api/callQaSettingsService'
import { transcriptKeys } from '../api/transcriptService'

export function useCallQaSettings() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return useQuery({
    queryKey: callQaSettingsKey,
    queryFn: getCallQaSettings,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })
}

export function useUpdateCallQaSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CallQaSettings) => updateCallQaSettings(input),
    onSuccess: (data) => {
      queryClient.setQueryData(callQaSettingsKey, data)
      void queryClient.invalidateQueries({ queryKey: transcriptKeys.all })
    },
  })
}
