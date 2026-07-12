/**
 * Разбор inline-маркеров ассистента внутри markdown-ответа.
 *
 * Бэкенд встраивает в текст ответа два вида маркеров:
 *   - факт-сноска:        `48 750 ₴[[1]]`               → `[[N]]` (N — целое)
 *   - ссылка на клиента:  `[[client:48213|Коваленко О. П.]]` → id и имя через `|`
 *
 * Здесь — «чистый» разбор строки ({@link splitMarkers}) плюс rehype-плагин
 * ({@link rehypeAssistantMarkers}), который на этапе hast заменяет совпадения
 * на кастомные элементы `fact-ref` / `client-ref`. Рендер этих элементов живёт
 * в `MarkdownMessage` (через маппинг `components` react-markdown), чтобы разбор
 * и отрисовка были разнесены и тестировались независимо.
 */
import type { Element, ElementContent, Root } from 'hast'

/** Тег кастомного hast-элемента для факт-сноски. */
export const FACT_REF_TAG = 'fact-ref'
/** Тег кастомного hast-элемента для ссылки на карточку клиента. */
export const CLIENT_REF_TAG = 'client-ref'

/** hast-свойство, в котором факт-элемент несёт номер сноски (строкой). */
export const FACT_NUMBER_PROP = 'factNumber'
/** hast-свойство, в котором клиент-элемент несёт id клиента (строкой). */
export const CLIENT_ID_PROP = 'clientId'

/** Сегмент разбитого текста: обычный текст, факт-сноска или ссылка на клиента. */
export type MarkerSegment =
  | { type: 'text'; value: string }
  | { type: 'fact'; n: number }
  | { type: 'client'; id: number; label: string }

// Клиент-маркер проверяем ПЕРЕД факт-маркером — оба начинаются с `[[`.
// Метка клиента не может содержать `]`, поэтому `[^\]]+` безопасно доходит до `]]`.
const MARKER_RE = /\[\[client:(\d+)\|([^\]]+)\]\]|\[\[(\d+)\]\]/g

/**
 * Разбить строку на текстовые и маркерные сегменты. Чистая функция — не зависит
 * от React/hast, поэтому легко тестируется отдельно.
 *
 * Строка без маркеров превращается в единственный `text`-сегмент (то есть
 * рендер такого текста остаётся прежним). Некорректные/неполные маркеры
 * (`[[abc]]`, `[[1`, `[[client:5]]` без имени) не совпадают с regex и остаются
 * обычным текстом.
 */
export function splitMarkers(text: string): MarkerSegment[] {
  const segments: MarkerSegment[] = []
  let lastIndex = 0
  MARKER_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = MARKER_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }

    if (match[1] !== undefined) {
      segments.push({ type: 'client', id: Number(match[1]), label: match[2].trim() })
    } else {
      segments.push({ type: 'fact', n: Number(match[3]) })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

/** Есть ли в строке хотя бы один валидный маркер (быстрая проверка перед разбором). */
export function hasMarkers(text: string): boolean {
  MARKER_RE.lastIndex = 0
  const found = MARKER_RE.test(text)
  MARKER_RE.lastIndex = 0
  return found
}

// Кружковые цифры ①..⑳ (U+2460..U+2473) = сноски 1..20 (совпадает с прямым
// маппингом `circledNumber` в MarkdownMessage). Некоторые модели вместо маркера
// `[[N]]` «услужливо» рисуют уже готовый глиф — тогда сноска остаётся обычным
// текстом, потому что трансформер ищет `[[N]]`. Возвращаем глиф в канонический
// маркер, но ТОЛЬКО для номеров, у которых реально есть источник (`citationIds`):
// иначе это не сноска, а часть текста (нумерованный список и т.п.) — не трогаем.
const CIRCLED_FOOTNOTE_ONE = 0x2460 // ①
const CIRCLED_FOOTNOTE_RE = /[①-⑳]/g

/**
 * Заменить кружковые глифы-сноски `①..⑳` на канонический маркер `[[N]]`, но
 * только для номеров из `citationIds` (у которых есть источник). Пустой набор →
 * строка не меняется (полный no-op — старое поведение). Чистая функция.
 */
export function normalizeCircledFootnotes(text: string, citationIds: ReadonlySet<number>): string {
  if (citationIds.size === 0) return text
  return text.replace(CIRCLED_FOOTNOTE_RE, (glyph) => {
    const n = (glyph.codePointAt(0) ?? 0) - CIRCLED_FOOTNOTE_ONE + 1
    return citationIds.has(n) ? `[[${n}]]` : glyph
  })
}

// Внутри код-блоков (` ``` ` и inline `` `code` ``) маркеры не трогаем —
// иначе сломаем подсветку и потеряем текст маркера.
const SKIP_TAGS = new Set(['code', 'pre'])

function segmentToNode(seg: MarkerSegment): ElementContent {
  if (seg.type === 'text') {
    return { type: 'text', value: seg.value }
  }
  if (seg.type === 'fact') {
    return {
      type: 'element',
      tagName: FACT_REF_TAG,
      properties: { [FACT_NUMBER_PROP]: String(seg.n) },
      children: [],
    }
  }
  return {
    type: 'element',
    tagName: CLIENT_REF_TAG,
    properties: { [CLIENT_ID_PROP]: String(seg.id) },
    // Метку кладём текстовым потомком → рендер-компонент читает её как children.
    children: [{ type: 'text', value: seg.label }],
  }
}

function transformChildren(node: Root | Element, citationIds: ReadonlySet<number>): void {
  const source = node.children as ElementContent[]
  const result: ElementContent[] = []
  let changed = false

  for (const child of source) {
    if (child.type === 'text') {
      // Сначала возвращаем кружковые глифы-сноски в маркер `[[N]]` (по источникам),
      // затем — обычный разбор. Глиф без источника нормализация не трогает, тогда
      // `hasMarkers` ложно и текстовый узел остаётся как был.
      const value = normalizeCircledFootnotes(child.value, citationIds)
      if (hasMarkers(value)) {
        for (const seg of splitMarkers(value)) {
          result.push(segmentToNode(seg))
        }
        changed = true
        continue
      }
    }

    if (child.type === 'element' && !SKIP_TAGS.has(child.tagName)) {
      transformChildren(child, citationIds)
    }
    result.push(child)
  }

  if (changed) {
    node.children = result as Element['children']
  }
}

/** Настройки rehype-плагина сносок. */
export type AssistantMarkerOptions = {
  /**
   * id источников хода: только для этих номеров кружковый глиф `①..⑳` станет
   * кликабельной сноской `[[N]]`. Не передан/пуст → глифы не трогаем (сноска
   * работает лишь по явному `[[N]]` от бэкенда — прежнее поведение).
   */
  citationIds?: ReadonlySet<number>
}

const NO_CITATION_IDS: ReadonlySet<number> = new Set()

/**
 * rehype-плагин: обходит дерево и заменяет текстовые вхождения маркеров на
 * кастомные элементы `fact-ref` / `client-ref`. Не заходит в `code`/`pre`.
 * Кружковые глифы-сноски `①..⑳` из вывода модели приводятся к `[[N]]` для
 * номеров из `citationIds` (см. {@link normalizeCircledFootnotes}).
 */
export function rehypeAssistantMarkers(options: AssistantMarkerOptions = {}) {
  const citationIds = options.citationIds ?? NO_CITATION_IDS
  return function transform(tree: Root): void {
    transformChildren(tree, citationIds)
  }
}
