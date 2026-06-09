import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  awardBadgeManually,
  getLeaderboard,
  getOperatorBadges,
  listBadgeDefinitions,
  type GetLeaderboardParams,
} from '../api/leaderboardService'
import type { ManualBadgeAwardPayload } from '../types/leaderboard'

export const leaderboardKeys = {
  all: ['training', 'leaderboard'] as const,
  snapshot: (params: GetLeaderboardParams) =>
    [...leaderboardKeys.all, 'snapshot', params] as const,
  badgeDefinitions: () => [...leaderboardKeys.all, 'badge-defs'] as const,
  operatorBadges: (operatorId: number) =>
    [...leaderboardKeys.all, 'operator-badges', operatorId] as const,
}

export function useLeaderboard(
  params: GetLeaderboardParams = {},
  enabled = true
) {
  return useQuery({
    queryKey: leaderboardKeys.snapshot(params),
    queryFn: () => getLeaderboard(params),
    enabled,
    // Snapshots are immutable within the day; refetch on remount only.
    staleTime: 5 * 60_000,
  })
}

export function useBadgeDefinitions(enabled = true) {
  return useQuery({
    queryKey: leaderboardKeys.badgeDefinitions(),
    queryFn: () => listBadgeDefinitions(),
    enabled,
    staleTime: 10 * 60_000,
  })
}

export function useOperatorBadges(operatorId: number | null, enabled = true) {
  return useQuery({
    queryKey: leaderboardKeys.operatorBadges(operatorId ?? 0),
    queryFn: () => getOperatorBadges(operatorId as number),
    enabled: enabled && operatorId != null,
    staleTime: 60_000,
  })
}

export function useAwardBadgeManually() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ManualBadgeAwardPayload) => awardBadgeManually(payload),
    onSuccess: (badge) => {
      queryClient.invalidateQueries({
        queryKey: leaderboardKeys.operatorBadges(badge.operator_id),
      })
      // Daily ranking doesn't change from a manual award, but the
      // badges gallery on the leaderboard view does.
      queryClient.invalidateQueries({ queryKey: leaderboardKeys.all })
    },
  })
}
