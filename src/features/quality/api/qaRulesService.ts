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
 * Write gating is per-purpose on the template routes: `purpose='ai'` needs
 * `manage_qa_rules`, `purpose='manual'` needs `manage_scorecard_templates`.
 * Blocker writes are `manage_qa_rules` throughout.
 *
 * TOLERANT READER: `category`/`severity`/`lang` come back as raw strings —
 * the pipeline owns those vocabularies and may grow them ahead of the UI.
 * The editor only *writes* the values it knows.
 */
import { api } from '@/lib/api'
import type {
  QaBlocker,
  QaBlockerCreatePayload,
  QaBlockerListFilters,
  QaBlockerUpdatePayload,
  ScorecardTemplate,
  TemplateCreatePayload,
  TemplateListFilters,
  TemplateUpdatePayload,
} from '../types'

const BLOCKERS_URL = '/api/v1/quality/qa-rules/blockers'
const TEMPLATES_URL = '/api/v1/quality/templates'

// ----- Blockers -----

/**
 * The endpoint filters by activity, category, severity and language. The
 * settings table deliberately doesn't use those: the dictionary is a few
 * dozen rows, so it fetches once (`include_inactive`, no `is_active` — both
 * states, which the activity switch needs) and narrows on the client, which
 * keeps the filters instant and the cache single. The parameters are
 * supported here for callers that want a narrower slice.
 */
export async function listQaBlockers(filters: QaBlockerListFilters = {}): Promise<QaBlocker[]> {
  const params = new URLSearchParams()
  if (filters.include_inactive) params.set('include_inactive', 'true')
  // Tri-state, and it overrides include_inactive — only send it when set.
  if (filters.is_active != null) params.set('is_active', String(filters.is_active))
  if (filters.category) params.set('category', filters.category)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.lang) params.set('lang', filters.lang)
  const response = await api.get<QaBlocker[]>(BLOCKERS_URL, { params })
  return Array.isArray(response.data) ? response.data : []
}

export async function createQaBlocker(payload: QaBlockerCreatePayload): Promise<QaBlocker> {
  const response = await api.post<QaBlocker>(BLOCKERS_URL, payload)
  return response.data
}

export async function updateQaBlocker(
  blockerId: string,
  payload: QaBlockerUpdatePayload
): Promise<QaBlocker> {
  const response = await api.put<QaBlocker>(`${BLOCKERS_URL}/${blockerId}`, payload)
  return response.data
}

/**
 * Soft delete: answers 200 with the row flipped to `is_active: false`, so a
 * phrase is never actually lost — PUT `{is_active: true}` brings it back.
 */
export async function deleteQaBlocker(blockerId: string): Promise<QaBlocker> {
  const response = await api.delete<QaBlocker>(`${BLOCKERS_URL}/${blockerId}`)
  return response.data
}

// ----- AI rubrics (scorecard templates with purpose='ai') -----

export async function listQaTemplates(
  filters: TemplateListFilters = {}
): Promise<ScorecardTemplate[]> {
  const params = new URLSearchParams()
  if (filters.include_archived) params.set('include_archived', 'true')
  // Server default is 'manual'; the settings tab must always ask for 'ai'.
  if (filters.purpose) params.set('purpose', filters.purpose)
  const response = await api.get<ScorecardTemplate[]>(TEMPLATES_URL, { params })
  return Array.isArray(response.data) ? response.data : []
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

/**
 * Answers 409 when the `(department_id, scorecard_type)` slice already has a
 * live rubric — archive that one first. The message names the conflict.
 */
export async function unarchiveQaTemplate(templateId: number): Promise<ScorecardTemplate> {
  const response = await api.post<ScorecardTemplate>(`${TEMPLATES_URL}/${templateId}/unarchive`)
  return response.data
}
