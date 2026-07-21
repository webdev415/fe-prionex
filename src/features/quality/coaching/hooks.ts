import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getHeaderKpis,
  getInboxQueue,
  getMyOperators,
  getOperatorTrainers,
  getOperatorCoachingDetail,
  getTeamEvents,
  getTeamRoster,
  listOneOnOnes,
  scheduleOneOnOne,
  takeChargeOfOperator,
  transitionAssignment,
  type ListOneOnOnesFilters,
} from './api'
import type {
  HeaderKpisFilters,
  OperatorDetailFilters,
  QueueFilters,
  ScheduleOneOnOnePayload,
  TakeChargePayload,
  TeamEventsFilters,
  TeamRosterFilters,
  TransitionAssignmentPayload,
} from './types'

export const coachingKeys = {
  all: ['quality', 'coaching'] as const,
  queue: (filters: QueueFilters) => [...coachingKeys.all, 'queue', filters] as const,
  detail: (filters: OperatorDetailFilters) => [...coachingKeys.all, 'detail', filters] as const,
  headerKpis: (filters: HeaderKpisFilters) =>
    [...coachingKeys.all, 'header-kpis', filters] as const,
  oneOnOnes: (filters: ListOneOnOnesFilters) =>
    [...coachingKeys.all, 'one-on-ones', filters] as const,
  teamEvents: (filters: TeamEventsFilters) =>
    [...coachingKeys.all, 'team-events', filters] as const,
  teamRoster: (filters: TeamRosterFilters) =>
    [...coachingKeys.all, 'team-roster', filters] as const,
  myOperators: () => [...coachingKeys.all, 'my-operators'] as const,
  operatorTrainers: () => [...coachingKeys.all, 'operator-trainers'] as const,
}

/** Operator ids the current trainer has taken under control (My employees). */
export function useMyOperators(enabled = true) {
  return useQuery({
    queryKey: coachingKeys.myOperators(),
    queryFn: getMyOperators,
    enabled,
    staleTime: 60_000,
  })
}

/** Assigned trainer per operator — the Dialogue "Trainer" column (project-wide). */
export function useOperatorTrainers(enabled = true) {
  return useQuery({
    queryKey: coachingKeys.operatorTrainers(),
    queryFn: getOperatorTrainers,
    enabled,
    staleTime: 60_000,
  })
}

export function useInboxQueue(filters: QueueFilters, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.queue(filters),
    queryFn: () => getInboxQueue(filters),
    // The BE /queue treats absent/empty user_ids as an EMPTY scope (returns an
    // empty page — see coaching.py get_queue), so firing without ids is a
    // guaranteed no-op. Callers must resolve their scope to a concrete id list;
    // we only run once that list is non-empty.
    enabled: enabled && (filters.user_ids?.length ?? 0) > 0,
    staleTime: 30_000,
  })
}

export function useOperatorCoachingDetail(filters: OperatorDetailFilters, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.detail(filters),
    queryFn: () => getOperatorCoachingDetail(filters),
    enabled: enabled && Number.isFinite(filters.operator_id),
    staleTime: 30_000,
  })
}

export function useOneOnOnes(filters: ListOneOnOnesFilters = {}, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.oneOnOnes(filters),
    queryFn: () => listOneOnOnes(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useScheduleOneOnOne() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ScheduleOneOnOnePayload) => scheduleOneOnOne(payload),
    onSuccess: () => {
      // 1-on-1 count drives the header strip ("1-on-1 today") and the
      // upcoming-sessions list — invalidate both surfaces so they refresh
      // without a hard reload.
      queryClient.invalidateQueries({ queryKey: coachingKeys.all })
    },
  })
}

export function useTransitionAssignment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: number
      payload: TransitionAssignmentPayload
    }) => transitionAssignment(assignmentId, payload),
    onSuccess: () => {
      // Queue (Kanban) + header KPIs + per-operator detail all show the
      // assignment state — invalidate everything in the coaching namespace.
      queryClient.invalidateQueries({ queryKey: coachingKeys.all })
    },
  })
}

export function useTakeCharge() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TakeChargePayload) => takeChargeOfOperator(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coachingKeys.all })
    },
  })
}

export function useHeaderKpis(filters: HeaderKpisFilters, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.headerKpis(filters),
    queryFn: () => getHeaderKpis(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useTeamEvents(filters: TeamEventsFilters = {}, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.teamEvents(filters),
    queryFn: () => getTeamEvents(filters),
    enabled,
    // Feed refreshes faster than the queue — trainer cares about "what
    // just happened" so we revalidate aggressively.
    staleTime: 15_000,
  })
}

export function useTeamRoster(filters: TeamRosterFilters = {}, enabled = true) {
  return useQuery({
    queryKey: coachingKeys.teamRoster(filters),
    queryFn: () => getTeamRoster(filters),
    enabled,
    // Online state is the spec's 60s freshness floor — re-fetch at the
    // same cadence so the dot updates in line with the data source.
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
