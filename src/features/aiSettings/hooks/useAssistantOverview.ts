/**
 * useAssistantOverview — read-only brain config + prompting for the
 * «Устройство ассистента» admin section.
 *
 * Gated by `manage_ai_settings` on top of auth (the query never even fires
 * for a user without the permission — the section is PermissionGuard'd too,
 * but the double gate keeps the network call from firing during a render
 * race). Cached 5 minutes: this is read-only ops visibility, not something
 * that needs to track the brain live. `retry: false` — a 502
 * brain_unreachable would otherwise get hammered by react-query's default
 * retry backoff for no benefit (the brain doesn't come back within a few
 * seconds).
 */
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { assistantOverviewKey, getAssistantOverview } from '../api/assistantOverviewService'

export function useAssistantOverview() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const hasPermission = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS)

  return useQuery({
    queryKey: assistantOverviewKey,
    queryFn: getAssistantOverview,
    enabled: isAuthenticated && hasPermission,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
