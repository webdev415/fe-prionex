import { useQuery } from '@tanstack/react-query'
import { listAssignments } from '../api/trainingAssignmentsService'
import type { AssignmentFilters } from '../types/trainingAssignments'

export const trainingAssignmentsKeys = {
  all: ['training', 'assignments'] as const,
  list: (filters: AssignmentFilters) =>
    [...trainingAssignmentsKeys.all, 'list', filters] as const,
}

export function useTrainingAssignments(filters: AssignmentFilters = {}, enabled = true) {
  return useQuery({
    queryKey: trainingAssignmentsKeys.list(filters),
    queryFn: () => listAssignments(filters),
    enabled,
    staleTime: 30_000,
  })
}
