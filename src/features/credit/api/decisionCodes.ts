/**
 * Справочник кодов решения андеррайтинга — чистые правила над ответом двери
 * `listDecisionCodes` (модуль v0.1.27). Без React, без i18n, без транспорта.
 *
 * Тексты кодов живут ТОЛЬКО в ответе модуля: RU книги правил проверки клиента
 * дословно и рабочий EN. В словари CRM они не копируются — копия разошлась бы с
 * книгой при первой же правке версии реестра.
 */
import { CREDIT_DECISION_CODE_CATEGORIES } from './enums'
import type {
  CreditDecisionCodeEntry,
  CreditDecisionCodeKind,
  CreditDecisionCodesRegistry,
} from './types'

/**
 * Что форма предлагает к отказу: отказ книги, автогейт и служебный код — то же
 * множество, что модуль принимает в `decline_codes` при `declined`. Условное
 * одобрение (`conditional`, `AB-C-*`) отказом не является: его место — одобрение
 * с подтверждением руководителя. Отбор по `kind`, а не по префиксу `id`.
 */
export const CREDIT_DECLINE_KINDS = [
  'refusal',
  'gate',
  'service',
] as const satisfies readonly CreditDecisionCodeKind[]

export interface CreditDecisionCodeGroup {
  /** Раздел книги; незнакомый (новая версия модуля) — как прислан. */
  category: string
  codes: CreditDecisionCodeEntry[]
}

export interface CreditDecisionCodeIndex {
  version: string
  byId: ReadonlyMap<string, CreditDecisionCodeEntry>
  /** Коды отказа по разделам книги, в порядке книги. */
  declineGroups: readonly CreditDecisionCodeGroup[]
}

const DECLINE_KIND_ORDER: readonly string[] = CREDIT_DECLINE_KINDS
const CATEGORY_ORDER: readonly string[] = CREDIT_DECISION_CODE_CATEGORIES

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Раздел вне перечня встаёт после всех известных, а не теряется. */
const categoryRank = (category: string) => {
  const rank = CATEGORY_ORDER.indexOf(category)
  return rank === -1 ? CATEGORY_ORDER.length : rank
}

/**
 * Однослотовый кэш по `version`. Контракт обещает новую `version` при любой
 * правке содержимого реестра, значит `version` и есть тождество справочника:
 * повторный ответ той же версии (новый объект после перезапроса) отдаёт ТОТ ЖЕ
 * индекс, новая версия — новый.
 */
let cached: CreditDecisionCodeIndex | undefined

export function indexDecisionCodes(registry: CreditDecisionCodesRegistry): CreditDecisionCodeIndex {
  if (cached?.version === registry.version) return cached

  const byId = new Map(registry.codes.map((entry) => [entry.id, entry] as const))
  const groups = new Map<string, CreditDecisionCodeEntry[]>()
  for (const entry of registry.codes) {
    if (!DECLINE_KIND_ORDER.includes(entry.kind)) continue
    const group = groups.get(entry.category)
    if (group) group.push(entry)
    else groups.set(entry.category, [entry])
  }
  const declineGroups = [...groups]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || byText(a, b))
    .map(([category, codes]) => ({
      category,
      codes: codes.sort(
        (a, b) =>
          DECLINE_KIND_ORDER.indexOf(a.kind) - DECLINE_KIND_ORDER.indexOf(b.kind) ||
          byText(a.id, b.id)
      ),
    }))

  cached = { version: registry.version, byId, declineGroups }
  return cached
}

/**
 * Какой текст кода первой строкой. Украинский интерфейс — RU книги (в
 * операторском контуре норма — она), вторым EN; любой другой язык, включая
 * незнакомый, — EN первым, как `fallbackLng` приложения. Своего испанского и
 * украинского текста у реестра нет.
 */
export function decisionCodeText(
  entry: Pick<CreditDecisionCodeEntry, 'ru' | 'en'>,
  language: string | undefined
): { primary: string; secondary: string } {
  const base = (language ?? '').toLowerCase().split('-')[0]
  return base === 'uk'
    ? { primary: entry.ru, secondary: entry.en }
    : { primary: entry.en, secondary: entry.ru }
}

/** Коды для тела решения и для сравнения: без повторов, по возрастанию. */
export function normalizeDecisionCodes(codes: readonly string[]): string[] {
  return [...new Set(codes)].sort(byText)
}
