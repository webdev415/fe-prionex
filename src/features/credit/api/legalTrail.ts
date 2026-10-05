/**
 * След правовых текстов сайта, показанных клиенту до подачи заявки (18-4a).
 *
 * Модуль отдаёт его в карточке полем `legal_texts_shown` (`InternalApplication`,
 * контракт 0.1.48). Здесь — только чтение, без React: экран не должен падать ни
 * на стенде старше контракта (поля нет), ни на элементе не той формы.
 *
 * Три состояния блока различаются формой поля:
 * - поля нет / `null` / не массив → `null` → блока нет. У модуля старше 0.1.48
 *   таблицы следа нет вовсе, и пометка «модуль не передав» на каждой заявке
 *   утверждала бы несуществующее;
 * - массив без единого элемента-объекта → `[]` → «следа не передано»;
 * - иначе — строки в порядке массива (порядок приёма модулем; не сортировать —
 *   по нему сверяют с журналом CMS построчно).
 */

/** Первые знаки отпечатка на экране: 12 hex = 48 бит — глазом сверить с журналом CMS хватает. */
export const LEGAL_TRAIL_SHA_PREFIX = 12

/**
 * Поле этапа показа — 18-4c (контракт 0.1.49, `intake | sign`); в 0.1.48 его нет.
 * Читается терпимо: назовёт 18-4c поле иначе — правится эта константа.
 */
export const LEGAL_TRAIL_DOOR_KEY = 'door'

/** Строка следа после нормализации: значение не того вида — `null` («—» в ячейке). */
export interface CreditLegalTrailRow {
  source: string | null
  subject: string | null
  publication_id: number | null
  version_no: number | null
  sha256: string | null
  locale: string | null
  /** Часы сайта; `null` — сайт момент не назвал. Моментом приёма не подменяется. */
  shown_at: string | null
  received_at: string | null
  door: string | null
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const integer = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null

/** Поле `legal_texts_shown` карточки → строки блока или `null` (блока нет). */
export function readLegalTrail(value: unknown): CreditLegalTrailRow[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === 'object' && !Array.isArray(entry)
    )
    .map((entry) => ({
      source: text(entry.source),
      subject: text(entry.subject),
      publication_id: integer(entry.publication_id),
      version_no: integer(entry.version_no),
      sha256: text(entry.sha256),
      locale: text(entry.locale),
      shown_at: text(entry.shown_at),
      received_at: text(entry.received_at),
      door: text(entry[LEGAL_TRAIL_DOOR_KEY]),
    }))
}

/** Короткий отпечаток для экрана; пустой — `null` (кнопки копирования нет). */
export function shortSha(value: string | null): string | null {
  return value ? value.slice(0, LEGAL_TRAIL_SHA_PREFIX) : null
}

/** Раздел журнала CMS → дискриминант подписи; `null` — показывать как пришло. */
export function sourceKind(source: string | null): 'legalTexts' | 'siteDocuments' | null {
  return source === 'legal-texts'
    ? 'legalTexts'
    : source === 'site-documents'
      ? 'siteDocuments'
      : null
}

/** Этап показа → дискриминант подписи; `null` — показывать как пришло. */
export function doorKind(door: string | null): 'intake' | 'sign' | null {
  return door === 'intake' || door === 'sign' ? door : null
}

/** Столбец «Показано» — только если сайт назвал момент хотя бы у одной строки. */
export function hasShownAt(rows: readonly CreditLegalTrailRow[]): boolean {
  return rows.some((shown) => Boolean(shown.shown_at))
}

/** Столбец «Етап» — только если хотя бы у одной строки этап — непустая строка. */
export function hasDoor(rows: readonly CreditLegalTrailRow[]): boolean {
  return rows.some((shown) => Boolean(shown.door))
}
