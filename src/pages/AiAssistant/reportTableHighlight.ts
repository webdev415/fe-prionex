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
 * Семантика цвета в таблицах ассистента — «светофор» (решение CEO 24.08):
 *
 *   • жёлтый  = обратить внимание   → маркер `⚠️`
 *   • красный = плохо               → маркер `🔴`
 *   • зелёный = хорошо / величина   → маркер `🟢` и авто-градиент масштаба
 *
 * Авто-градиент (зелёная гамма) показывает МАСШТАБ величины: больше = насыщеннее
 * зелёный. Но градиент не знает направления метрики («просрочка»: больше = хуже),
 * а модель знает — она и ставит маркер В НАЧАЛЕ ячейки строки. Маркер
 * ПЕРЕКРЫВАЕТ авто-градиент: в колонке «больше = хуже» красный маркер строки
 * перебьёт зелёный градиент. Сам знак остаётся в тексте — его видит и тот, кто
 * скопирует таблицу.
 */
export type RowMarker = 'attention' | 'bad' | 'good'

/** Маркер «обратить внимание» (U+26A0 U+FE0F). */
export const ATTENTION_MARKER = '⚠️'

/** Маркер «плохо» (U+1F534). */
export const BAD_MARKER = '🔴'

/** Маркер «хорошо» (U+1F7E2). */
export const GOOD_MARKER = '🟢'

/** Доля разобравшихся ячеек, с которой колонка считается числовой. */
export const NUMERIC_COLUMN_RATIO = 0.7

/**
 * Токен авто-градиента величины: ЗЕЛЁНАЯ гамма. Больше значение — насыщеннее
 * зелёный. Это СОБСТВЕННАЯ переменная зоны ассистента (`--assistant-heat`,
 * задана в `src/index.css`), а НЕ `--color-primary-*`: тот перекрашивается
 * per-accent и под тёплыми акцентами (orange/red/amber) сделал бы «масштаб»
 * тёплым. Своя переменная явно зелёная и осветляется под тёмные темы —
 * читается в любой теме и ни от какого акцента не зависит.
 */
export const HEAT_COLOR_TOKEN = '--assistant-heat'

/** Заливка самой «холодной» числовой ячейки, % непрозрачности. */
export const MIN_HEAT_OPACITY = 2

/** Заливка самой «горячей» числовой ячейки, % непрозрачности. */
export const MAX_HEAT_OPACITY = 14

/**
 * Токен и непрозрачность фона строки по типу маркера-«светофора». Внимание —
 * янтарный статусный токен, плохо — красный статусный (оба НЕ перекрашиваются
 * акцентом), хорошо — усиленный зелёный на собственной переменной зоны
 * (`--assistant-heat-strong`, плотнее авто-градиента `MAX_HEAT_OPACITY`, чтобы
 * явный плюс не путался с обычным максимумом). Все токены осветляются под тёмные
 * темы — текст остаётся читаемым.
 */
export const MARKER_STYLE: Record<RowMarker, { token: string; opacity: number }> = {
  attention: { token: '--color-warning-400', opacity: 14 },
  bad: { token: '--color-error-500', opacity: 18 },
  good: { token: '--assistant-heat-strong', opacity: 22 },
}

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

/**
 * Ведущие маркеры-«светофор» и порядок их проверки. Каждый — с необязательным
 * вариационным селектором U+FE0F и окружающими пробелами. Флаг `u`: `🔴`/`🟢` —
 * астральные символы, без него квантификатор `?` цеплялся бы за суррогат.
 */
const MARKER_PREFIXES: { marker: RowMarker; prefix: RegExp }[] = [
  { marker: 'attention', prefix: /^\s*⚠️?\s*/u },
  { marker: 'bad', prefix: /^\s*🔴️?\s*/u },
  { marker: 'good', prefix: /^\s*🟢️?\s*/u },
]

/** Любой ведущий маркер-«светофор» — для снятия перед разбором числа. */
const ANY_MARKER_PREFIX = /^\s*(?:⚠️?|🔴️?|🟢️?)\s*/u

/**
 * Если строка помечена несколькими разными маркерами, побеждает худший сигнал:
 * плохо > внимание > хорошо (красная строка не должна «позеленеть»).
 */
const MARKER_SEVERITY: Record<RowMarker, number> = { bad: 3, attention: 2, good: 1 }

/** Лид-абзац вывода: «Висновок:», «Підсумок:», «Вывод:» и их множественные. */
const CONCLUSION_PREFIX = /^\s*(?:висновок|висновки|підсумок|вывод|выводы|итог|итоги)\s*:/iu

/** Тип ведущего маркера-«светофора» у ячейки, или `null`. */
export function cellRowMarker(text: string): RowMarker | null {
  if (typeof text !== 'string') return null
  for (const { marker, prefix } of MARKER_PREFIXES) {
    if (prefix.test(text)) return marker
  }
  return null
}

/** Есть ли у ячейки любой ведущий маркер-«светофор». */
export function isMarkerCell(text: string): boolean {
  return ANY_MARKER_PREFIX.test(text)
}

/** Есть ли у ячейки маркер «обратить внимание» (`⚠️`) в начале. */
export function isAttentionCell(text: string): boolean {
  return cellRowMarker(text) === 'attention'
}

/** Текст ячейки без ведущего маркера-«светофора» (в DOM текст не меняется). */
export function stripRowMarker(text: string): string {
  return text.replace(ANY_MARKER_PREFIX, '')
}

/**
 * Число из ячейки украинского отчёта или `null`.
 *
 * Разбирает: `1 209 239.06`, `1 209 239,06`, `48 750,50 грн`, `12,5%`,
 * `−1 234` (юникодный минус), `1,234,567.89`, а также ячейку с ведущим маркером-
 * «светофором» (`⚠️`/`🔴`/`🟢`) — маркер не должен выбивать колонку из числовых.
 *
 * Не разбирает: даты `24.08.2026`, время `09:14`, телефоны и идентификаторы с
 * ведущим нулём (`0671234567`), любой текст.
 */
export function parseNumericCell(raw: string): number | null {
  if (typeof raw !== 'string') return null

  let text = stripRowMarker(raw).trim()
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

/** План раскраски таблицы: числовые колонки и строки с маркерами-«светофором». */
export type TableHighlightPlan = {
  columns: Map<number, NumericColumn>
  markerRows: Map<number, RowMarker>
}

/** Пустой план — таблица рендерится как обычная. */
export function emptyHighlightPlan(): TableHighlightPlan {
  return { columns: new Map(), markerRows: new Map() }
}

/**
 * План раскраски по текстам ячеек тела таблицы (`rows[rowIndex][colIndex]`).
 *
 * Колонка попадает в тепловую карту, если ≥{@link NUMERIC_COLUMN_RATIO} её
 * непустых ячеек — числа И шкала не вырождена (`min < max`): в колонке из
 * одинаковых значений подсвечивать нечего. Строка попадает в `markerRows`, если
 * в любой её ячейке есть ведущий маркер; при разных маркерах побеждает худший
 * ({@link MARKER_SEVERITY}).
 */
export function buildTableHighlightPlan(rows: string[][]): TableHighlightPlan {
  const plan = emptyHighlightPlan()
  if (rows.length === 0) return plan

  rows.forEach((cells, rowIndex) => {
    let best: RowMarker | null = null
    for (const cell of cells) {
      const marker = cellRowMarker(cell)
      if (marker && (best === null || MARKER_SEVERITY[marker] > MARKER_SEVERITY[best])) {
        best = marker
      }
    }
    if (best) plan.markerRows.set(rowIndex, best)
  })

  const width = rows.reduce((max, cells) => Math.max(max, cells.length), 0)

  for (let col = 0; col < width; col += 1) {
    let filled = 0
    let numeric = 0
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY

    for (const cells of rows) {
      const raw = cells[col] ?? ''
      if (stripRowMarker(raw).trim() === '') continue
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
 * Фон ячейки по её «температуре»: зелёная гамма, непрозрачность растёт с
 * величиной (прозрачный → насыщеннее зелёный). Тон берут из токена темы
 * {@link HEAT_COLOR_TOKEN}, а не из хардкода. `color-mix(… , transparent)`
 * подмешивает не белый, а реальный фон под ячейкой — на тёмной теме заливка не
 * выцветает в молоко.
 *
 * Направление метрики градиент не знает: его задаёт маркер строки, который
 * ПЕРЕКРЫВАЕТ этот фон (см. {@link markerBackground}).
 */
export function heatBackground(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  const percent = MIN_HEAT_OPACITY + clamped * (MAX_HEAT_OPACITY - MIN_HEAT_OPACITY)
  return `color-mix(in srgb, var(${HEAT_COLOR_TOKEN}) ${percent.toFixed(1)}%, transparent)`
}

/**
 * Фон строки по типу маркера-«светофора»: жёлтый (внимание), красный (плохо) или
 * усиленный зелёный (хорошо). Токен и плотность — из {@link MARKER_STYLE}.
 */
export function markerBackground(marker: RowMarker): string {
  const { token, opacity } = MARKER_STYLE[marker]
  return `color-mix(in srgb, var(${token}) ${opacity}%, transparent)`
}

/** Абзац-вывод («Висновок: …») — его выделяем как лид. */
export function isConclusionParagraph(text: string): boolean {
  return CONCLUSION_PREFIX.test(text)
}
