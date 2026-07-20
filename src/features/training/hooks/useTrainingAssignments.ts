import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAssignments, updateAssignmentDeadline } from '../api/trainingAssignmentsService'
import type { AssignmentFilters } from '../types/trainingAssignments'

export const trainingAssignmentsKeys = {
  all: ['training', 'assignments'] as const,
  list: (filters: AssignmentFilters) => [...trainingAssignmentsKeys.all, 'list', filters] as const,
}

export function useTrainingAssignments(filters: AssignmentFilters = {}, enabled = true) {
  return useQuery({
    queryKey: trainingAssignmentsKeys.list(filters),
    queryFn: () => listAssignments(filters),
    enabled,
    staleTime: 30_000,
  })
}

export function useUpdateAssignmentDeadline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ enrollmentId, deadline }: { enrollmentId: number; deadline: string | null }) =>
      updateAssignmentDeadline(enrollmentId, deadline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingAssignmentsKeys.all })
    },
  })
}
