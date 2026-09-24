/**
 * Сортировка списков раздела.
 *
 * Сортировка СЕРВЕРНАЯ и только серверная. Отсортировать загруженную страницу
 * на клиенте значит соврать: оператор просит «самые просроченные наверх» и
 * получает самых просроченных среди двадцати строк текущей страницы, а не
 * среди всех тысячи семисот. Поэтому колонка сортируема только тогда, когда
 * сервис умеет по ней сортировать.
 */
import type { SortConfig } from '@/components/ui/DataTable'

/** Поля, по которым сортирует `GET /loans` (operator.LOAN_SORT_FIELDS). */
export const LOAN_SORTABLE = [
  'created_at',
  'disbursed_at',
  'maturity_date',
  'delinquency_days',
  'principal_minor',
  'total_payable_minor',
  'contract_number',
] as const

/** Поля, по которым сортирует `GET /applications`. */
export const APPLICATION_SORTABLE = [
  'created_at',
  'updated_at',
  'requested_amount_minor',
  'number',
  // Время входа в текущий шаг. Добавлено в модуль вместе с лентой переходов:
  // без серверной сортировки вопрос «кто стоит на банковской проверке дольше
  // всех» решался бы в пределах загруженной страницы, то есть не решался бы.
  'step_entered_at',
] as const

/** `-field` → {key: field, order: 'desc'}; пусто → undefined. */
export function sortConfigFromParam(param: string | undefined): SortConfig | undefined {
  if (!param) return undefined
  const descending = param.startsWith('-')
  return { key: param.replace(/^-/, ''), order: descending ? 'desc' : 'asc' }
}

/** Обратно в параметр запроса. */
export function sortParamFrom(key: string, order: 'asc' | 'desc'): string {
  return order === 'desc' ? `-${key}` : key
}
