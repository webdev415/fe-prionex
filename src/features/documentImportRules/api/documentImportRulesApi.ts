/**
 * Bulk-upload type rules API client.
 *
 * Backed by ``client-service`` at ``/api/v1/document-import-rules``; every
 * call is scoped to the caller's active project via the JWT.
 *
 * Each mutation answers with the whole rule set rather than the one row it
 * touched, because a change rarely stays on one row: adding a rule at an
 * occupied Order pushes the ones below it down, and deleting one closes the
 * gap. Returning the set is what lets the screen show the new numbering
 * without a second request.
 */

import { api } from '@/lib/api'
import type {
  DocumentImportFolder,
  DocumentImportReadiness,
  DocumentImportRuleCreate,
  DocumentImportRuleSet,
  DocumentImportRuleUpdate,
  DocumentImportRulesConfig,
} from '../types'

const BASE = '/api/v1/document-import-rules'

export async function getRules(): Promise<DocumentImportRulesConfig> {
  const response = await api.get<DocumentImportRulesConfig>(BASE)
  return response.data
}

/** Cheap "can a bulk upload start?" check for the upload screen. */
export async function getReadiness(): Promise<DocumentImportReadiness> {
  const response = await api.get<DocumentImportReadiness>(`${BASE}/readiness`)
  return response.data
}

export async function createRule(
  folder: DocumentImportFolder,
  input: DocumentImportRuleCreate
): Promise<DocumentImportRuleSet> {
  const response = await api.post<DocumentImportRuleSet>(`${BASE}/${folder}/rules`, input)
  return response.data
}

export async function updateRule(
  folder: DocumentImportFolder,
  ruleId: number,
  input: DocumentImportRuleUpdate
): Promise<DocumentImportRuleSet> {
  const response = await api.patch<DocumentImportRuleSet>(
    `${BASE}/${folder}/rules/${ruleId}`,
    input
  )
  return response.data
}

export async function deleteRule(
  folder: DocumentImportFolder,
  ruleId: number
): Promise<DocumentImportRuleSet> {
  const response = await api.delete<DocumentImportRuleSet>(`${BASE}/${folder}/rules/${ruleId}`)
  return response.data
}

export async function setDefaultType(
  folder: DocumentImportFolder,
  documentTypeId: number
): Promise<DocumentImportRuleSet> {
  const response = await api.put<DocumentImportRuleSet>(`${BASE}/${folder}/default`, {
    document_type_id: documentTypeId,
  })
  return response.data
}

export const documentImportRulesApi = {
  getRules,
  getReadiness,
  createRule,
  updateRule,
  deleteRule,
  setDefaultType,
}
