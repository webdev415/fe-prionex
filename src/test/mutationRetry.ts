/**
 * Боевое правило повтора мутаций — копия `main.tsx` для тестов: тот предикат не
 * экспортирует и при импорте монтирует приложение. Сцены «предикат повтора сцен
 * — копия боевого из main.tsx» (`CreditPostbackRules`, `CreditPostbackRuleForm`)
 * сверяют `MAIN_PREDICATE_LINES` с исходником, чтобы копия не разошлась с
 * оригиналом молча.
 *
 * ⚠️ Имя без `.test` / `.spec` намеренно (см. `piiHelpers.ts`).
 */
import type { AxiosError } from 'axios'
import type { CreditApiError } from '@/features/credit/api/creditApi'

const MUTATION_NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])
export const isMutationRetryable = (error: unknown): boolean => {
  const axiosError = error as AxiosError | undefined
  if (!axiosError || axiosError.response) return false
  const transportCode = (error as CreditApiError).transportCode
  if (transportCode && MUTATION_NETWORK_ERROR_CODES.has(transportCode)) return true
  return Boolean(axiosError.code && MUTATION_NETWORK_ERROR_CODES.has(axiosError.code))
}
export const MAIN_PREDICATE_LINES = [
  "const MUTATION_NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])",
  '  if (!axiosError || axiosError.response) return false',
  '  const transportCode = (error as CreditApiError).transportCode',
  '  if (transportCode && MUTATION_NETWORK_ERROR_CODES.has(transportCode)) return true',
  '  return Boolean(axiosError.code && MUTATION_NETWORK_ERROR_CODES.has(axiosError.code))',
  'retry: (failureCount, error) => failureCount < 1 && isMutationRetryable(error),',
]

/** Исходник `main.tsx` — глобом Vite с `?raw`: модуль не исполняется. */
export const MAIN_SOURCE = Object.values(
  import.meta.glob('../main.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]
