import {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
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

/**
 * Long markdown tables (e.g. an employee/client listing) collapse to the first
 * {@link TABLE_PREVIEW_ROWS} body rows behind a "show all (N) / collapse"
 * toggle. Each table folds independently (state is local to this wrapper).
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

  return (
    <div data-testid="markdown-table" className="my-2">
      <div className="overflow-x-auto">
        <table {...props}>
          {head}
          <tbody>{visibleRows}</tbody>
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
          'text-primary-600 underline decoration-dotted underline-offset-2'
        )}
      >
        {glyph}
      </sup>
    )
  }

  return (
    <sup className={FACT_BASE_CLASS}>
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
