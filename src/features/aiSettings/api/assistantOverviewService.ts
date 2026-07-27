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
}

export interface OverviewPromptAppend {
  text: string
  length: number
  limit: number
  apply: AssistantApplyMode
}

export interface OverviewSkill {
  name: string
  text: string
  apply: AssistantApplyMode
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
