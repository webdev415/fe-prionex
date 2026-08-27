import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as employeeCardApi from '../api/employeeCardApi'
import type {
  AdditionalInformationUpdate,
  EmployeeCard,
  PersonalInformationUpdate,
  RelativeInput,
  WorkInformationUpdate,
} from '../types.card'

export const employeeCardKeys = {
  all: ['employee-card'] as const,
  neighbours: (userId: number, listQuery: string) =>
    ['employee-card', 'neighbours', userId, listQuery] as const,
  one: (userId: number, projectId?: number | null) =>
    ['employee-card', userId, projectId ?? null] as const,
}

export function useEmployeeCard(userId: number, projectId?: number | null) {
  return useQuery({
    queryKey: employeeCardKeys.one(userId, projectId),
    queryFn: () => employeeCardApi.getEmployeeCard(userId, projectId),
    enabled: userId > 0,
  })
}

/**
 * Every section write answers with the whole card.
 *
 * Putting that answer straight into the cache rather than refetching means
 * the page never shows the old value for the moment between saving and the
 * next read, which is exactly when somebody looks.
 */
function useSectionMutation<TChanges>(
  userId: number,
  projectId: number | null | undefined,
  save: (userId: number, changes: TChanges) => Promise<EmployeeCard>
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: TChanges) => save(userId, changes),
    onSuccess: (card) => {
      queryClient.setQueryData(employeeCardKeys.one(userId, projectId), card)
    },
  })
}

export function useUpdatePersonal(userId: number, projectId?: number | null) {
  return useSectionMutation<PersonalInformationUpdate>(
    userId,
    projectId,
    employeeCardApi.updatePersonal
  )
}

export function useUpdateWork(userId: number, projectId?: number | null) {
  return useSectionMutation<WorkInformationUpdate>(userId, projectId, employeeCardApi.updateWork)
}

export function useUpdateAdditional(userId: number, projectId?: number | null) {
  return useSectionMutation<AdditionalInformationUpdate>(
    userId,
    projectId,
    employeeCardApi.updateAdditional
  )
}

export function useReplaceContacts(userId: number, projectId?: number | null) {
  return useSectionMutation<RelativeInput[]>(userId, projectId, employeeCardApi.replaceContacts)
}

export function useUpdateInterviewComment(userId: number, projectId?: number | null) {
  return useSectionMutation<string | null>(
    userId,
    projectId,
    employeeCardApi.updateInterviewComment
  )
}

export function useCardNeighbours(userId: number, listQuery: string) {
  return useQuery({
    queryKey: employeeCardKeys.neighbours(userId, listQuery),
    queryFn: () => employeeCardApi.getCardNeighbours(userId, listQuery),
    enabled: userId > 0,
  })
}
