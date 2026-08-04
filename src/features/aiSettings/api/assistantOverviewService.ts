/**
 * Assistant overview service — read-only brain config + prompting for the
 * «Устройство ассистента» admin section.
 *
 * GET /api/v1/ai-assistant/admin/overview — gated by `manage_ai_settings`,
 * aggregates the brain's admin config + prompts behind one round trip
 * (api-prionex#1013, services/ai-assistant/app/routers/admin_overview.py).
 * When the brain cannot be reached the backend answers
 * 502 {"detail":{"code":"brain_unreachable"}} — surfaced here as a plain
 * query error, no special-casing: the section shows the same unavailable
 * card for that as for a network failure.
 */
import { api } from '@/lib/api'

export type AssistantApplyMode = 'gw-restart' | 'hot-reload' | 'reseed'

export interface OverviewFlags {
  thinking_mode_enabled: boolean
  skills_enabled: boolean
  hooks_enabled: boolean
  crm_mode: boolean
  memory_enabled: boolean
  knowledge_enabled: boolean
  query_router_enabled: boolean
  answer_eval_enabled: boolean
  tts_normalize_enabled: boolean
  corrector_enabled: boolean
  rbac_scope_enabled: boolean
  call_qa_enabled: boolean
}

export interface OverviewLimits {
  max_turns: number
  turn_deadline_s: number
  sql_max_rows: number
  prompt_append_limit: number
}

export interface OverviewConfig {
  model: string
  commit: string
  flags: OverviewFlags
  limits: OverviewLimits
  manifest: unknown
}

export interface OverviewPersona {
  name: string
  role: string
  tone: string
  language: string
  apply: AssistantApplyMode
  /** False while the brain is serving its shipped default for this artifact. */
  overridden?: boolean
}

/**
 * The prompt0 append artifact.
 *
 * `template` and `text` are NOT interchangeable: `template` is the raw,
 * editable string with `{name}` / `{role}` / `{tone}` placeholders, `text`
 * is the already-rendered result and is read-only. Edits go to `template`;
 * showing `text` in the editor would silently bake the placeholders into
 * literal values on the next save.
 *
 * `length` is the length of the RENDER, and `limit` is checked against that
 * render — so the template's own character count is not the number the
 * brain validates (a 6-char `{name}` can expand to anything).
 *
 * `error` non-null means the stored template does not render and the
 * gateway is serving the last working build — exactly the state an admin
 * opens this page to fix.
 */
export interface OverviewPromptAppend {
  template: string
  text: string
  length: number
  limit: number
  apply: AssistantApplyMode
  overridden?: boolean
  error?: string | null
}

/**
 * A brain skill as the admin scope reports it.
 *
 * `enabled` is optional only because the read-only stage of this endpoint
 * predates it (prionex-assistant#107 added it). A skill arriving without
 * the field is treated as ON — back when it was omitted every listed skill
 * was active, so defaulting to OFF would misreport a live skill as
 * disabled.
 *
 * There is no short description: `text` is the full SKILL.md body, which is
 * why the UI shows it behind a disclosure instead of as a subtitle.
 */
export interface OverviewSkill {
  name: string
  text: string
  apply: AssistantApplyMode
  enabled?: boolean
}

/** Whether a skill is active, resolving the optional `enabled` field. */
export function isSkillEnabled(skill: OverviewSkill): boolean {
  return skill.enabled !== false
}

export interface OverviewKnowledge {
  apply: AssistantApplyMode
  files: string[]
}

export interface OverviewPrompts {
  persona: OverviewPersona
  prompt0_append: OverviewPromptAppend
  skills: OverviewSkill[]
  knowledge: OverviewKnowledge
}

export interface AssistantOverview {
  config: OverviewConfig
  prompts: OverviewPrompts
}

export async function getAssistantOverview(): Promise<AssistantOverview> {
  const response = await api.get<AssistantOverview>('/api/v1/ai-assistant/admin/overview')
  return response.data
}

export const assistantOverviewKey = ['aiSettings', 'assistantOverview'] as const
