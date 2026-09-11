import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { usersKeys } from '@/features/users/hooks/useUsers'
import * as employeeCardApi from '../api/employeeCardApi'
import { employeeEventKeys } from './useEmployeeEvents'
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

/**
 * Wrap a section mutation so what it changes elsewhere is refreshed too.
 *
 * The card's own answer is authoritative and goes straight into its cache.
 * The others are only marked for refetching, because the page behind the
 * dialog may not be showing them at all.
 *
 * Written once rather than per section: the two that need it needed the same
 * thing, and the second was missed for exactly as long as it was a habit
 * rather than a helper.
 */
function alsoRefreshing<TChanges>(
  mutation: ReturnType<typeof useSectionMutation<TChanges>>,
  queryClient: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly unknown[])[]
) {
  return {
    ...mutation,
    mutateAsync: async (changes: TChanges) => {
      const card = await mutation.mutateAsync(changes)
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      return card
    },
  }
}

/**
 * The personal section writes the employee's own record as well as the profile
 * beside it, so the employees list can go stale on a save: name, phone, email
 * and work format are all columns in it.
 */
export function useUpdatePersonal(userId: number, projectId?: number | null) {
  const queryClient = useQueryClient()
  return alsoRefreshing<PersonalInformationUpdate>(
    useSectionMutation<PersonalInformationUpdate>(
      userId,
      projectId,
      employeeCardApi.updatePersonal
    ),
    queryClient,
    [usersKeys.lists()]
  )
}

/**
 * Two things go stale here. Position, manager and hire date are columns in the
 * employees list - and changing a role or a department writes a chronology
 * line, so the history below the form is a page behind until it is refetched.
 */
export function useUpdateWork(userId: number, projectId?: number | null) {
  const queryClient = useQueryClient()
  return alsoRefreshing<WorkInformationUpdate>(
    useSectionMutation<WorkInformationUpdate>(userId, projectId, employeeCardApi.updateWork),
    queryClient,
    [usersKeys.lists(), employeeEventKeys.all]
  )
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

/**
 * Remove one survey from an employee's card.
 *
 * Acted from the row rather than from a dialog, so there is nowhere on screen
 * to put a failure - a toast is where the rest of the app says so. The card
 * comes back with the answer, which is why nothing is refetched.
 */
export function useRemoveSurvey(userId: number, projectId?: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (surveyId: number) => employeeCardApi.removeSurvey(userId, surveyId),
    onSuccess: (card) => {
      queryClient.setQueryData(employeeCardKeys.one(userId, projectId), card)
      // Its chronology line went with it, and the timeline is a separate
      // query that would otherwise keep showing the removed answer.
      void queryClient.invalidateQueries({ queryKey: employeeEventKeys.all })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Take the termination off, which is what rehiring looks like here.
 *
 * Acted from the panel rather than from a dialog, so there is nowhere on
 * screen to put a failure - a toast is where the rest of the app says so. The
 * card comes back reopened, which is why nothing is refetched.
 */
export function useReinstate(userId: number, projectId?: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => employeeCardApi.reinstate(userId),
    onSuccess: (card) => {
      queryClient.setQueryData(employeeCardKeys.one(userId, projectId), card)
      // The departure went with it, and the timeline is a separate query that
      // would otherwise keep a leaving date for somebody who is back.
      void queryClient.invalidateQueries({ queryKey: employeeEventKeys.all })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useCardNeighbours(userId: number, listQuery: string) {
  return useQuery({
    queryKey: employeeCardKeys.neighbours(userId, listQuery),
    queryFn: () => employeeCardApi.getCardNeighbours(userId, listQuery),
    enabled: userId > 0,
  })
}
