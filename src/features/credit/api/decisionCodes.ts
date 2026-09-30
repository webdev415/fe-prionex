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
  /** Коды условного одобрения (`kind = conditional`, `AB-C-*`) по `id` — варианты «Схвалити з умовою» (19-5f). */
  conditional: readonly CreditDecisionCodeEntry[]
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
 * Кэш по самому объекту ответа, без общего состояния модуля: один и тот же
 * ответ — тот же индекс, любой другой объект — свой. Этого хватает, потому что
 * React Query делит структуру данных (`structuralSharing` по умолчанию):
 * перезапрос с тем же содержимым оставляет прежний объект `data`, и индекс не
 * пересобирается; новое содержимое — новый объект и новый индекс, даже если
 * модуль забыл сменить `version`. `select` запроса от этого остаётся чистым:
 * результат зависит только от входа. Ответ, который больше никто не держит,
 * уходит из кэша вместе с ним.
 */
const indexes = new WeakMap<CreditDecisionCodesRegistry, CreditDecisionCodeIndex>()

export function indexDecisionCodes(registry: CreditDecisionCodesRegistry): CreditDecisionCodeIndex {
  const known = indexes.get(registry)
  if (known) return known

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

  const conditional = registry.codes
    .filter((entry) => entry.kind === 'conditional')
    .sort((a, b) => byText(a.id, b.id))

  const index: CreditDecisionCodeIndex = {
    version: registry.version,
    byId,
    declineGroups,
    conditional,
  }
  indexes.set(registry, index)
  return index
}

/** Украинский ли интерфейс: `uk`, `uk-UA`; язык не задан — нет. */
const isUkrainian = (language: string | undefined) =>
  (language ?? '').toLowerCase().split('-')[0] === 'uk'

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
  return isUkrainian(language)
    ? { primary: entry.ru, secondary: entry.en }
    : { primary: entry.en, secondary: entry.ru }
}

/**
 * Основание кода из книги — подсказкой к строке кода. Оно есть только
 * по-русски, поэтому показывается лишь в украинском интерфейсе, где русский
 * текст книги и так идёт первой строкой. В английском и испанском интерфейсе
 * подсказки нет: русский абзац там был бы непрочитанным шумом.
 */
export function decisionCodeNote(
  entry: Pick<CreditDecisionCodeEntry, 'note_ru'>,
  language: string | undefined
): string | undefined {
  return isUkrainian(language) ? (entry.note_ru ?? undefined) : undefined
}

/** Коды для тела решения и для сравнения: без повторов, по возрастанию. */
export function normalizeDecisionCodes(codes: readonly string[]): string[] {
  return [...new Set(codes)].sort(byText)
}
