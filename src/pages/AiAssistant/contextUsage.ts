/**
 * Использование контекстного окна диалога с ассистентом.
 *
 * Мозг кладёт в терминальный SSE-кадр `done` блок `usage` от Agent SDK
 * (проверено на живом журнале 31.08.2026): `input_tokens`,
 * `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`.
 * Прокси CRM ретранслирует кадры 1:1, так что блок долетает до фронта —
 * до сих пор его просто никто не рисовал.
 *
 * «Заполненность контекста» последнего хода = всё, что модель видела как
 * промпт: свежие input-токены плюс прочитанный и созданный кеш. Окно обоих
 * режимов (fast 26B и thinking 31B) — 262144 токена (`--max-model-len`
 * контракта 256K).
 */

export const CONTEXT_WINDOW_TOKENS = 262144

export interface ContextUsageSnapshot {
  /** Токены промпта последнего хода (input + cache read + cache creation). */
  usedTokens: number
  /** Доля окна, 0..1 (может упереться в 1 при переполнении). */
  fraction: number
}

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

/**
 * Достать снимок использования контекста из data терминального кадра `done`.
 * Возвращает null, когда блока нет или он пуст (слеш-команды, уточнения
 * роутера и ошибки завершаются без usage) — индикатор тогда не обновляется.
 */
export function extractContextUsage(payload: unknown): ContextUsageSnapshot | null {
  if (typeof payload !== 'object' || payload === null) return null
  const usage = (payload as { usage?: unknown }).usage
  if (typeof usage !== 'object' || usage === null) return null
  const u = usage as Record<string, unknown>
  const used =
    toCount(u.input_tokens) +
    toCount(u.cache_read_input_tokens) +
    toCount(u.cache_creation_input_tokens)
  if (used <= 0) return null
  return {
    usedTokens: used,
    fraction: Math.min(used / CONTEXT_WINDOW_TOKENS, 1),
  }
}

export type ContextUsageLevel = 'ok' | 'warn' | 'danger'

/** Пороги подсветки: до 70% — спокойный, 70–90% — жёлтый, дальше — красный. */
export function contextUsageLevel(fraction: number): ContextUsageLevel {
  if (fraction >= 0.9) return 'danger'
  if (fraction >= 0.7) return 'warn'
  return 'ok'
}

/** «15,6 тис.» / «1,2 млн» — короткое число для подписи индикатора. */
export function formatTokensShort(tokens: number, locale = 'uk'): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} млн`
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })} тис.`
  }
  return String(tokens)
}
