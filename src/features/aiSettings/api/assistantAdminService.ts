/**
 * Assistant admin write service — the three management endpoints behind the
 * «Управление ассистентом» section of the AI settings page.
 *
 *   PUT /api/v1/ai-assistant/admin/skills/{name}     — enable/disable a skill
 *   PUT /api/v1/ai-assistant/admin/prompts/append    — replace the prompt0 append template
 *   PUT /api/v1/ai-assistant/admin/prompts/persona   — patch persona fields
 *
 * All three are gated by `manage_ai_settings` server-side, and all three
 * answer with the `prompts` object ALONE — not the `{config, prompts}`
 * envelope GET /admin/overview returns. Callers merge it into the cached
 * overview instead of replacing it, or `config` is lost (api-prionex#1113).
 *
 * Bodies are strict: unknown keys come back as a 422, so `enabled` is sent
 * on its own and the persona patch carries only the fields that changed.
 *
 * Error codes the UI distinguishes: 403 (no permission), 404 (unknown
 * skill), 422 (validation — the server's message is shown verbatim), and
 * 502 brain_unreachable. Anything else falls back to a generic message.
 *
 * Live until the api-prionex bridge PR merges; before that the routes 404.
 */
import { api } from '@/lib/api'

import type { OverviewPersona, OverviewPrompts } from './assistantOverviewService'

/**
 * Persona fields an admin may patch — the editable strings only.
 *
 * `apply` and `overridden` are derived by the brain and rejected on the way
 * in (`extra_forbidden`), so they must not leak into a patch built from a
 * form.
 */
export type PersonaPatch = Partial<Omit<OverviewPersona, 'apply' | 'overridden'>>

export async function updateAssistantSkill(
  name: string,
  enabled: boolean
): Promise<OverviewPrompts> {
  const response = await api.put<OverviewPrompts>(
    `/api/v1/ai-assistant/admin/skills/${encodeURIComponent(name)}`,
    { enabled }
  )
  return response.data
}

/**
 * Replace the append template.
 *
 * The payload key is `template` (the raw string with placeholders), never
 * `text` (the rendered output) — see OverviewPromptAppend.
 */
export async function updateAssistantPromptAppend(template: string): Promise<OverviewPrompts> {
  const response = await api.put<OverviewPrompts>('/api/v1/ai-assistant/admin/prompts/append', {
    template,
  })
  return response.data
}

export async function updateAssistantPersona(patch: PersonaPatch): Promise<OverviewPrompts> {
  const response = await api.put<OverviewPrompts>(
    '/api/v1/ai-assistant/admin/prompts/persona',
    patch
  )
  return response.data
}
