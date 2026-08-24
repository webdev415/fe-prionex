import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import plsql from 'react-syntax-highlighter/dist/esm/languages/prism/plsql'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  CLIENT_ID_PROP,
  CLIENT_REF_TAG,
  FACT_NUMBER_PROP,
  FACT_REF_TAG,
  rehypeAssistantMarkers,
} from './assistantMarkers'
import { resolveAssistantSource } from './assistantFiles'
import {
  buildTableHighlightPlan,
  cellHeatRatio,
  heatBackground,
  isAssistantReportTablesEnabled,
  isConclusionParagraph,
  markerBackground,
  parseNumericCell,
  type NumericColumn,
  type TableHighlightPlan,
  isMarkerCell,
  stripRowMarker,
} from './reportTableHighlight'
import {
  AssistantBlockedRef,
  AssistantExternalRef,
  AssistantFileCard,
  AssistantImage,
  AssistantUnresolvableRef,
} from './AssistantFileAttachment'

// Register only the languages the assistant realistically emits — keeps the
// Prism bundle lean (PrismLight ships no languages by default).
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('sh', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('markdown', markdown)
SyntaxHighlighter.registerLanguage('md', markdown)
SyntaxHighlighter.registerLanguage('plsql', plsql)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('py', python)
SyntaxHighlighter.registerLanguage('sql', sql)
SyntaxHighlighter.registerLanguage('tsx', tsx)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('yaml', yaml)
SyntaxHighlighter.registerLanguage('yml', yaml)

/** Default rows shown before a long table/list is folded behind a toggle. */
export const TABLE_PREVIEW_ROWS = 10

/**
 * Признак «рендерим внутри ячейки таблицы ассистента»: его выставляет
 * {@link TableRenderer}, а читает {@link FactFootnote}, чтобы приглушить
 * факт-сноски прямо в `<td>` (в тексте они остаются полноценными).
 */
const AssistantTableCellContext = createContext(false)

/**
 * Класс приглушённой факт-сноски в ячейке таблицы (мельче, полупрозрачна, полная
 * видимость при hover строки). Сами стили — в `src/index.css`; здесь только
 * хук-класс, чтобы приглушение жило исключительно в контексте `<td>`, а источники
 * вне таблиц оставались обычными.
 */
export const MUTED_CITATION_CLASS = 'assistant-cite-muted'

/** Pull plain text out of a React node tree (for the copy-to-clipboard value). */
function nodeToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeToText).join('')
  if (typeof node === 'object' && 'props' in node) {
    return nodeToText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

type CodeBlockProps = {
  language: string | null
  value: string
}

/**
 * Fenced code block: dark syntax-highlighted plate with a rounded body, a
 * horizontal scrollbar for long lines (never breaks the bubble layout) and a
 * hover copy button. Used for ```python / ```sql / ```bash etc.
 */
function CodeBlock({ language, value }: CodeBlockProps) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = value.replace(/\n$/, '')
    const clipboard = navigator.clipboard
    if (!clipboard?.writeText) return
    void clipboard.writeText(text).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        /* clipboard denied — leave the button idle */
      }
    )
  }, [value])

  return (
    <div
      data-testid="markdown-code-block"
      data-language={language ?? undefined}
      className="group/code relative my-2 overflow-hidden rounded-lg bg-[#282c34] text-[0.8125rem]"
    >
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t(copied ? 'pages.aiAssistant.codeCopied' : 'pages.aiAssistant.codeCopy')}
        className={cn(
          'bg-card/10 absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-md border border-white/15 px-1.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm transition',
          'hover:bg-card/20 opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100',
          copied && 'opacity-100'
        )}
      >
        {copied ? (
          <Icons.Checkmark size={12} strokeWidth={2} className="text-success-400" />
        ) : (
          <Icons.Copy size={12} strokeWidth={1.5} />
        )}
        <span>{copied ? t('pages.aiAssistant.codeCopied') : t('pages.aiAssistant.codeCopy')}</span>
      </button>
      <SyntaxHighlighter
        language={language ?? 'text'}
        style={oneDark}
        PreTag="div"
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          padding: '0.75rem 0.875rem',
          background: 'transparent',
          fontSize: 'inherit',
          lineHeight: 1.55,
        }}
        codeTagProps={{
          style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
        }}
      >
        {value.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
}

const CODE_FENCE_RE = /language-(\w+)/

/**
 * react-markdown v10 renders both inline `` `code` `` and fenced blocks through
 * the `code` component (no `inline` prop). A block is recognised by a
 * `language-*` className or a multi-line body; everything else is inline.
 */
function CodeRenderer({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const text = nodeToText(children)
  const match = CODE_FENCE_RE.exec(className ?? '')
  const isBlock = Boolean(match) || text.includes('\n')

  if (isBlock) {
    return <CodeBlock language={match ? match[1] : null} value={text} />
  }

  return (
    <code
      className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.85em]"
      {...props}
    >
      {children}
    </code>
  )
}

/** Собственные пропсы `<tr>`/`<td>`, которые доклеивает раскраска отчёта. */
type DecoratedCellProps = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/** Прямые дети строки таблицы (может быть один элемент, а не массив). */
function rowChildren(row: ReactElement): ReactNode[] {
  const { children } = row.props as DecoratedCellProps
  if (Array.isArray(children)) return children
  return children == null ? [] : [children]
}

/**
 * Ячейка помеченной строки без ведущего маркера-«светофора» в отображении.
 * Маркер — служебный префикс для подсветки: строку красит фон, повторять его
 * значком в тексте не нужно. Вырезаем только ведущую строковую ноду; ячейка
 * без маркера (или с не-строковым началом) возвращается той же ссылкой.
 */
function stripCellMarker(cell: ReactNode): ReactNode {
  if (!isValidElement(cell)) return cell
  const props = cell.props as DecoratedCellProps
  const { children } = props
  const strip = (value: ReactNode): ReactNode =>
    typeof value === 'string' && isMarkerCell(value) ? stripRowMarker(value) : value
  if (typeof children === 'string') {
    const stripped = strip(children)
    if (stripped === children) return cell
    return cloneElement(cell as ReactElement<Record<string, unknown>>, { children: stripped })
  }
  if (Array.isArray(children) && children.length > 0) {
    const first = strip(children[0])
    if (first === children[0]) return cell
    return cloneElement(cell as ReactElement<Record<string, unknown>>, {
      children: [first, ...children.slice(1)],
    })
  }
  return cell
}

/** Тексты ячеек строки — вход для {@link buildTableHighlightPlan}. */
function rowCellTexts(row: ReactNode): string[] {
  if (!isValidElement(row)) return []
  return rowChildren(row).filter(isValidElement).map(nodeToText)
}

/**
 * Ячейка числовой колонки: зелёный градиент по величине (больше = насыщеннее) и
 * полужирный максимум. Направление метрики градиент не знает — его задаёт маркер
 * строки, который перекрывает эту заливку (см. {@link decorateRow}). Нечисловая
 * ячейка внутри числовой колонки (прочерк, «—») остаётся нетронутой — заливать
 * её нечем.
 */
function decorateCell(cell: ReactNode, column: NumericColumn | undefined): ReactNode {
  if (!isValidElement(cell) || !column) return cell
  const props = cell.props as DecoratedCellProps
  const value = parseNumericCell(nodeToText(props.children))
  if (value == null) return cell

  const heat = cellHeatRatio(value, column)
  const isMax = value >= column.max

  return cloneElement(cell as ReactElement<Record<string, unknown>>, {
    className: cn(props.className, isMax && 'font-semibold') || undefined,
    style: { ...props.style, backgroundColor: heatBackground(heat) },
    'data-heat': heat.toFixed(2),
    ...(isMax ? { 'data-heat-max': 'true' } : {}),
  })
}

/**
 * Строка тела таблицы. «Светофор»: маркер строки от модели (⚠️/🔴/🟢)
 * ПЕРЕКРЫВАЕТ авто-градиент — помеченную строку красим целиком (жёлтый/красный/
 * зелёный) и числовые ячейки не трогаем, иначе зелёный градиент проступил бы
 * сквозь красную строку «больше = хуже». Строка без маркера получает обычный
 * зелёный градиент по числовым ячейкам. Сам маркер — СЛУЖЕБНЫЙ символ для этой
 * подсветки: из отображения он вырезается (решение CEO 24.08 «смайлики не
 * нужны» — фон строки говорит сам), в markdown-исходнике ответа он остаётся.
 *
 * Если красить нечего (нечисловая строка без маркера), возвращаем ту же строку,
 * а не её клон: у отчёта без чисел дерево обязано остаться прежним.
 */
function decorateRow(row: ReactNode, rowIndex: number, plan: TableHighlightPlan): ReactNode {
  if (!isValidElement(row)) return row

  const marker = plan.markerRows.get(rowIndex)
  if (marker) {
    const element = row as ReactElement<Record<string, unknown>>
    const props = row.props as DecoratedCellProps
    return cloneElement(element, {
      className: cn(props.className, `assistant-${marker}-row`),
      style: { ...props.style, backgroundColor: markerBackground(marker) },
      'data-row-marker': marker,
      children: rowChildren(row).map(stripCellMarker),
    })
  }

  if (plan.columns.size === 0) return row

  let columnIndex = 0
  let touched = false
  const cells = rowChildren(row).map((cell) => {
    if (!isValidElement(cell)) return cell
    const decorated = decorateCell(cell, plan.columns.get(columnIndex))
    columnIndex += 1
    if (decorated !== cell) touched = true
    return decorated
  })

  if (!touched) return row

  const element = row as ReactElement<Record<string, unknown>>
  return cloneElement(element, { children: cells })
}

/**
 * Long markdown tables (e.g. an employee/client listing) collapse to the first
 * {@link TABLE_PREVIEW_ROWS} body rows behind a "show all (N) / collapse"
 * toggle. Each table folds independently (state is local to this wrapper).
 *
 * За флагом `VITE_ASSISTANT_REPORT_TABLES_ENABLED` таблица дополнительно
 * получает тепловую карту числовых колонок и подсветку строк с «⚠️»; при
 * выключенном флаге разметка та же, что и до доработки.
 */
function TableRenderer({ children, ...props }: ComponentPropsWithoutRef<'table'>) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)

  const childArray = Array.isArray(children) ? children : [children]
  // remark-gfm emits <thead> then <tbody>; keep the head, fold the body rows.
  const head = childArray.find(
    (child) =>
      typeof child === 'object' && child != null && 'type' in child && child.type === 'thead'
  ) as ReactNode
  const body = childArray.find(
    (child) =>
      typeof child === 'object' && child != null && 'type' in child && child.type === 'tbody'
  ) as { props?: { children?: ReactNode } } | undefined

  const bodyRows = body?.props?.children
  const rows = Array.isArray(bodyRows) ? bodyRows : bodyRows != null ? [bodyRows] : []
  const total = rows.length
  const overflows = total > TABLE_PREVIEW_ROWS
  const visibleRows = overflows && !expanded ? rows.slice(0, TABLE_PREVIEW_ROWS) : rows

  // План считаем по ВСЕМ строкам, а не по видимым: шкала колонки не должна
  // прыгать, когда оператор разворачивает таблицу. Разбор текста ячеек не
  // зависит от свёртки, поэтому переживает переключение `expanded`.
  const plan = useMemo(
    () =>
      isAssistantReportTablesEnabled() ? buildTableHighlightPlan(rows.map(rowCellTexts)) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `rows` — новый массив на каждый рендер markdown; ключ пересчёта — сам текст таблицы
    [children]
  )
  const renderedRows = plan
    ? visibleRows.map((row, rowIndex) => decorateRow(row, rowIndex, plan))
    : visibleRows

  // Провайдер оборачивает всю таблицу (DOM не добавляет): факт-сноски в любой
  // ячейке узнают, что они внутри `<td>`, и приглушаются. Разметка без сносок —
  // как была, поэтому байт-в-байт деградация таблиц не ломается.
  return (
    <AssistantTableCellContext.Provider value={true}>
      <div data-testid="markdown-table" className="my-2">
        <div className="overflow-x-auto">
          <table {...props}>
            {head}
            <tbody>{renderedRows}</tbody>
          </table>
        </div>
        {overflows && (
          <button
            type="button"
            data-testid="markdown-table-toggle"
            onClick={() => setExpanded((value) => !value)}
            className="text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
          >
            {expanded ? (
              <>
                <Icons.ArrowUp size={13} strokeWidth={1.5} className="shrink-0" />
                {t('pages.aiAssistant.collapseRows')}
              </>
            ) : (
              <>
                <Icons.ArrowDown size={13} strokeWidth={1.5} className="shrink-0" />
                {t('pages.aiAssistant.showAllRows', { count: total })}
              </>
            )}
          </button>
        )}
      </div>
    </AssistantTableCellContext.Provider>
  )
}

/**
 * Метаданные источника для факт-сноски (тайтл/тултип); приходят со страницы.
 * Опциональные `query`/`columns`/`rows`/`code`/`result` (Слой 2) сама сноска не
 * рендерит — их разворачивает панель «Активность»; поля протянуты сюда, чтобы
 * тип источника оставался единым по всему фронту.
 */
export type MarkdownCitation = {
  id: number
  kind: string
  label?: string
  query?: string
  columns?: string[]
  rows?: unknown[][]
  code?: string
  result?: string
}

// Кружковые цифры ①..⑳ (U+2460..). Дальше 20 — обычные цифры (редкий кейс).
const CIRCLED_ONE = 0x2460

/** Отображаемый глиф сноски: ① для n∈[1,20], иначе просто число. */
function circledNumber(n: number): string {
  if (Number.isInteger(n) && n >= 1 && n <= 20) {
    return String.fromCodePoint(CIRCLED_ONE + (n - 1))
  }
  return String(n)
}

const FACT_BASE_CLASS =
  'ml-0.5 align-super text-[0.72em] font-semibold leading-none [font-variant-numeric:tabular-nums]'

type FactFootnoteProps = {
  n: number
  citation?: MarkdownCitation
  onFactClick?: (n: number) => void
}

/**
 * Надстрочная факт-сноска (①②③…). Если страница передала `onFactClick` —
 * это кликабельный элемент `role="button"` с клавиатурой (Enter/Space),
 * который зовёт колбэк с номером сноски; иначе — статичный глиф-пометка.
 */
function FactFootnote({ n, citation, onFactClick }: FactFootnoteProps) {
  const glyph = circledNumber(n)
  const label = citation?.label
  const title = label ?? `Источник ${n}`
  const interactive = typeof onFactClick === 'function'
  // В ячейке таблицы сноска рядом с числом («46①») — визуальный шум: приглушаем.
  // Вне таблиц (default `false`) источник остаётся обычным — это часть доверия.
  const muted = useContext(AssistantTableCellContext)

  const activate = useCallback(() => {
    onFactClick?.(n)
  }, [onFactClick, n])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onFactClick?.(n)
      }
    },
    [onFactClick, n]
  )

  if (!interactive) {
    return (
      <sup
        data-testid="markdown-fact"
        data-fact-n={n}
        title={title}
        className={cn(
          FACT_BASE_CLASS,
          'text-primary-600 underline decoration-dotted underline-offset-2',
          muted && MUTED_CITATION_CLASS
        )}
      >
        {glyph}
      </sup>
    )
  }

  return (
    <sup className={cn(FACT_BASE_CLASS, muted && MUTED_CITATION_CLASS)}>
      <span
        role="button"
        tabIndex={0}
        data-testid="markdown-fact"
        data-fact-n={n}
        title={title}
        aria-label={label ? `Источник ${n}: ${label}` : `Показать источник факта ${n}`}
        onClick={activate}
        onKeyDown={handleKeyDown}
        className={cn(
          'text-primary-600 hover:text-primary-700 cursor-pointer rounded-sm underline decoration-dotted underline-offset-2 transition-colors',
          'focus-visible:ring-primary-400 focus-visible:ring-2 focus-visible:outline-none'
        )}
      >
        {glyph}
      </span>
    </sup>
  )
}

/**
 * `![alt](path)` из ответа ассистента. Ссылка на файл моста — это то, что
 * ассистент только что построил: график рисуем прямо в пузыре, выгрузку
 * (csv/xlsx) отдаём карточкой. Всё, что ведёт наружу, картинкой НЕ становится:
 * см. {@link resolveAssistantSource}.
 */
function ImageRenderer({ src, alt }: ComponentPropsWithoutRef<'img'>) {
  const resolved = resolveAssistantSource(typeof src === 'string' ? src : undefined)

  switch (resolved.type) {
    case 'internal':
      return resolved.kind === 'image' ? (
        <AssistantImage url={resolved.url} name={resolved.name} alt={alt} />
      ) : (
        <AssistantFileCard
          url={resolved.url}
          name={resolved.name}
          kind={resolved.kind}
          label={alt}
        />
      )
    case 'external':
      return <AssistantExternalRef href={resolved.href} text={alt} />
    // Модель потеряла токен, переписывая свой же ответ. Битый `<img>` тут
    // выглядел бы как поломка CRM — показываем, что ссылку надо перезапросить.
    case 'unresolvable':
      return <AssistantUnresolvableRef text={alt} />
    default:
      return <AssistantBlockedRef text={alt} />
  }
}

/**
 * `[текст](path)`. Ссылка на файл моста превращается в карточку-выгрузку, а не
 * в голый URL. Внешняя ссылка остаётся ссылкой, но открывается только руками
 * оператора. У всего остального href отбирается — текст остаётся, перехода нет.
 */
function LinkRenderer({ href, children }: ComponentPropsWithoutRef<'a'>) {
  const resolved = resolveAssistantSource(href)
  const text = nodeToText(children)

  switch (resolved.type) {
    case 'internal':
      return (
        <AssistantFileCard
          url={resolved.url}
          name={resolved.name}
          kind={resolved.kind}
          label={text}
        />
      )
    case 'external':
      return <AssistantExternalRef href={resolved.href} text={text} />
    default:
      // У ссылки текст и есть содержимое: снимаем href, текст оставляем на
      // месте. Так же обходится и `javascript:` — обезврежено, но не потеряно.
      return <>{children}</>
  }
}

/**
 * Абзац ответа. Если он начинается с «Висновок:» (модель ставит его после
 * таблицы), это лид-вывод: чуть крупнее и полужирнее остального текста, без
 * рамок и заливок — вывод должен читаться первым, а не кричать.
 *
 * Регистрируется только при включённом флаге отчётных таблиц; иначе `p`
 * рендерится штатным рендерером react-markdown.
 */
function ParagraphRenderer({
  children,
  className,
  node: _node,
  ...props
}: ComponentPropsWithoutRef<'p'> & { node?: unknown }) {
  if (!isConclusionParagraph(nodeToText(children))) {
    return (
      <p className={className} {...props}>
        {children}
      </p>
    )
  }

  return (
    <p
      data-testid="markdown-conclusion"
      className={cn(className, 'text-[1.05em] font-medium')}
      {...props}
    >
      {children}
    </p>
  )
}

/** Инлайн-ссылка на карточку клиента `/dashboard/clients/:id` с иконкой. */
function ClientRef({ id, label }: { id: number; label: string }) {
  return (
    <Link
      to={`/dashboard/clients/${id}`}
      data-testid="markdown-client-link"
      data-client-id={id}
      className={cn(
        'text-primary-700 hover:text-primary-800 decoration-primary-300 hover:decoration-primary-500',
        'mx-0.5 inline-flex items-center gap-0.5 align-baseline font-medium underline decoration-1 underline-offset-2 transition-colors'
      )}
    >
      <Icons.User size={13} strokeWidth={1.5} className="shrink-0" />
      {label}
    </Link>
  )
}

/** Пропсы, которые react-markdown отдаёт рендер-компоненту кастомного тега. */
type MarkerRendererProps = {
  node?: { properties?: Record<string, unknown> }
  children?: ReactNode
}

type MarkdownMessageProps = {
  children: string
  className?: string
  /** Колбэк открытия панели-источника по номеру факт-сноски (integration-point). */
  onFactClick?: (n: number) => void
  /** Справочник источников для тайтла/тултипа сносок (по номеру сноски). */
  citations?: MarkdownCitation[]
}

type RehypePlugins = ComponentProps<typeof ReactMarkdown>['rehypePlugins']

/**
 * Shared markdown surface for the assistant: GFM + syntax-highlighted code
 * blocks + foldable long tables + кликабельные факт-сноски `[[N]]` и ссылки на
 * клиента `[[client:id|Имя]]`. Used identically for the answer bubble and the
 * reasoning stream so both render code/tables the same way. Маркеры
 * рендерятся, только если бэкенд их прислал; в остальном поведение прежнее.
 */
export function MarkdownMessage({
  children,
  className,
  onFactClick,
  citations,
}: MarkdownMessageProps) {
  const citationMap = useMemo(() => {
    const map = new Map<number, MarkdownCitation>()
    for (const citation of citations ?? []) map.set(citation.id, citation)
    return map
  }, [citations])

  // Набор id источников хода → плагину, чтобы кружковые глифы `①..⑳` из вывода
  // модели становились кликабельными сносками только там, где источник реально
  // есть. Плагин пересобираем при смене источников (иначе react-markdown держит
  // старый набор id).
  const citationIds = useMemo(() => new Set(citationMap.keys()), [citationMap])
  const rehypePlugins = useMemo<RehypePlugins>(
    () => [[rehypeAssistantMarkers, { citationIds }]],
    [citationIds]
  )

  const components = useMemo(() => {
    const map: Components = {
      code: CodeRenderer,
      // The block wrapper/scroll/highlighting is owned by CodeRenderer → CodeBlock,
      // so `pre` is a transparent passthrough (no nested <pre> styling).
      pre: ({ children: preChildren }) => <>{preChildren}</>,
      table: TableRenderer,
      img: ImageRenderer,
      a: LinkRenderer,
    }

    // Лид-вывод — часть отчётной подачи, поэтому за тем же флагом. При
    // выключенном флаге `p` не переопределяем вовсе: абзац остаётся ровно тем
    // же узлом, что и до доработки.
    if (isAssistantReportTablesEnabled()) {
      map.p = ParagraphRenderer
    }

    // Кастомные теги (`fact-ref`/`client-ref`) не входят в тип Components
    // (это не HTML-элементы), поэтому регистрируем их через Record-обёртку.
    const custom = map as Record<string, unknown>

    custom[FACT_REF_TAG] = function FactRefRenderer({ node }: MarkerRendererProps) {
      const n = Number(node?.properties?.[FACT_NUMBER_PROP])
      if (!Number.isFinite(n)) return null
      return <FactFootnote n={n} citation={citationMap.get(n)} onFactClick={onFactClick} />
    }

    custom[CLIENT_REF_TAG] = function ClientRefRenderer({
      node,
      children: refChildren,
    }: MarkerRendererProps) {
      const id = Number(node?.properties?.[CLIENT_ID_PROP])
      const label = nodeToText(refChildren)
      if (!Number.isFinite(id)) return <>{refChildren}</>
      return <ClientRef id={id} label={label || `#${id}`} />
    }

    return map
  }, [citationMap, onFactClick])

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
