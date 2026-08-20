/**
 * Call QA listening rules — the two surfaces the training-department head
 * edits under Training → «Налаштування»:
 *
 *   1. the critical-blocker dictionary (`quality_db.blocker_dictionary`)
 *      served under `/api/v1/quality/qa-rules/blockers`;
 *   2. the AI rubrics — ordinary scorecard templates carrying
 *      `purpose='ai'`, served by the existing `/api/v1/quality/templates`
 *      CRUD.
 *
 * Reads are open to `view_ai_reviews`; every write is server-gated by
 * `manage_qa_rules` (403 otherwise — the UI additionally hides the whole
 * tab, so a 403 here only happens if a role changes mid-session).
 *
 * TOLERANT READER: `category`/`severity`/`lang` come back as raw strings —
 * the pipeline owns those vocabularies and may grow them ahead of the UI.
 * The editor only *writes* the values it knows.
 */
import { api } from '@/lib/api'
import type {
  QaBlocker,
  QaBlockerListFilters,
  QaBlockerPayload,
  ScorecardTemplate,
  TemplateCreatePayload,
  TemplateListFilters,
  TemplateUpdatePayload,
} from '../types'

const BLOCKERS_URL = '/api/v1/quality/qa-rules/blockers'
const TEMPLATES_URL = '/api/v1/quality/templates'

// ----- Blockers -----

/** Both the bare-array and the paged envelope are accepted (tolerant reader). */
function unwrapList<T>(data: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  return []
}

export async function listQaBlockers(filters: QaBlockerListFilters = {}): Promise<QaBlocker[]> {
  const params = new URLSearchParams()
  if (filters.is_active != null) params.set('is_active', String(filters.is_active))
  if (filters.category) params.set('category', filters.category)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.lang) params.set('lang', filters.lang)
  const response = await api.get<QaBlocker[] | { items?: QaBlocker[] }>(BLOCKERS_URL, {
    params,
  })
  return unwrapList(response.data)
}

export async function createQaBlocker(payload: QaBlockerPayload): Promise<QaBlocker> {
  const response = await api.post<QaBlocker>(BLOCKERS_URL, payload)
  return response.data
}

export async function updateQaBlocker(
  blockerId: string,
  payload: Partial<QaBlockerPayload>
): Promise<QaBlocker> {
  const response = await api.put<QaBlocker>(`${BLOCKERS_URL}/${blockerId}`, payload)
  return response.data
}

export async function deleteQaBlocker(blockerId: string): Promise<void> {
  await api.delete(`${BLOCKERS_URL}/${blockerId}`)
}

// ----- AI rubrics (scorecard templates with purpose='ai') -----

export async function listQaTemplates(
  filters: TemplateListFilters = {}
): Promise<ScorecardTemplate[]> {
  const params = new URLSearchParams()
  if (filters.include_archived) params.set('include_archived', 'true')
  if (filters.purpose) params.set('purpose', filters.purpose)
  const response = await api.get<ScorecardTemplate[] | { items?: ScorecardTemplate[] }>(
    TEMPLATES_URL,
    { params }
  )
  const rows = unwrapList(response.data)
  // Belt and braces: a backend that ignores `?purpose=` must not leak the
  // trainers' manual templates into the AI rubric list.
  return filters.purpose
    ? rows.filter((row) => (row.purpose ?? 'manual') === filters.purpose)
    : rows
}

export async function createQaTemplate(payload: TemplateCreatePayload): Promise<ScorecardTemplate> {
  const response = await api.post<ScorecardTemplate>(TEMPLATES_URL, payload)
  return response.data
}

export async function updateQaTemplate(
  templateId: number,
  payload: TemplateUpdatePayload
): Promise<ScorecardTemplate> {
  const response = await api.put<ScorecardTemplate>(`${TEMPLATES_URL}/${templateId}`, payload)
  return response.data
}

export async function archiveQaTemplate(templateId: number): Promise<ScorecardTemplate> {
  const response = await api.post<ScorecardTemplate>(`${TEMPLATES_URL}/${templateId}/archive`)
  return response.data
}

export async function unarchiveQaTemplate(templateId: number): Promise<ScorecardTemplate> {
  const response = await api.post<ScorecardTemplate>(`${TEMPLATES_URL}/${templateId}/unarchive`)
  return response.data
}
