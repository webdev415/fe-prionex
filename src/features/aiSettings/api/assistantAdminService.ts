/**
 * Assistant admin write service — the three management endpoints behind the
 * «Управление ассистентом» section of the AI settings page.
 *
 *   PUT /api/v1/ai-assistant/admin/skills/{name}     — enable/disable a skill
 *   PUT /api/v1/ai-assistant/admin/prompts/append    — replace the prompt0 append template
 *   PUT /api/v1/ai-assistant/admin/prompts/persona   — patch persona fields
 *
 * All three are gated by `manage_ai_settings` server-side and all three
 * answer with the SAME body as GET /admin/overview, so the caller repaints
 * the whole section from the response instead of guessing what changed
 * (a persona edit can, for instance, move the brain's apply mode).
 *
 * Error codes the UI distinguishes: 403 (no permission), 404 (unknown
 * skill), 422 (validation — the server's message is shown verbatim), and
 * 502/503 (brain unreachable). Anything else falls back to a generic
 * failure message.
 *
 * Live until the api-prionex bridge PR merges; before that the routes 404.
 */
import { api } from '@/lib/api'

import type { AssistantOverview, OverviewPersona } from './assistantOverviewService'

/** Persona fields an admin may patch — everything except the derived `apply`. */
export type PersonaPatch = Partial<Omit<OverviewPersona, 'apply'>>

export async function updateAssistantSkill(
  name: string,
  enabled: boolean
): Promise<AssistantOverview> {
  const response = await api.put<AssistantOverview>(
    `/api/v1/ai-assistant/admin/skills/${encodeURIComponent(name)}`,
    { enabled }
  )
  return response.data
}

export async function updateAssistantPromptAppend(text: string): Promise<AssistantOverview> {
  const response = await api.put<AssistantOverview>('/api/v1/ai-assistant/admin/prompts/append', {
    text,
  })
  return response.data
}

export async function updateAssistantPersona(patch: PersonaPatch): Promise<AssistantOverview> {
  const response = await api.put<AssistantOverview>(
    '/api/v1/ai-assistant/admin/prompts/persona',
    patch
  )
  return response.data
}
