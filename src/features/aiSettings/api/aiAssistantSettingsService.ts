/**
 * AI assistant settings service — the global assistant kill-switch.
 *
 * GET  /api/v1/ai-assistant/settings — readable by any authenticated user
 * (the header assistant button hides itself off this flag).
 * PUT  /api/v1/ai-assistant/settings — requires `manage_ai_settings`.
 *
 * While `assistant_enabled` is false the assistant surface answers
 * 503 {"detail":{"code":"assistant_disabled"}} — the UI hides the
 * assistant entry entirely instead of surfacing an error.
 */
import { api } from '@/lib/api'

export interface AiAssistantSettings {
  assistant_enabled: boolean
}

export async function getAiAssistantSettings(): Promise<AiAssistantSettings> {
  const response = await api.get<AiAssistantSettings>('/api/v1/ai-assistant/settings')
  return response.data
}

export async function updateAiAssistantSettings(
  input: AiAssistantSettings
): Promise<AiAssistantSettings> {
  const response = await api.put<AiAssistantSettings>('/api/v1/ai-assistant/settings', input)
  return response.data
}

export const aiAssistantSettingsKey = ['aiSettings', 'assistantSettings'] as const
