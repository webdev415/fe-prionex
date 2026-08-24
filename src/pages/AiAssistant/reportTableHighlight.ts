/**
 * Табличные отчёты ассистента: разбор чисел, тепловая карта числовых колонок,
 * маркер внимания «⚠️» и лид-абзац «Висновок:».
 *
 * Модуль намеренно без React: та же логика проверяется юнит-тестами напрямую,
 * а `MarkdownMessage` только раскрашивает по её плану.
 *
 * Всё поведение живёт за флагом сборки `VITE_ASSISTANT_REPORT_TABLES_ENABLED`
 * (дефолт — выключено): при выключенном флаге разметка ответа ассистента
 * остаётся ровно такой, какой была до этой доработки.
 */

/** Имя флага сборки, включающего табличные отчёты (значения `true`/`1`). */
export const REPORT_TABLES_FLAG = 'VITE_ASSISTANT_REPORT_TABLES_ENABLED'

/**
 * Читается на каждый вызов (а не один раз при импорте), чтобы тест мог
 * подменить окружение через `vi.stubEnv` уже после загрузки модуля. Обращение
 * статическое — только такое Vite подставляет значением при сборке.
 */
export function isAssistantReportTablesEnabled(): boolean {
  const raw: unknown = import.meta.env.VITE_ASSISTANT_REPORT_TABLES_ENABLED
  return raw === 'true' || raw === '1' || raw === true
}

/**
 * Маркер строки-аномалии (U+26A0 U+FE0F). Конвенция пакета: модель ставит его
 * В НАЧАЛЕ ячейки, на которую нужно посмотреть; подсвечивается вся строка, сам
 * знак остаётся в тексте — его видит и тот, кто скопирует таблицу.
 */
export const ATTENTION_MARKER = '⚠️'

/** Доля разобравшихся ячеек, с которой колонка считается числовой. */
export const NUMERIC_COLUMN_RATIO = 0.7

/**
 * Токен масштабной заливки: намеренно НЕ тёплый. Решение CEO (24.08): тёплый
 * цвет означает ТОЛЬКО проблему (строки с «⚠️»), а масштаб чисел — спокойный
 * нейтральный фон, иначе большой отдел глаз читает как тревогу.
 *
 * `--color-muted-foreground` — единственный по-настоящему нейтральный серый
 * приложения: он не перекрашивается акцентом (в отличие от `--color-primary-*`,
 * который под акцентами `orange`/`red`/`amber` уехал бы в тёплый), а по темам
 * остаётся серым (`#888888` в свету, `#a1a1a1`/`#adadad` в `neutral-dim`/
 * `ultra-dark`), так что заливка не выцветает и не желтит ни в одной теме.
 */
export const HEAT_COLOR_TOKEN = '--color-muted-foreground'

/** Заливка самой «холодной» числовой ячейки, % непрозрачности. */
export const MIN_HEAT_OPACITY = 2

/**
 * Заливка самой «горячей» числовой ячейки, % непрозрачности. Снижена с 18 до 10
 * вместе с уходом от тёплого тона: масштаб должен читаться спокойным фоном, а не
 * акцентом (тёплый акцент теперь закреплён только за строками «⚠️»).
 */
export const MAX_HEAT_OPACITY = 10

/** Заливка строки с маркером внимания, % непрозрачности. */
export const ATTENTION_OPACITY = 14

/**
 * Разделитель тысяч. `\s` в JS покрывает всю категорию Zs, то есть и обычный
 * пробел, и неразрывный (U+00A0), и узкий неразрывный (U+202F), и тонкий
 * (U+2009) — ровно те, которыми модель разбивает суммы.
 */
const SPACE_SEPARATORS = /\s/g

/** Юникодные «минусы», которые модель ставит вместо ASCII-дефиса. */
const DASH_SIGNS = /[−‒–—]/g

/**
 * Единицы, которые можно снять с хвоста, не потеряв число: гривня в трёх
 * написаниях, проценты, штуки, дни, «осіб» из отчётов по отделам.
 */
const UNIT_SUFFIX = /(?:грн|₴|uah|коп|%|шт|осіб|днів|дн|год)\.?$/iu

/** Число после нормализации: знак, целая часть, необязательная дробная. */
const PLAIN_NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/

/**
 * Импортный формат `1,234,567[.89]`: запятая — разделитель тысяч. Требуем
 * минимум две группы, иначе `1,234` не отличить от украинского «1,234».
 */
const GROUPED_THOUSANDS = /^[+-]?\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?$/

/** Маркер внимания с необязательным вариационным селектором и пробелами. */
const ATTENTION_PREFIX = /^\s*⚠️?\s*/

/** Лид-абзац вывода: «Висновок:», «Підсумок:», «Вывод:» и их множественные. */
const CONCLUSION_PREFIX = /^\s*(?:висновок|висновки|підсумок|вывод|выводы|итог|итоги)\s*:/iu

/** Есть ли у ячейки маркер внимания в начале. */
export function isAttentionCell(text: string): boolean {
  return ATTENTION_PREFIX.test(text)
}

/** Текст ячейки без ведущего маркера внимания (в DOM текст не меняется). */
export function stripAttentionMarker(text: string): string {
  return text.replace(ATTENTION_PREFIX, '')
}

/**
 * Число из ячейки украинского отчёта или `null`.
 *
 * Разбирает: `1 209 239.06`, `1 209 239,06`, `48 750,50 грн`, `12,5%`,
 * `−1 234` (юникодный минус), `1,234,567.89`, а также ячейку с ведущим «⚠️»
 * (маркер не должен выбивать колонку из числовых).
 *
 * Не разбирает: даты `24.08.2026`, время `09:14`, телефоны и идентификаторы с
 * ведущим нулём (`0671234567`), любой текст.
 */
export function parseNumericCell(raw: string): number | null {
  if (typeof raw !== 'string') return null

  let text = stripAttentionMarker(raw).trim()
  if (!text) return null

  text = text.replace(DASH_SIGNS, '-')
  text = text.replace(UNIT_SUFFIX, '').trim()
  text = text.replace(SPACE_SEPARATORS, '')
  if (!text) return null

  if (GROUPED_THOUSANDS.test(text)) {
    text = text.replace(/,/g, '')
  } else if (!PLAIN_NUMBER.test(text)) {
    return null
  }

  const digits = text.replace(/^[+-]/, '')
  // `0671234567` — телефон, `007` — код: ведущий ноль без дробной части значит
  // идентификатор, а не измеримую величину.
  if (digits.length > 1 && digits.startsWith('0') && !/^0[.,]/.test(digits)) return null
  // `+380671234567` — тоже телефон: явный плюс в отчёте означает дельту
  // (`+18`, `+2,5%`), а не двенадцатизначное число.
  if (text.startsWith('+') && digits.replace(/[.,]\d+$/, '').length >= 10) return null

  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Числовая колонка таблицы: индекс и границы шкалы. */
export type NumericColumn = {
  index: number
  min: number
  max: number
}

/** План раскраски таблицы: числовые колонки и строки с маркером внимания. */
export type TableHighlightPlan = {
  columns: Map<number, NumericColumn>
  attentionRows: Set<number>
}

/** Пустой план — таблица рендерится как обычная. */
export function emptyHighlightPlan(): TableHighlightPlan {
  return { columns: new Map(), attentionRows: new Set() }
}

/**
 * План раскраски по текстам ячеек тела таблицы (`rows[rowIndex][colIndex]`).
 *
 * Колонка попадает в тепловую карту, если ≥{@link NUMERIC_COLUMN_RATIO} её
 * непустых ячеек — числа И шкала не вырождена (`min < max`): в колонке из
 * одинаковых значений подсвечивать нечего.
 */
export function buildTableHighlightPlan(rows: string[][]): TableHighlightPlan {
  const plan = emptyHighlightPlan()
  if (rows.length === 0) return plan

  rows.forEach((cells, rowIndex) => {
    if (cells.some(isAttentionCell)) plan.attentionRows.add(rowIndex)
  })

  const width = rows.reduce((max, cells) => Math.max(max, cells.length), 0)

  for (let col = 0; col < width; col += 1) {
    let filled = 0
    let numeric = 0
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    for (const cells of rows) {
      const raw = cells[col] ?? ''
      if (stripAttentionMarker(raw).trim() === '') continue
      filled += 1
      const value = parseNumericCell(raw)
      if (value == null) continue
      numeric += 1
      if (value < min) min = value
      if (value > max) max = value
    }

    if (filled === 0) continue
    if (numeric / filled < NUMERIC_COLUMN_RATIO) continue
    if (!(min < max)) continue

    plan.columns.set(col, { index: col, min, max })
  }

  return plan
}

/** Положение значения на шкале колонки, 0..1. */
export function cellHeatRatio(value: number, column: NumericColumn): number {
  const span = column.max - column.min
  if (!(span > 0)) return 0
  const ratio = (value - column.min) / span
  return Math.min(1, Math.max(0, ratio))
}

/**
 * Фон ячейки по её «температуре»: один СПОКОЙНЫЙ нейтральный тон, непрозрачность
 * растёт с величиной (прозрачный → еле заметный серый). Тон берут из токена темы
 * {@link HEAT_COLOR_TOKEN}, а не из хардкода: он остаётся серым во всех темах и
 * не перекрашивается акцентом. `color-mix(… , transparent)` подмешивает не белый,
 * а реальный фон под ячейкой — на тёмной теме заливка не выцветает в молоко.
 *
 * Ничего тёплого здесь быть не должно: жёлто-янтарный акцент закреплён только за
 * строками с «⚠️» (см. {@link attentionBackground}) — это единственный сигнал
 * «посмотри сюда».
 */
export function heatBackground(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  const percent = MIN_HEAT_OPACITY + clamped * (MAX_HEAT_OPACITY - MIN_HEAT_OPACITY)
  return `color-mix(in srgb, var(${HEAT_COLOR_TOKEN}) ${percent.toFixed(1)}%, transparent)`
}

/** Фон строки, помеченной маркером внимания. */
export function attentionBackground(): string {
  return `color-mix(in srgb, var(--color-warning-400) ${ATTENTION_OPACITY}%, transparent)`
}

/** Абзац-вывод («Висновок: …») — его выделяем как лид. */
export function isConclusionParagraph(text: string): boolean {
  return CONCLUSION_PREFIX.test(text)
}
