/**
 * Hooks behind Training → «Налаштування» → «Прослуховування (AI)».
 *
 * Two independent caches: the blocker dictionary and the AI rubrics. Rubric
 * mutations also invalidate `templateKeys` — AI rubrics are ordinary
 * scorecard templates, so the trainers' template picker reads the same
 * endpoint and must not keep a stale copy.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveQaTemplate,
  createQaBlocker,
  createQaTemplate,
  deleteQaBlocker,
  listQaBlockers,
  listQaTemplates,
  unarchiveQaTemplate,
  updateQaBlocker,
  updateQaTemplate,
} from '../api/qaRulesService'
import { templateKeys } from './useTemplates'
import type {
  QaBlockerCreatePayload,
  QaBlockerListFilters,
  QaBlockerUpdatePayload,
  TemplateCreatePayload,
  TemplateUpdatePayload,
} from '../types'

export const qaRulesKeys = {
  all: ['quality', 'qaRules'] as const,
  blockers: () => [...qaRulesKeys.all, 'blockers'] as const,
  blockerList: (filters: QaBlockerListFilters) => [...qaRulesKeys.blockers(), filters] as const,
  rubrics: () => [...qaRulesKeys.all, 'rubrics'] as const,
  rubricList: (includeArchived: boolean) => [...qaRulesKeys.rubrics(), includeArchived] as const,
}

// ----- Blockers -----

export function useQaBlockers(filters: QaBlockerListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: qaRulesKeys.blockerList(filters),
    queryFn: () => listQaBlockers(filters),
    enabled,
    staleTime: 60_000,
  })
}

export function useCreateQaBlocker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: QaBlockerCreatePayload) => createQaBlocker(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qaRulesKeys.blockers() })
    },
  })
}

export function useUpdateQaBlocker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: QaBlockerUpdatePayload }) =>
      updateQaBlocker(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qaRulesKeys.blockers() })
    },
  })
}

export function useDeleteQaBlocker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteQaBlocker(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qaRulesKeys.blockers() })
    },
  })
}

// ----- AI rubrics -----

export function useQaRubrics(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: qaRulesKeys.rubricList(includeArchived),
    // `purpose: 'ai'` is mandatory: the endpoint defaults to 'manual'.
    queryFn: () => listQaTemplates({ include_archived: includeArchived, purpose: 'ai' }),
    enabled,
    staleTime: 60_000,
  })
}

function useRubricInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: qaRulesKeys.rubrics() })
    void queryClient.invalidateQueries({ queryKey: templateKeys.all })
  }
}

export function useCreateQaRubric() {
  const invalidate = useRubricInvalidation()
  return useMutation({
    mutationFn: (payload: TemplateCreatePayload) =>
      createQaTemplate({ ...payload, purpose: 'ai' as const }),
    onSuccess: invalidate,
  })
}

export function useUpdateQaRubric() {
  const invalidate = useRubricInvalidation()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TemplateUpdatePayload }) =>
      updateQaTemplate(id, payload),
    onSuccess: invalidate,
  })
}

export function useArchiveQaRubric() {
  const invalidate = useRubricInvalidation()
  return useMutation({
    mutationFn: (id: number) => archiveQaTemplate(id),
    onSuccess: invalidate,
  })
}

export function useUnarchiveQaRubric() {
  const invalidate = useRubricInvalidation()
  return useMutation({
    mutationFn: (id: number) => unarchiveQaTemplate(id),
    onSuccess: invalidate,
  })
}
