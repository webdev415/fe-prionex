/**
 * React Query hooks for the bulk-upload type rules.
 *
 * Mutations here deliberately do NOT toast on error. A refused rule change is
 * almost always a duplicate keyword or a type that no longer resolves, and the
 * backend says which field it is about — that belongs under the input the user
 * is editing, not in a corner of the screen. The form reads the error through
 * ``fieldErrorOf``; anything without a field still falls back to a toast there.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentTypesKeys } from '@/features/documentTypes'
import { documentImportRulesApi } from '../api/documentImportRulesApi'
import type {
  DocumentImportFieldError,
  DocumentImportFolder,
  DocumentImportReadiness,
  DocumentImportRuleCreate,
  DocumentImportRuleSet,
  DocumentImportRuleUpdate,
  DocumentImportRulesConfig,
} from '../types'

export const documentImportRulesKeys = {
  all: ['documentImportRules'] as const,
  config: () => [...documentImportRulesKeys.all, 'config'] as const,
  readiness: () => [...documentImportRulesKeys.all, 'readiness'] as const,
}

/** The inputs the rule form actually renders an error under. */
const RENDERED_FIELDS = ['keyword', 'document_type_id', 'position'] as const

/**
 * The field an error belongs to, or undefined when the form has nowhere to put
 * it.
 *
 * Both shapes name the field in free text the frontend does not control: a
 * model-level validator answers ``loc: ["body"]``, a path parameter
 * ``loc: ["path", "rule_id"]``. Passing those through as a field would file the
 * error against an input that is never rendered — it would disappear instead of
 * falling through to a toast, which is the whole point of reading it.
 */
function renderedField(value: unknown): DocumentImportFieldError['field'] {
  return RENDERED_FIELDS.includes(value as (typeof RENDERED_FIELDS)[number])
    ? (value as DocumentImportFieldError['field'])
    : undefined
}

/**
 * The message and field behind a refused change, or null for anything else.
 *
 * The backend answers 409/422 with ``detail: {message, field}``. FastAPI's own
 * validation errors (a keyword over the limit, say) answer with a list of
 * error objects instead, so both shapes are read here and the caller gets one
 * thing to render.
 */
export function fieldErrorOf(error: unknown): DocumentImportFieldError | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | undefined)?.response
    ?.data?.detail
  if (!detail) return null

  if (typeof detail === 'object' && !Array.isArray(detail)) {
    const { message, field } = detail as { message?: string; field?: unknown }
    if (message) return { message, field: renderedField(field) }
    return null
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] }
    if (!first?.msg) return null
    // loc is ["body", "keyword"] — the last entry is the field it is about.
    const last = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined
    return {
      // Pydantic prefixes its messages with "Value error, "; the rest is the
      // sentence the validator wrote for a person to read.
      message: first.msg.replace(/^Value error,\s*/, ''),
      field: renderedField(last),
    }
  }

  if (typeof detail === 'string') return { message: detail }
  return null
}

export function useDocumentImportRules(options: { enabled?: boolean } = {}) {
  return useQuery<DocumentImportRulesConfig>({
    queryKey: documentImportRulesKeys.config(),
    queryFn: documentImportRulesApi.getRules,
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  })
}

export function useDocumentImportReadiness(options: { enabled?: boolean } = {}) {
  return useQuery<DocumentImportReadiness>({
    queryKey: documentImportRulesKeys.readiness(),
    queryFn: documentImportRulesApi.getReadiness,
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  })
}

/**
 * Put a rule set answered by a mutation straight into the cached config, and
 * mark two other things stale.
 *
 * Readiness, because setting the last missing default is what unblocks the
 * upload screen, and it must not keep saying "blocked" until something else
 * happens to refetch.
 *
 * The document types list, because each row carries the number of rules
 * pointing at it and that is what disables its Delete button. Left cached, a
 * type that just became the target of a rule still shows Delete enabled — the
 * click then fails with the 409 the button exists to prevent.
 */
function useApplyRuleSet() {
  const queryClient = useQueryClient()
  return (folder: DocumentImportFolder, set: DocumentImportRuleSet) => {
    queryClient.setQueryData<DocumentImportRulesConfig>(
      documentImportRulesKeys.config(),
      (current) =>
        current
          ? {
              ...current,
              [folder]: set,
              ready:
                (folder === 'credits' ? set : current.credits).default_document_type_id !== null &&
                (folder === 'users' ? set : current.users).default_document_type_id !== null,
            }
          : current
    )
    queryClient.invalidateQueries({ queryKey: documentImportRulesKeys.readiness() })
    queryClient.invalidateQueries({ queryKey: documentTypesKeys.lists() })
  }
}

export function useCreateDocumentImportRule() {
  const apply = useApplyRuleSet()
  return useMutation({
    mutationFn: ({
      folder,
      input,
    }: {
      folder: DocumentImportFolder
      input: DocumentImportRuleCreate
    }) => documentImportRulesApi.createRule(folder, input),
    onSuccess: (set, { folder }) => apply(folder, set),
  })
}

export function useUpdateDocumentImportRule() {
  const apply = useApplyRuleSet()
  return useMutation({
    mutationFn: ({
      folder,
      ruleId,
      input,
    }: {
      folder: DocumentImportFolder
      ruleId: number
      input: DocumentImportRuleUpdate
    }) => documentImportRulesApi.updateRule(folder, ruleId, input),
    onSuccess: (set, { folder }) => apply(folder, set),
  })
}

export function useDeleteDocumentImportRule() {
  const apply = useApplyRuleSet()
  return useMutation({
    mutationFn: ({ folder, ruleId }: { folder: DocumentImportFolder; ruleId: number }) =>
      documentImportRulesApi.deleteRule(folder, ruleId),
    onSuccess: (set, { folder }) => apply(folder, set),
  })
}

export function useSetDocumentImportDefault() {
  const apply = useApplyRuleSet()
  return useMutation({
    mutationFn: ({
      folder,
      documentTypeId,
    }: {
      folder: DocumentImportFolder
      documentTypeId: number
    }) => documentImportRulesApi.setDefaultType(folder, documentTypeId),
    onSuccess: (set, { folder }) => apply(folder, set),
  })
}
