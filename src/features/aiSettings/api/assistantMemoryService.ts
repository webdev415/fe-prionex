/**
 * Assistant memory admin service — «Память» на странице настроек AI.
 *
 *   GET    /api/v1/ai-assistant/admin/memory/summary  — скоупы и объём памяти
 *   GET    /api/v1/ai-assistant/admin/memory?scope=…  — записи одного скоупа
 *   DELETE /api/v1/ai-assistant/admin/memory/{id}     — удалить запись
 *
 * Все три гейтятся `manage_ai_settings` на сервере (страница — тем же правом).
 * Скоуп — это либо конкретный сотрудник (`user:6951`), либо `global` — общий
 * справочник, который мозг подмешивает всем.
 *
 * Запись — та же сущность, что видит сам сотрудник в панели «Персоналізація»,
 * поэтому тип берётся оттуда: две копии одного контракта разъезжаются молча.
 */
import { api } from '@/lib/api'

import { normalizeMemoryList, type AssistantMemoryItem } from '@/features/aiAssistant/api'

const BASE = '/api/v1/ai-assistant/admin/memory'

/** Скоуп общего справочника — отдельная строка в таблице, не сотрудник. */
export const GLOBAL_MEMORY_SCOPE = 'global'

export interface AssistantMemoryScopeSummary {
  /** `user:<id>` либо `global`. */
  scope: string
  records: number
  /** Дата последней записи; сервер может вернуть null у пустого скоупа. */
  last_at: string | null
}

export interface AssistantMemoryScopeDetail {
  scope: string
  items: AssistantMemoryItem[]
  total: number
}

export const assistantMemorySummaryKey = ['aiSettings', 'assistantMemory', 'summary'] as const

export const assistantMemoryScopeKey = (scope: string) =>
  ['aiSettings', 'assistantMemory', 'scope', scope] as const

/**
 * Достать id сотрудника из скоупа: `user:6951` → 6951.
 *
 * `global` и всё нераспознанное дают null — вызывающий покажет скоуп как есть,
 * а не «Співробітник #NaN».
 */
export function parseMemoryScopeUserId(scope: string): number | null {
  const match = /^user:(\d+)$/.exec(scope.trim())
  if (!match) return null
  const id = Number(match[1])
  return Number.isFinite(id) ? id : null
}

export async function getAssistantMemorySummary(): Promise<AssistantMemoryScopeSummary[]> {
  const response = await api.get<{ scopes?: unknown }>(`${BASE}/summary`)
  const scopes = response.data?.scopes
  return Array.isArray(scopes) ? (scopes as AssistantMemoryScopeSummary[]) : []
}

export async function getAssistantMemoryScope(scope: string): Promise<AssistantMemoryScopeDetail> {
  const response = await api.get<unknown>(BASE, { params: { scope } })
  // Тело — тот же конверт `{items, total}`, что у пользовательского списка,
  // плюс `scope`; нормализация общая, чтобы промежуточная версия бэкенда с
  // голым массивом не роняла таблицу.
  const { items, total } = normalizeMemoryList(response.data)
  const echoed = (response.data as { scope?: unknown } | null)?.scope
  return { scope: typeof echoed === 'string' ? echoed : scope, items, total }
}

export async function deleteAssistantMemoryRecord(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
