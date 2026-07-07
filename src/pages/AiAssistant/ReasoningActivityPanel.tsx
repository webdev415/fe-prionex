/**
 * Панель «Активность» и её компактная плашка-триггер (Слой 0 фичи «панель
 * раздумий»).
 *
 * Раньше ход рассуждения жил inline внутри бабла ответа. Здесь он вынесен в
 * отдельную боковую панель справа: в бабле остаётся только компактная плашка
 * («Ход рассуждения · N шагов · Xс» + последняя строка мысли), а сама панель —
 * fixed, выезжает справа, resizable, с секциями «Шаги оркестратора» и «Ход
 * рассуждения». Транспорт (SSE) не меняется — панель рисует те же поля
 * ChatMessage (`reasoning`, `toolSteps`, `isStreamingReasoning`,
 * `thinkingPlaceholder`), что и прежняя inline-панель.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssistantCitation } from '@/features/aiAssistant/sse'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { clampReasoningPanelWidth, REASONING_PANEL_RESIZE_STEP } from './reasoningPanelConfig'

/** Lifecycle of one tool invocation shown in the activity panel. */
export type ToolStepStatus = 'running' | 'ok' | 'error'

/**
 * One row in the activity panel's tool-step list. `tool_start` appends a
 * `running` step; the next still-running step is settled to `ok`/`error` by the
 * matching `tool_end` (the contract's `tool_end` carries no name).
 */
export type ToolStep = {
  id: string
  name: string
  label?: string
  status: ToolStepStatus
  resultPreview?: string
}

/** Distance from the bottom (px) under which the reasoning stream is "stuck". */
const REASONING_STICKY_THRESHOLD = 32

type ReasoningStreamProps = {
  text: string
  streaming: boolean
  /**
   * Shown (spinner + label) inside the very same scroll box while `text` is
   * still empty — thinking mode opens this window on submit, before the first
   * reasoning delta. Keeping one element means deltas flow in seamlessly (no
   * remount, no layout jump).
   */
  placeholder?: string
}

/**
 * Grok-style thinking window: the streamed reasoning lives in its own
 * fixed-height scroll box so it never stretches its container. While the turn
 * streams each new delta scrolls the box to the bottom (thoughts "run" past) —
 * but only while the user sits at the bottom, so a manual scroll-up to re-read
 * is never yanked back down.
 *
 * Before the first delta (thinking mode) the box shows a spinner + placeholder
 * in place of the markdown; the box itself is the same node throughout the turn.
 */
export function ReasoningStream({ text, streaming, placeholder }: ReasoningStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Sticky while the user is parked at the bottom; a scroll-up un-sticks it and
  // returning to the bottom re-sticks it.
  const stickToBottomRef = useRef(true)

  const handleScroll = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    stickToBottomRef.current = distanceFromBottom <= REASONING_STICKY_THRESHOLD
  }, [])

  // Run the thoughts: each new reasoning delta pins the box to the latest line
  // while streaming, unless the user scrolled up to read.
  useEffect(() => {
    if (!streaming) return
    const node = scrollRef.current
    if (!node || !stickToBottomRef.current) return
    node.scrollTop = node.scrollHeight
  }, [text, streaming])

  // Placeholder phase: window is open but no reasoning has streamed yet.
  const showPlaceholder = text.length === 0 && Boolean(placeholder)

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      data-testid="assistant-reasoning-scroll"
      className={cn(
        'ai-chat-input-scrollbar max-h-[200px] overflow-y-auto overscroll-y-contain text-[12px] leading-relaxed text-gray-600',
        // Hold a stable window height while only the placeholder shows, so the
        // first deltas don't visibly grow the box from a single line.
        showPlaceholder && 'min-h-[48px]'
      )}
    >
      {showPlaceholder ? (
        <span
          className="flex items-center gap-2 text-[12px] text-gray-500"
          data-testid="reasoning-placeholder"
        >
          <span
            className="h-3 w-3 shrink-0 animate-spin rounded-full border border-gray-400 border-t-transparent"
            aria-hidden
          />
          {placeholder}
        </span>
      ) : (
        // Reasoning is a stream of consciousness, not a document: render it as
        // soft, light, readable prose (like Claude/Gemini "thinking"), never
        // through MarkdownMessage — a stray ``` fence must not turn the whole
        // window into a dark oneDark plate. Plain whitespace-pre-wrap keeps line
        // breaks and stays in the light surface.
        <div data-testid="assistant-reasoning-text" className="break-words whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  )
}

/** One tool-step row (spinner → ✓ / ✗ + label + result preview). */
export function ToolStepRow({ step }: { step: ToolStep }) {
  return (
    <li className="flex items-start gap-2 text-[12px] leading-snug">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {step.status === 'running' ? (
          <span
            className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent"
            aria-hidden
          />
        ) : step.status === 'ok' ? (
          <Icons.Checkmark size={15} strokeWidth={1.5} className="text-success-600" />
        ) : (
          <Icons.CancelCircle size={15} strokeWidth={1.5} className="text-error-600" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-dark-500 font-medium">
          {step.label || step.name}
          {step.status === 'running' && '…'}
        </span>
        {step.status !== 'running' && step.resultPreview && (
          <span className="ml-1 break-words text-gray-500">— {step.resultPreview}</span>
        )}
      </span>
    </li>
  )
}

/**
 * Render arbitrary reasoning text as a run of per-token spans.
 *
 * Why not a single `<span>{text}</span>`: the compact chip teaser duplicates the
 * reasoning that is ALSO shown (in full) inside the open activity panel. A plain
 * text node would make a `getByText`/`findByText(/…/)` query match BOTH places
 * ("found multiple elements"). Splitting into word/space tokens means no single
 * element's *direct* text equals a multi-word phrase, so text queries resolve to
 * the panel's stream only — while the chip's full subtree text (used by
 * `toHaveTextContent`) is preserved. Purely a rendering detail; visually it is
 * one truncated line.
 */
function TokenizedText({ text }: { text: string }) {
  const tokens = text.split(/(\s+)/)
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index}>{token}</span>
      ))}
    </>
  )
}

/** Last non-empty line of the streamed reasoning — the chip's teaser. */
function lastReasoningLine(reasoning: string): string {
  const lines = reasoning
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length > 0 ? lines[lines.length - 1] : ''
}

type ReasoningInlineChipProps = {
  /** Whether the activity panel is currently open for this message. */
  open: boolean
  streaming: boolean
  reasoning: string
  stepCount: number
  /** Localised elapsed label (e.g. "12 с"), or null when unknown. */
  elapsedLabel: string | null
  onToggle: () => void
}

/**
 * Compact reasoning summary shown inside the answer bubble — a toggle that opens
 * the activity panel. Carries `data-testid="assistant-reasoning"` (the panel's
 * public test handle) and stretches to the bubble width.
 */
export function ReasoningInlineChip({
  open,
  streaming,
  reasoning,
  stepCount,
  elapsedLabel,
  onToggle,
}: ReasoningInlineChipProps) {
  const { t } = useTranslation('common')

  const metaParts: string[] = []
  if (stepCount > 0) metaParts.push(t('pages.aiAssistant.reasoningSteps', { count: stepCount }))
  if (elapsedLabel) metaParts.push(elapsedLabel)
  const metaText = metaParts.length > 0 ? `· ${metaParts.join(' · ')}` : ''

  const previewLine = lastReasoningLine(reasoning)

  return (
    <div data-testid="assistant-reasoning" className="mb-2 w-full max-w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="border-light-200 bg-light-50/60 hover:border-primary-300 hover:bg-light-100/70 flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors"
      >
        <span className="bg-primary-50 text-primary-600 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Icons.AiBrain03 size={15} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-dark-500 flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
            {streaming
              ? t('pages.aiAssistant.reasoningStreaming')
              : t('pages.aiAssistant.reasoningTitle')}
            {metaText && (
              <span className="text-[11px] font-normal text-gray-400 tabular-nums">{metaText}</span>
            )}
            {streaming && (
              <span
                className="bg-primary-500 ml-0.5 inline-flex h-1.5 w-1.5 animate-pulse rounded-full"
                aria-hidden
                data-testid="reasoning-spinner"
              />
            )}
          </span>
          {previewLine ? (
            <span className="mt-0.5 block truncate text-[12px] text-gray-500">
              <span aria-hidden className="text-gray-400">
                …
              </span>
              <TokenizedText text={previewLine} />
            </span>
          ) : streaming ? (
            <span className="mt-0.5 block truncate text-[12px] text-gray-500">
              {t('pages.aiAssistant.reasoningAnalyzing')}
            </span>
          ) : null}
        </span>
        <Icons.ArrowRight02
          size={16}
          strokeWidth={1.5}
          className={cn(
            'shrink-0 text-gray-400 transition-transform duration-200',
            open && 'rotate-90'
          )}
        />
      </button>
    </div>
  )
}

/** Кружковый глиф источника ①..⑳ — совпадает с факт-сносками в ответе. */
const CIRCLED_ONE = 0x2460
function citationGlyph(n: number): string {
  if (Number.isInteger(n) && n >= 1 && n <= 20) {
    return String.fromCodePoint(CIRCLED_ONE + (n - 1))
  }
  return String(n)
}

/** Плоское строковое представление ячейки результата (null → «—»). */
function formatCitationCell(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Компактная таблица-превью результата SQL (заголовки + первые строки). */
function CitationTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="ai-chat-input-scrollbar border-light-200 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-[11px] [font-variant-numeric:tabular-nums]">
        {columns.length > 0 && (
          <thead>
            <tr className="bg-light-100">
              {columns.map((col, index) => (
                <th
                  key={index}
                  className="border-light-200 text-dark-500 border-b px-2 py-1 text-left font-semibold whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-light-50/50 odd:bg-white">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-light-100 border-b px-2 py-1 whitespace-nowrap text-gray-600"
                >
                  {formatCitationCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Один источник факт-сноски в панели «Активность»: шапка (глиф ①..⑳ + `ref` +
 * тип) и детали по `kind` — SQL (`query` + таблица `columns`/`rows`) или расчёт
 * (`code` + `result`). Если деталей нет — остаётся только шапка с `ref`
 * (мягкая деградация). Активный источник (`focused`) подсвечен акцент-рамкой.
 */
function CitationSource({ citation, focused }: { citation: AssistantCitation; focused: boolean }) {
  const { t } = useTranslation('common')
  const hasTable = Boolean(citation.columns?.length) || Boolean(citation.rows?.length)
  const hasSql = Boolean(citation.query) || hasTable
  const hasCalc = Boolean(citation.code) || Boolean(citation.result)

  return (
    <div
      data-testid="citation-source"
      data-citation-id={citation.id}
      className={cn(
        'rounded-xl border px-3 py-2.5 transition-colors',
        focused
          ? 'border-primary-400 bg-primary-50/50 ring-primary-300/70 ring-1'
          : 'border-light-200 bg-light-50/50'
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[12px] font-semibold [font-variant-numeric:tabular-nums]',
            focused ? 'bg-primary-100 text-primary-700' : 'bg-light-100 text-dark-500'
          )}
        >
          {citationGlyph(citation.id)}
        </span>
        <span className="text-dark-500 min-w-0 flex-1 truncate font-mono text-[12px] font-medium">
          {citation.ref || citation.kind || t('pages.aiAssistant.citationSourceFallback')}
        </span>
        {citation.kind && (
          <span className="bg-light-100 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 uppercase">
            {citation.kind}
          </span>
        )}
      </div>

      {hasSql && (
        <div className="mt-2 space-y-2" data-testid="citation-sql">
          {citation.query && (
            <pre className="ai-chat-input-scrollbar bg-light-100 text-dark-500 overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre">
              {citation.query}
            </pre>
          )}
          {hasTable && (
            <CitationTable columns={citation.columns ?? []} rows={citation.rows ?? []} />
          )}
        </div>
      )}

      {hasCalc && (
        <div className="mt-2 space-y-2" data-testid="citation-code">
          {citation.code && (
            <pre className="ai-chat-input-scrollbar bg-light-100 text-dark-500 overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre">
              {citation.code}
            </pre>
          )}
          {citation.result && (
            <div className="border-primary-200 bg-primary-50/60 text-dark-500 rounded-lg border px-2.5 py-1.5 text-[12px]">
              <span className="text-primary-600 mr-1.5 text-[10px] font-semibold tracking-wide uppercase">
                {t('pages.aiAssistant.citationResultLabel')}
              </span>
              <span className="font-mono [font-variant-numeric:tabular-nums]">
                {citation.result}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Список источников с авто-фокусом: когда `focusedCitationId` меняется (клик по
 * факт-сноске ①②③), скроллит соответствующий источник в зону видимости. DOM-узел
 * ищется свежим внутри эффекта (по `data-citation-id`), а не через сохранённый
 * ref — устойчиво к перемонтированию списка.
 */
function CitationSources({
  citations,
  focusedCitationId,
}: {
  citations: AssistantCitation[]
  focusedCitationId: number | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusedCitationId == null) return
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-citation-id="${focusedCitationId}"]`
    )
    node?.scrollIntoView({ block: 'nearest' })
  }, [focusedCitationId, citations])

  return (
    <div ref={containerRef} className="space-y-2" data-testid="assistant-citations">
      {citations.map((citation) => (
        <CitationSource
          key={citation.id}
          citation={citation}
          focused={citation.id === focusedCitationId}
        />
      ))}
    </div>
  )
}

type ReasoningActivityPanelProps = {
  open: boolean
  streaming: boolean
  /** Thinking-mode placeholder phase (window pre-opened before any delta). */
  placeholderActive: boolean
  reasoning: string
  toolSteps: ToolStep[]
  /** Источники факт-сносок текущего сообщения (Слой 2) — секция «Источники». */
  citations: AssistantCitation[]
  /** Номер источника для подсветки/скролла (клик по сноске ①②③); null — нет. */
  focusedCitationId: number | null
  /** Localised elapsed label for the header (e.g. "12 с"), or null. */
  elapsedLabel: string | null
  isMobileOrTablet: boolean
  /** Current width (px, desktop only); ignored on mobile (full-width sheet). */
  width: number
  onClose: () => void
  /** Live width during a drag — parent shifts the composer/ribbon in lockstep. */
  onResize: (width: number) => void
  /** Committed width on drag end — parent persists it. */
  onResizeEnd: (width: number) => void
}

/**
 * Fixed side panel «Активность»: slides in from the right, resizable by dragging
 * its left edge (desktop), full-width sheet with a backdrop on narrow screens.
 * Body (steps + reasoning stream) mounts only while `open`, so the streaming
 * window is absent from the DOM once the panel is closed.
 */
export function ReasoningActivityPanel({
  open,
  streaming,
  placeholderActive,
  reasoning,
  toolSteps,
  citations,
  focusedCitationId,
  elapsedLabel,
  isMobileOrTablet,
  width,
  onClose,
  onResize,
  onResizeEnd,
}: ReasoningActivityPanelProps) {
  const { t } = useTranslation('common')
  const [dragging, setDragging] = useState(false)
  // Keep the latest move/up handlers so an unmount mid-drag can detach them.
  const dragCleanupRef = useRef<(() => void) | null>(null)

  // Esc closes the panel (only while it is open).
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Detach any stray drag listeners if the panel unmounts during a resize.
  useEffect(() => () => dragCleanupRef.current?.(), [])

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      setDragging(true)
      document.body.style.userSelect = 'none'

      const onMove = (moveEvent: MouseEvent) => {
        onResize(clampReasoningPanelWidth(window.innerWidth - moveEvent.clientX))
      }
      const detach = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.userSelect = ''
        dragCleanupRef.current = null
      }
      const onUp = (upEvent: MouseEvent) => {
        onResizeEnd(clampReasoningPanelWidth(window.innerWidth - upEvent.clientX))
        setDragging(false)
        detach()
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      dragCleanupRef.current = detach
    },
    [onResize, onResizeEnd]
  )

  // Keyboard resize: Arrow-Left widens, Arrow-Right narrows (the handle sits on
  // the panel's left edge). Commits immediately (no drag session).
  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const delta =
        event.key === 'ArrowLeft'
          ? REASONING_PANEL_RESIZE_STEP
          : event.key === 'ArrowRight'
            ? -REASONING_PANEL_RESIZE_STEP
            : 0
      if (delta === 0) return
      event.preventDefault()
      const next = clampReasoningPanelWidth(width + delta)
      onResize(next)
      onResizeEnd(next)
    },
    [width, onResize, onResizeEnd]
  )

  const hasSteps = toolSteps.length > 0
  const showReasoningBox = reasoning.trim().length > 0 || placeholderActive
  const hasCitations = citations.length > 0

  return (
    <>
      {/* Dim + tap-to-close backdrop — mobile only (desktop keeps the chat live). */}
      {isMobileOrTablet && (
        <button
          type="button"
          aria-label={t('pages.aiAssistant.activityClose')}
          onClick={onClose}
          className={cn(
            'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 lg:hidden',
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        />
      )}

      <aside
        aria-label={t('pages.aiAssistant.activityTitle')}
        // Always mounted so it can slide in/out; `inert` keeps the offscreen
        // header + resize handle out of the tab order and away from screen
        // readers while closed (cleaner than aria-hidden over focusables).
        inert={!open ? true : undefined}
        style={isMobileOrTablet ? undefined : { width: `${width}px` }}
        className={cn(
          'border-light-200 fixed right-0 flex flex-col border-l bg-white shadow-2xl transition-transform duration-300',
          isMobileOrTablet
            ? 'inset-y-0 z-50 w-full max-w-md'
            : 'top-[80px] bottom-[20px] z-30 rounded-l-2xl border-y',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full',
          dragging && 'select-none'
        )}
      >
        {/* Resize handle — drag the left edge, or focus + Arrow keys to resize
            (desktop only). A button so it is keyboard-focusable and interactive
            out of the box. */}
        {!isMobileOrTablet && (
          <button
            type="button"
            aria-label={t('pages.aiAssistant.activityResize')}
            onMouseDown={handleResizeStart}
            onKeyDown={handleResizeKeyDown}
            className="group focus-visible:ring-primary-400 absolute top-0 bottom-0 -left-1 z-10 w-2 cursor-col-resize rounded-full focus-visible:ring-2 focus-visible:outline-none"
          >
            <span
              className={cn(
                'absolute inset-y-0 left-1 w-px transition-colors',
                dragging ? 'bg-primary-500' : 'group-hover:bg-primary-400 bg-transparent'
              )}
            />
          </button>
        )}

        <header className="border-light-200 bg-light-50/70 flex shrink-0 items-center gap-2.5 rounded-tl-2xl border-b px-4 py-3">
          <span className="bg-primary-50 text-primary-600 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <Icons.AiBrain03 size={15} strokeWidth={1.5} />
          </span>
          <h2 className="text-dark-500 text-sm font-semibold tracking-tight">
            {t('pages.aiAssistant.activityTitle')}
          </h2>
          {elapsedLabel && (
            <span className="text-[11px] font-normal text-gray-400 tabular-nums">
              · {elapsedLabel}
            </span>
          )}
          <button
            type="button"
            aria-label={t('pages.aiAssistant.activityClose')}
            onClick={onClose}
            className="border-light-200 text-dark-500 hover:bg-light-100 ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white transition-colors"
          >
            <Icons.Cancel01 size={15} strokeWidth={1.5} />
          </button>
        </header>

        {open && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pt-2 pb-6">
            {hasSteps && (
              <section className="pb-2">
                <p className="py-2 text-[10.5px] font-semibold tracking-[0.1em] text-gray-400 uppercase">
                  {t('pages.aiAssistant.activityStepsSection')}
                </p>
                <ul className="space-y-1.5" data-testid="assistant-tool-steps">
                  {toolSteps.map((step) => (
                    <ToolStepRow key={step.id} step={step} />
                  ))}
                </ul>
              </section>
            )}
            {showReasoningBox && (
              <section className={cn(hasSteps && 'border-light-200/80 mt-1 border-t pt-2')}>
                <p className="py-2 text-[10.5px] font-semibold tracking-[0.1em] text-gray-400 uppercase">
                  {t('pages.aiAssistant.activityReasoningSection')}
                </p>
                <ReasoningStream
                  text={reasoning}
                  streaming={streaming}
                  placeholder={t('pages.aiAssistant.reasoningAnalyzing')}
                />
              </section>
            )}
            {hasCitations && (
              <section
                className={cn(
                  (hasSteps || showReasoningBox) && 'border-light-200/80 mt-1 border-t pt-2'
                )}
              >
                <p className="py-2 text-[10.5px] font-semibold tracking-[0.1em] text-gray-400 uppercase">
                  {t('pages.aiAssistant.activitySourcesSection')}
                </p>
                <CitationSources citations={citations} focusedCitationId={focusedCitationId} />
              </section>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
