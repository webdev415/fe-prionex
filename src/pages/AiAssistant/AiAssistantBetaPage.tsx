import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebarStore'
import { Textarea } from '@/components/ui/Textarea'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  aiAssistantKeys,
  useAssistantConversation,
  useExpertCapability,
  useMarkCitation,
  useSendAssistantMessage,
  useSendFeedback,
} from '@/features/aiAssistant/hooks'
import {
  AssistantChatStreamError,
  SOFT_DENIED_REASON_CODES,
  type AssistantCitationVerdict,
  type AssistantExpertCapability,
  type AssistantFeedbackComprehension,
  type AssistantFeedbackRating,
} from '@/features/aiAssistant/api'
import { normalizeCitations } from '@/features/aiAssistant/sse'
import type {
  AssistantCitation,
  AssistantExpertUsage,
  AssistantSources,
} from '@/features/aiAssistant/sse'
import { useQueryClient } from '@tanstack/react-query'
import {
  ATTACHMENT_ACCEPT,
  blobToBase64,
  extractFileEntries,
  formatAttachmentSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  toChatAttachmentPayload,
  validateAttachmentFile,
  type AttachmentType,
  type PendingAttachment,
} from '@/features/aiAssistant/attachments'
import {
  buildContextualMessage,
  contextChipLabel,
  ONEX_ASK_SUMMARY_PROMPT,
  stripOnexContextBlock,
  type OnexPageContext,
} from '@/features/onexEmbed/embedContext'
import {
  useIsOnexDockEmbed,
  useOnexAsk,
  useOnexDockReady,
  useOnexPageContext,
} from '@/features/onexEmbed/hooks'
import { useServerDictation } from '@/features/aiAssistant/useServerDictation'
import {
  useVoiceMessageRecorder,
  type VoiceMessageResult,
} from '@/features/aiAssistant/useVoiceMessageRecorder'
import { prepareTtsText, resolveTtsVoice, useTtsPlayer } from '@/features/aiAssistant/tts'
import { useAuthStore } from '@/stores/authStore'
import { useAiAssistantSettings } from '@/features/aiSettings/hooks/useAiAssistantSettings'
import {
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
  type AssistantSettings,
  type AssistantVoiceMaxDuration,
  type AssistantVoiceSilenceTimeout,
} from '@/stores/aiAssistantStore'
import type { AssistantConversationDetail, AssistantMode } from '@/features/aiAssistant/api'
import { isAxiosError } from 'axios'
import {
  isNewConversationParam,
  NEW_CONVERSATION_PARAM_VALUE,
  parseConversationParam,
  writeConversationParam,
} from './conversationUrl'
import { ANSWER_POLL_INTERVAL_MS, ANSWER_POLL_MAX_MS } from './answerPolling'
import { ConversationSidebar } from './ConversationSidebar'
import { ContextUsageRing } from './ContextUsageRing'
import { extractContextUsage, type ContextUsageSnapshot } from './contextUsage'
import { SlashCommandMenu } from './SlashCommandMenu'
import { exactSlashCommand, matchSlashCommands, type SlashCommand } from './slashCommands'
import { getDockDesktopBoxClasses, getDockRightOffset } from './dockGeometry'
import { MarkdownMessage, type MarkdownCitation } from './MarkdownMessage'
import {
  ReasoningActivityPanel,
  ReasoningInlineChip,
  type ToolStep,
  type ToolStepStatus,
} from './ReasoningActivityPanel'
import { piiProps } from '@/lib/openreplay/pii'
import { PiiTooltip } from '@/components/ui/PiiTooltip'

const QUICK_ACTION_KEYS = ['quickClientData', 'quickDebt', 'quickReport', 'quickEmployee'] as const
type QuickActionKey = (typeof QUICK_ACTION_KEYS)[number]

/** Icon per CRM quick-action, shown in the composer "+" hub. */
const QUICK_ACTION_ICONS: Record<QuickActionKey, (typeof Icons)[keyof typeof Icons]> = {
  quickClientData: Icons.UserSearch01,
  quickDebt: Icons.Money04,
  quickReport: Icons.Chart01,
  quickEmployee: Icons.UserCheck01,
}

/** Silence-timeout choices (seconds) offered in voice settings. */
const VOICE_SILENCE_OPTIONS: AssistantVoiceSilenceTimeout[] = [1.5, 2, 3]
/** Max-recording-length choices (seconds) offered in voice settings. */
const VOICE_MAX_DURATION_OPTIONS: AssistantVoiceMaxDuration[] = [30, 60, 120]

/**
 * Короткое имя экспертной модели для меню и бейджа («Sonnet», «Opus»).
 * Незнакомая модель показывается своим идентификатором: список приходит с
 * бэкенда, и новая модель должна появляться в меню без релиза фронта.
 */
const EXPERT_MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-5': 'Sonnet',
  'claude-opus-5': 'Opus',
}

/** Однострочная подсказка под моделью — только для известных моделей. */
const EXPERT_MODEL_HINT_KEYS: Record<string, string> = {
  'claude-sonnet-5': 'pages.aiAssistant.expertSonnetHint',
  'claude-opus-5': 'pages.aiAssistant.expertOpusHint',
}

function expertModelLabel(model: string): string {
  return EXPERT_MODEL_LABELS[model] ?? model
}

/**
 * Деньги в бейдже: «$0.05». Ход дешевле цента показывается с четырьмя знаками
 * («$0.0007»), иначе округление до копеек превратило бы его в «$0.00» — а «ход
 * стоил ноль» и «ход стоил меньше цента» это разные утверждения.
 */
function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return `$${amount.toFixed(4)}`
  return `$${amount.toFixed(2)}`
}

/**
 * Подпись с токенами для тултипа ценника.
 *
 * Вход считается ВМЕСТЕ с кэшем: у Claude повторный контекст берётся из кэша, и
 * `input_tokens` показывает только «свежую» часть. На живом ходе 27.08 это были
 * 4 токена при реальном входе 32 442 из кэша — подпись «4 токена на вхід»
 * читалась бы как поломка счётчика. Когда кэш участвовал, его объём называем
 * отдельно, чтобы видно было, откуда взялась большая цифра.
 *
 * Нет ни входа, ни выхода — тултипа нет вовсе (пустая подсказка бесполезна).
 */
function expertTokensTitle(
  usage: AssistantExpertUsage,
  t: (key: string, options?: Record<string, unknown>) => string
): string | undefined {
  if (usage.inputTokens == null || usage.outputTokens == null) return undefined
  const cached = usage.cacheReadTokens ?? 0
  const input = usage.inputTokens + cached
  return cached > 0
    ? t('pages.aiAssistant.expertTokensCached', {
        input,
        cached,
        output: usage.outputTokens,
      })
    : t('pages.aiAssistant.expertTokens', {
        input,
        output: usage.outputTokens,
      })
}

const COMPOSER_DROPDOWN_TRIGGER_CLASS =
  'text-foreground inline-flex h-9 min-h-9 w-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-light shadow-none sm:h-8 sm:min-h-0 sm:w-32 sm:flex-none'

type AssistDropdownProps = {
  ariaLabel: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

type ChatRole = 'user' | 'assistant'

/** Attachment rendered inside a feed bubble (object URL lives client-side only). */
type LocalAttachment = {
  type: AttachmentType
  mime: string
  url: string
  /** File name — the whole card for a document, absent for a voice note. */
  name?: string
  sizeBytes?: number
}

/** A picked file being encoded into base64 — a placeholder card in the composer. */
type PreparingAttachment = {
  id: string
  name: string
  sizeBytes: number
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  isLoading?: boolean
  /** Text shown next to the typing dots while loading (e.g. "thinking…"). */
  loadingLabel?: string
  isError?: boolean
  serverMessageId?: number
  attachments?: LocalAttachment[]
  /** "Source of the numbers" block (tables + tools) streamed after the answer. */
  sources?: AssistantSources
  /** Per-fact citations (`[[N]]` → источник) streamed in the `citations` frame. */
  citations?: AssistantCitation[]
  /** Suggested follow-up questions rendered as clickable chips. */
  followups?: string[]
  /** Accumulated `reasoning` deltas — the agent's streamed thoughts. */
  reasoning?: string
  /** Tool invocations surfaced during the turn (in start order). */
  toolSteps?: ToolStep[]
  /** True while reasoning/tool events are still streaming for this turn. */
  isStreamingReasoning?: boolean
  /**
   * Thinking-mode only: open the "Ход рассуждения" window immediately on submit
   * with a spinner + placeholder, before the first reasoning delta. Real deltas
   * then flow into the same window (no remount / layout jump). Cleared once the
   * turn settles.
   */
  thinkingPlaceholder?: boolean
  /** Epoch ms when the reasoning turn began — drives the "Xс" chip/panel timer. */
  reasoningStartedAt?: number
  /** Frozen reasoning duration (ms) once the turn settles. */
  reasoningElapsedMs?: number
  /**
   * Экспертный ход: модель, которую ждём. Живёт только пока ход идёт — питает
   * подпись со своим секундным тиком («Sonnet аналізує… 24 с»), чтобы 30–40
   * секунд внешнего ответа не выглядели зависанием.
   */
  expertWaitingModel?: string
  /** Расход экспертного хода (фрейм `result`) — бейдж «Sonnet · $0.05». */
  expert?: AssistantExpertUsage
}

/**
 * Подпись ожидания экспертного хода с СОБСТВЕННЫМ секундным тиком.
 *
 * Обычный ход перерисовывается на каждой дельте, и таймеру хватает чужих
 * рендеров; экспертный ход молчит десятки секунд — без своего интервала
 * счётчик замер бы на «0 с» и читался бы как зависание.
 */
function ExpertWaitingLabel({ model }: { model: string }) {
  const { t } = useTranslation('common')
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <span
      data-testid="assistant-expert-waiting"
      className="text-muted-foreground ml-1.5 text-xs font-light"
    >
      {t('pages.aiAssistant.expertWaiting', { model: expertModelLabel(model), seconds })}
    </span>
  )
}

function joinDictation(prev: string, text: string): string {
  if (!prev) return text
  return /\s$/.test(prev) ? `${prev}${text}` : `${prev} ${text}`
}

/** Whisper language hint; empty string → server-side auto-detection. */
function resolveDictationLanguage(language?: string): string {
  if (!language) return ''
  if (language.startsWith('uk')) return 'uk'
  if (language.startsWith('ru')) return 'ru'
  if (language.startsWith('en')) return 'en'
  return ''
}

function formatRecordingTime(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Reasoning elapsed for the chip/panel timer: the frozen duration once settled,
 * otherwise live from the start marker (updates as the component re-renders on
 * streamed deltas — no interval needed). Null when the turn has no start marker.
 */
function reasoningElapsedMs(item: ChatMessage, now: number): number | null {
  if (item.reasoningElapsedMs != null) return item.reasoningElapsedMs
  if (item.reasoningStartedAt != null) return Math.max(0, now - item.reasoningStartedAt)
  return null
}

/** "12 с" under a minute, "1:05" beyond — the chip/panel duration label. */
function formatReasoningDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec} с`
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Whether an assistant message has a reasoning surface to show — real reasoning,
 * tool-steps, or the thinking-mode pre-open placeholder. Gates both the bubble
 * chip and the width stretch of the bubble.
 */
function messageHasReasoning(item: ChatMessage): boolean {
  return (
    Boolean(item.reasoning && item.reasoning.trim()) ||
    Boolean(item.toolSteps && item.toolSteps.length > 0) ||
    Boolean(item.thinkingPlaceholder)
  )
}

/**
 * Есть ли у сообщения ЧТО показать в панели «Активность» — рассуждение/шаги
 * (см. {@link messageHasReasoning}) ИЛИ источники факт-сносок (Слой 2). Шире, чем
 * `messageHasReasoning`: клик по сноске `[[N]]` в fast-ходе без рассуждения тоже
 * должен открывать панель (там будут только «Источники»). Гейтит выбор активного
 * сообщения панели, но НЕ бабл-чип «Ход рассуждения» (тот остаётся по reasoning).
 *
 * `showReasoning` — настройка оператора «показывать раздумья»: когда она снята,
 * само рассуждение перестаёт быть поводом открывать панель, а шаги оркестратора и
 * источники — остаются (по ним проверяют факты ответа, это не раздумья).
 */
function messageHasActivity(item: ChatMessage, showReasoning: boolean): boolean {
  if (showReasoning && messageHasReasoning(item)) return true
  return (
    Boolean(item.toolSteps && item.toolSteps.length > 0) ||
    Boolean(item.citations && item.citations.length > 0)
  )
}

/**
 * Привести SSE-цитаты (`{id, kind, ref}`) к форме, которую понимает
 * {@link MarkdownMessage} (`{id, kind, label}`): `label` — человекочитаемая
 * подпись для тайтла/тултипа сноски (берём `ref`, иначе `kind`). Возвращает
 * `undefined`, когда цитат нет, чтобы проп остался опциональным.
 */
function mapCitations(citations?: AssistantCitation[]): MarkdownCitation[] | undefined {
  if (!citations || citations.length === 0) return undefined
  return citations.map((citation) => ({
    id: citation.id,
    kind: citation.kind,
    label: citation.ref.trim() || citation.kind || undefined,
    query: citation.query,
    columns: citation.columns,
    rows: citation.rows,
    code: citation.code,
    result: citation.result,
  }))
}

const LONG_PRESS_MS = 500

/** Стабильная пустая карта пометок — чтобы не минтить новый объект на рендер. */
const EMPTY_CITATION_MARKS: Record<number, AssistantCitationVerdict> = {}

type MessageFeedback = {
  rating?: AssistantFeedbackRating
  comprehension?: AssistantFeedbackComprehension
}

// Styling for markdown produced by the assistant (no typography plugin in the
// project, so element styles are scoped to the message bubble via arbitrary
// variants).
const MARKDOWN_BODY_CLASS = [
  'text-sm leading-relaxed break-words',
  '[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5',
  '[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold',
  '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_table]:my-2 [&_table]:block [&_table]:w-fit [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_table]:text-xs sm:[&_table]:text-sm',
  '[&_th]:bg-muted [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  // Code styling (inline + fenced blocks) is owned by MarkdownMessage's custom
  // code renderer (syntax highlight + copy + horizontal scroll).
  '[&_a]:text-primary-600 [&_a]:underline',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_hr]:my-3 [&_hr]:border-border',
  '[&_strong]:font-semibold',
  '[&_em]:italic',
].join(' ')

type SpeechRecognitionResultLike = { readonly isFinal: boolean; 0: { transcript: string } }

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionErrorEventLike = { error: string }

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function resolveSpeechLang(language?: string): string {
  if (!language) return 'en-US'
  if (language.startsWith('uk')) return 'uk-UA'
  return 'en-US'
}

/** Icon for a non-image attachment: a sheet for tabular data, a page otherwise. */
function AttachmentIcon({ mime }: { mime: string }) {
  const isSpreadsheet =
    mime === 'text/csv' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return isSpreadsheet ? (
    <Icons.Csv02 size={20} strokeWidth={1.5} className="text-primary-600 shrink-0" />
  ) : (
    <Icons.File size={20} strokeWidth={1.5} className="text-primary-600 shrink-0" />
  )
}

/**
 * OneX dock: the page the operator is looking at in the main pane, shown above
 * the composer so it is obvious *before* sending what the assistant will be
 * told about. ✕ drops it; sending a message consumes it.
 */
function OnexContextChip({ context, onClear }: { context: OnexPageContext; onClear: () => void }) {
  const { t } = useTranslation('common')
  const label =
    contextChipLabel(context) ??
    (context.clientId !== null
      ? t('pages.aiAssistant.onexContextClientFallback', { id: context.clientId })
      : t('pages.aiAssistant.onexContextPageFallback'))

  return (
    <div
      className="border-primary-200 bg-primary-50/60 text-foreground mb-2 flex items-center gap-2 rounded-xl border border-dashed px-2.5 py-1.5 text-xs font-light"
      data-testid="onex-context-chip"
    >
      <Icons.Link01 size={14} strokeWidth={1.5} className="text-primary-600 shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={context.url ?? undefined}>
        {t('pages.aiAssistant.onexContextChip', { label })}
      </span>
      <button
        type="button"
        aria-label={t('pages.aiAssistant.onexContextClear')}
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

function AssistFilterDropdown({ ariaLabel, value, options, onChange }: AssistDropdownProps) {
  const label = useMemo(
    () => options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '',
    [options, value]
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={ariaLabel} className={COMPOSER_DROPDOWN_TRIGGER_CLASS}>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className="text-foreground text-sm font-light"
            onSelect={() => onChange(o.value)}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type ModeDropdownProps = {
  value: AssistantMode
  onChange: (mode: AssistantMode) => void
  /** Настройка «показывать раздумья» — живёт рядом с выбором режима. */
  showReasoning: boolean
  onShowReasoningChange: (show: boolean) => void
  /**
   * Экспертный режим этого сотрудника. Пункт «Експерт (Claude)» рисуется только
   * когда режим включён И разрешён: у оператора его в меню нет вовсе.
   */
  expert: AssistantExpertCapability
  /** Выбранная экспертная модель или `null` — идёт обычный ход (fast/thinking). */
  expertModel: string | null
  onSelectExpert: (model: string) => void
}

const MODE_OPTIONS: {
  mode: AssistantMode
  Icon: (typeof Icons)[keyof typeof Icons]
  iconClass: string
  labelKey: string
  hintKey: string
}[] = [
  {
    mode: 'fast',
    Icon: Icons.Flash,
    iconClass: 'text-warning-500',
    labelKey: 'pages.aiAssistant.modeFastShort',
    hintKey: 'pages.aiAssistant.modeFastHint',
  },
  {
    mode: 'thinking',
    Icon: Icons.AiBrain03,
    iconClass: 'text-primary-500',
    labelKey: 'pages.aiAssistant.modeThinkingShort',
    hintKey: 'pages.aiAssistant.modeThinkingHint',
  },
]

/**
 * Compact reasoning-mode picker shown to the right of the composer (Claude
 * "Effort" / ChatGPT model-tier style): the trigger shows the current mode, the
 * menu lists fast/thinking with a one-line hint each. This dropdown is the
 * single source of truth for `mode`; the settings popover no longer sets it.
 *
 * Implemented as a small controlled popover (not Radix) so it opens on a plain
 * click and renders inline — matching the settings popover in this component.
 *
 * Под списком режимов — тумблер «Показывать раздумья»: раздумья приходят только
 * в режиме «Думает», поэтому настройка их видимости стоит там же, где режим — и
 * показывается ровно в этом режиме (на fast и в экспертном ходе прятать нечего).
 */
function ModeDropdown({
  value,
  onChange,
  showReasoning,
  onShowReasoningChange,
  expert,
  expertModel,
  onSelectExpert,
}: ModeDropdownProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isThinking = value === 'thinking'
  const isExpert = expertModel != null
  /**
   * Отказ, при котором пункт остаётся на виду, но выбрать нечего: дневной
   * бюджет исчерпан либо учёт трат недоступен. Прятать здесь нельзя — у
   * руководителя пункт молча исчез бы вместо честного «ліміт вичерпано».
   * Отказ по роли (и выключенный режим) прячется, как и раньше.
   */
  const isSoftDenied =
    !expert.allowed &&
    expert.reasonCode != null &&
    SOFT_DENIED_REASON_CODES.includes(expert.reasonCode)
  // Пункт экспертного режима существует только с разрешения бэкенда и только
  // при непустом списке моделей — выбирать «Експерт» без модели нечего.
  const showExpertSection =
    expert.enabled && (expert.allowed || isSoftDenied) && expert.models.length > 0
  const ActiveIcon = isExpert ? Icons.Sparkles : isThinking ? Icons.AiBrain03 : Icons.Flash

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:flex-none">
      <button
        type="button"
        aria-label={t('pages.aiAssistant.mode')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="assistant-mode-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          COMPOSER_DROPDOWN_TRIGGER_CLASS,
          'hover:border-primary-300 hover:text-primary-600 transition-colors'
        )}
      >
        <ActiveIcon
          size={15}
          strokeWidth={1.5}
          className={isExpert || isThinking ? 'text-primary-500' : 'text-warning-500'}
        />
        <span className="min-w-0 truncate">
          {isExpert
            ? t('pages.aiAssistant.expertTrigger', { model: expertModelLabel(expertModel) })
            : isThinking
              ? t('pages.aiAssistant.modeThinkingShort')
              : t('pages.aiAssistant.modeFastShort')}
        </span>
        <Icons.ArrowDown size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="assistant-mode-menu"
          className="border-border bg-card ring-border/40 absolute right-0 bottom-full z-30 mb-2 w-64 overflow-hidden rounded-xl border p-1 shadow-lg ring-1"
        >
          {MODE_OPTIONS.map(({ mode, Icon, iconClass, labelKey, hintKey }) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={!isExpert && value === mode}
              onClick={() => {
                onChange(mode)
                setOpen(false)
              }}
              className="hover:bg-muted/70 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
            >
              <Icon size={16} strokeWidth={1.5} className={cn('mt-0.5 shrink-0', iconClass)} />
              <span className="min-w-0 flex-1">
                <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                  {t(labelKey)}
                  {!isExpert && value === mode && (
                    <Icons.Checkmark
                      size={14}
                      strokeWidth={2}
                      className="text-primary-500 shrink-0"
                    />
                  )}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug font-light">
                  {t(hintKey)}
                </span>
              </span>
            </button>
          ))}

          {/* Экспертный режим: вопрос уходит во внешний Claude. Секции нет
              вовсе, если бэкенд не подтвердил доступ — у оператора этот пункт
              не должен даже мелькать. */}
          {showExpertSection && (
            <div
              className="border-border/70 mt-1 border-t pt-1"
              data-testid="assistant-expert-section"
            >
              <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-0.5">
                <Icons.Sparkles size={14} strokeWidth={1.5} className="text-primary-500 shrink-0" />
                <span className="text-foreground text-[11px] font-semibold tracking-tight">
                  {t('pages.aiAssistant.expertTitle')}
                </span>
              </div>

              {expert.models.map((model) => {
                const hintKey = EXPERT_MODEL_HINT_KEYS[model]
                return (
                  <button
                    key={model}
                    type="button"
                    role="menuitemradio"
                    aria-checked={expertModel === model}
                    // Бюджет исчерпан / учёт трат недоступен: модель видно, но
                    // выбрать нельзя — ход всё равно упёрся бы в 429.
                    disabled={isSoftDenied}
                    data-testid={`assistant-expert-model-${model}`}
                    onClick={() => {
                      onSelectExpert(model)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      isSoftDenied ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/70'
                    )}
                  >
                    <Icons.Sparkles
                      size={16}
                      strokeWidth={1.5}
                      className="text-primary-500 mt-0.5 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                        {expertModelLabel(model)}
                        {expertModel === model && (
                          <Icons.Checkmark
                            size={14}
                            strokeWidth={2}
                            className="text-primary-500 shrink-0"
                          />
                        )}
                      </span>
                      {hintKey && (
                        <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug font-light">
                          {t(hintKey)}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}

              {/* Куда уходит запрос и сколько бюджета осталось — рядом с
                  выбором, а не спрятано в настройках. */}
              <div className="text-muted-foreground space-y-1 px-2.5 pt-1 pb-1.5 text-[11px] leading-snug font-light">
                <span className="flex items-start gap-1.5" data-testid="assistant-expert-external">
                  <Icons.Link01 size={13} strokeWidth={1.5} className="mt-px shrink-0" />
                  {t('pages.aiAssistant.expertExternalNotice')}
                </span>
                {expert.dailyLimitUsd != null && expert.spentTodayUsd != null && (
                  <span className="block" data-testid="assistant-expert-budget">
                    {t('pages.aiAssistant.expertBudget', {
                      spent: formatUsd(expert.spentTodayUsd),
                      limit: formatUsd(expert.dailyLimitUsd),
                    })}
                  </span>
                )}
                {/* Почему выбрать нельзя — словами бэкенда (украинский текст
                    уже написан для человека и несёт суммы). */}
                {isSoftDenied && expert.reason && (
                  <span
                    className="text-warning-700 block font-medium"
                    data-testid="assistant-expert-reason"
                  >
                    {expert.reason}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Раздумья приходят только в режиме «Думаючий»: на fast их не бывает,
              а экспертный ход уходит во внешний Claude. Прятать тумблер честнее,
              чем показывать настройку, которой в текущем режиме нечего скрывать. */}
          {isThinking && !isExpert && (
            <div
              className="border-border/70 mt-1 flex items-start gap-2.5 border-t px-2.5 pt-2.5 pb-1.5"
              data-testid="assistant-show-reasoning-row"
            >
              <Icons.AiBrain03
                size={16}
                strokeWidth={1.5}
                className="text-muted-foreground mt-0.5 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-medium">
                  {t('pages.aiAssistant.showReasoning')}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug font-light">
                  {t('pages.aiAssistant.showReasoningHint')}
                </span>
              </span>
              <ToggleSwitch
                checked={showReasoning}
                onChange={onShowReasoningChange}
                ariaLabel={t('pages.aiAssistant.showReasoning')}
                className="mt-0.5 shrink-0"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type ComposerHubMenuProps = {
  onAttach: () => void
  onQuickAction: (key: QuickActionKey) => void
  quickActionDisabled: boolean
  deepResearch: boolean
  onToggleDeepResearch: () => void
  clientScope: string
  clientOptions: { value: string; label: string }[]
  onClientScopeChange: (value: string) => void
}

/**
 * Left-side "+" hub for the composer (Claude / ChatGPT "+" menu): attach a
 * file, run a CRM quick-action, toggle deep research, or set the client/portfolio
 * context — all in one popover so the input row stays clean.
 */
function ComposerHubMenu({
  onAttach,
  onQuickAction,
  quickActionDisabled,
  deepResearch,
  onToggleDeepResearch,
  clientScope,
  clientOptions,
  onClientScopeChange,
}: ComposerHubMenuProps) {
  const { t } = useTranslation('common')
  const activeClientLabel =
    clientOptions.find((o) => o.value === clientScope)?.label ?? clientOptions[0]?.label ?? ''

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('pages.aiAssistant.composerHub')}
          title={t('pages.aiAssistant.composerHub')}
          data-testid="composer-hub-trigger"
          className="text-foreground hover:border-primary-300 hover:text-primary-600 border-border bg-card text-muted-foreground flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors sm:h-7 sm:w-7"
        >
          <Icons.Add size={18} strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="bg-card w-72"
        data-testid="composer-hub-menu"
      >
        <DropdownMenuItem
          className="text-foreground flex items-center gap-2.5 px-2.5 py-2 text-sm"
          onSelect={onAttach}
          data-testid="hub-attach"
        >
          <Icons.Attachment01
            size={16}
            strokeWidth={1.5}
            className="text-muted-foreground shrink-0"
          />
          {t('pages.aiAssistant.hubAttach')}
        </DropdownMenuItem>

        <DropdownMenuCheckboxItem
          checked={deepResearch}
          // Keep the menu open after toggling so the choice stays visible.
          onSelect={(event) => {
            event.preventDefault()
            onToggleDeepResearch()
          }}
          className="text-foreground py-2 pr-2 pl-8 text-sm"
          data-testid="hub-deep-research"
        >
          <span className="flex items-center gap-2.5">
            <Icons.Sparkles size={16} strokeWidth={1.5} className="text-primary-500 shrink-0" />
            <span className="min-w-0">
              <span className="block">{t('pages.aiAssistant.hubDeepResearch')}</span>
              <span className="text-muted-foreground block text-[11px] leading-snug font-light">
                {t('pages.aiAssistant.hubDeepResearchHint')}
              </span>
            </span>
          </span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-tight">
          <Icons.FileSearch
            size={13}
            strokeWidth={1.5}
            className="text-muted-foreground shrink-0"
          />
          {t('pages.aiAssistant.hubCrmActions')}
        </DropdownMenuLabel>
        {QUICK_ACTION_KEYS.map((key) => {
          const ActionIcon = QUICK_ACTION_ICONS[key]
          return (
            <DropdownMenuItem
              key={key}
              className="text-foreground flex items-center gap-2.5 px-2.5 py-2 text-sm"
              disabled={quickActionDisabled}
              onSelect={() => onQuickAction(key)}
              data-testid={`hub-action-${key}`}
            >
              <ActionIcon size={16} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
              {t(`pages.aiAssistant.${key}`)}
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-tight">
          <Icons.UserMultiple
            size={13}
            strokeWidth={1.5}
            className="text-muted-foreground shrink-0"
          />
          {t('pages.aiAssistant.hubContext')}
          <span className="text-foreground ml-auto max-w-[7rem] truncate font-light">
            {activeClientLabel}
          </span>
        </DropdownMenuLabel>
        {clientOptions.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className="text-foreground flex items-center justify-between gap-2 px-2.5 py-2 text-sm"
            onSelect={() => onClientScopeChange(o.value)}
            data-testid={`hub-context-${o.value}`}
          >
            <span className="min-w-0 truncate">{o.label}</span>
            {o.value === clientScope && (
              <Icons.Checkmark size={14} strokeWidth={2} className="text-primary-500 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AiAssistantBetaPage() {
  const { t, i18n } = useTranslation('common')
  const { data: aiSettings } = useAiAssistantSettings()
  // OneX dock (`?embed=dock`): the page runs inside the operators' browser as a
  // ~420px sidebar. See features/onexEmbed/embedContext.ts for the contract.
  const isEmbedded = useIsOnexDockEmbed()
  const {
    context: onexContext,
    clearContext: clearOnexContext,
    consumeContext: consumeOnexContext,
  } = useOnexPageContext(isEmbedded)
  useOnexDockReady(isEmbedded)
  const isOpenSideBar = useSidebarStore((state) => state.isOpenSideBar)
  const userId = useAuthStore((state) => state.user?.id ?? null)
  const storedConversationId = useAiAssistantStore((state) => state.conversationIdFor(userId))
  const setActiveConversation = useAiAssistantStore((state) => state.setActiveConversation)
  const clearStoredConversation = useAiAssistantStore((state) => state.clearConversation)
  const saveSettings = useAiAssistantStore((state) => state.saveSettings)
  const isHistoryCollapsed = useAiAssistantStore((state) => state.historySidebarCollapsed)
  const setHistoryCollapsed = useAiAssistantStore((state) => state.setHistorySidebarCollapsed)
  const [message, setMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isAssistantResponding, setIsAssistantResponding] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  // Диалог открыт с незавершённым ходом (последнее сообщение — вопрос без
  // ответа): ответ дописывается на сервере, страница ждёт его опросом.
  const [awaitingServerAnswer, setAwaitingServerAnswer] = useState(false)
  // Заполненность контекстного окна мозга по последнему ходу (usage из
  // терминального `done`-кадра). Кружок у композера — см. ContextUsageRing.
  const [contextUsage, setContextUsage] = useState<ContextUsageSnapshot | null>(null)
  // Меню слеш-команд: индекс подсвеченной строки и «закрыто по Esc» (сбрасывается
  // ЛЮБЫМ ручным вводом в onChange, а не эффектом по message — программная
  // подстановка команды не должна тут же переоткрывать меню).
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<number, MessageFeedback>>({})
  // Пометки источников «верно/неверно» (Слой 5), keyed by серверный message_id →
  // (номер сноски → вердикт). Оптимистичны: применяются сразу, откатываются при
  // ошибке POST. Живут в рамках монтирования (после F5 приходят с бэкенда — TODO
  // отдельного слоя, контракт гидратации пометок пока не оговорён).
  const [citationMarksByMessage, setCitationMarksByMessage] = useState<
    Record<number, Record<number, AssistantCitationVerdict>>
  >({})
  // Explicit user toggles for the "Ход рассуждения" panel, keyed by message id.
  // Unset → the panel follows the stream (open while streaming, collapsed once
  // the turn finishes); a value here is the user's deliberate override.
  const [reasoningOpenByMessage, setReasoningOpenByMessage] = useState<Record<string, boolean>>({})
  // Источник (номер сноски) для подсветки/скролла в панели «Активность» + id
  // сообщения, которому он принадлежит — чтобы фокус применялся только к своему
  // ходу (клик по факту `[[N]]`; см. openReasoningForFact / focusedCitationId).
  const [focusedCitation, setFocusedCitation] = useState<{
    messageId: string
    citationId: number
  } | null>(null)
  const [clientScope, setClientScope] = useState('all')
  const [period, setPeriod] = useState('all')
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>(
    () => useAiAssistantStore.getState().settingsFor(userId) ?? DEFAULT_ASSISTANT_SETTINGS
  )
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false)
  // An explicit click in the history panel must load the conversation even
  // when "remember conversation context" is off.
  const [isExplicitSelection, setIsExplicitSelection] = useState(false)
  const [isNarrowViewport, setIsNarrowViewport] = useState(() => window.innerWidth < 1024)
  /**
   * Compact layout: every desktop-only surface (inline settings popover, the
   * reasoning panel reserving its own column, the fixed dock's rail offsets)
   * falls back to its mobile form. The OneX dock is always compact — it has no
   * dashboard rail and no history panel to lay out against, whatever width the
   * host window happens to have.
   */
  const isMobileOrTablet = isNarrowViewport || isEmbedded
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening'>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [dictationDraft, setDictationDraft] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [preparingAttachments, setPreparingAttachments] = useState<PreparingAttachment[]>([])
  const [showScrollToLatest, setShowScrollToLatest] = useState(false)
  const [dockHeight, setDockHeight] = useState(320)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const pageRootRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dictationGhostRef = useRef<HTMLDivElement>(null)
  const lastDictationFinalRef = useRef('')
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  /** Every object URL minted for attachments — revoked on reset/unmount. */
  const attachmentUrlsRef = useRef<string[]>([])
  /**
   * How many attachments the next message already carries, staged and still
   * encoding. Held in a ref, not derived from state, so two picks in the same
   * tick cannot both see an empty composer and together overflow the cap.
   */
  const attachmentCountRef = useRef(0)
  const responseTokenRef = useRef(0)
  /**
   * Synchronous twin of `isAssistantResponding`. The state flag is a render
   * value, so two sends dispatched in the same tick — a double-clicked quick
   * action, or a host firing `onex:ask` twice — both read `false` and both
   * start a turn on the same conversation. The ref flips before the first
   * `await`, so the second one bounces off the same guard.
   */
  const respondingRef = useRef(false)
  const hasConversation = chatMessages.length > 0

  const { mutateAsync: sendChat } = useSendAssistantMessage()
  const { mutate: mutateFeedback } = useSendFeedback()
  const { mutate: mutateMarkCitation } = useMarkCitation()
  const queryClient = useQueryClient()
  const expertCapability = useExpertCapability()
  /**
   * Экспертная модель, с которой РЕАЛЬНО уйдёт следующий ход.
   *
   * Право на режим принадлежит бэкенду, а не localStorage: сохранённый выбор
   * действует, только пока capabilities подтверждают доступ и знают эту модель.
   * Иначе (роль сняли, режим выключили, модель убрали из списка) ход тихо
   * уходит обычным путём — вместо 403 на каждое сообщение.
   */
  const activeExpertModel = useMemo(() => {
    const chosen = assistantSettings.expertModel
    if (chosen == null) return null
    const available =
      expertCapability.enabled &&
      expertCapability.allowed &&
      expertCapability.models.includes(chosen)
    return available ? chosen : null
  }, [
    assistantSettings.expertModel,
    expertCapability.allowed,
    expertCapability.enabled,
    expertCapability.models,
  ])

  // Re-hydrate the dialog persisted for this user: history lives on the
  // backend, the store only keeps the conversation pointer. Hydration is
  // skipped as soon as the user starts a conversation in this mount.
  // Switching a conversation from the history panel resets the local chat
  // state and re-arms this flag, so the same mechanism loads the new dialog.
  // Deep-link: ?conversation=<id> в адресе — явный выбор диалога, как клик в
  // истории. Читается один раз при появлении userId (до этого гидратация всё
  // равно невозможна) и перекрывает сохранённый указатель. Явность важна:
  // ссылка обязана открыть диалог даже при выключенном «помнить контекст».
  // RBAC не обходится — чужой id бэкенд ответит 404, указатель и параметр
  // будут сброшены эффектом ниже. В OneX-доке адрес не пользовательский —
  // там deep-link не читается и не пишется.
  const urlConversationConsumedRef = useRef(false)
  useEffect(() => {
    if (urlConversationConsumedRef.current || isEmbedded || userId == null) return
    urlConversationConsumedRef.current = true
    const fromUrl = parseConversationParam(window.location.search)
    if (fromUrl == null) return
    setIsExplicitSelection(true)
    setActiveConversation(userId, fromUrl)
  }, [isEmbedded, setActiveConversation, userId])

  // Обратная сторона deep-link: активный диалог всегда отражён в адресе, так
  // что «поделиться разговором» = скопировать URL из адресной строки. Пишем
  // только ненулевой id (null на маунте — ещё не гидратировано, затирать
  // параметр рано); снятие параметра — явное, в «Новий чат» и при 404.
  // Маркер `new` этот же эффект и перетирает: как только первая отправка
  // вернула id созданного диалога, в адресе оказывается он.
  useEffect(() => {
    if (isEmbedded || conversationId == null) return
    writeConversationParam(conversationId)
  }, [conversationId, isEmbedded])

  /**
   * Явный запрос чистого листа: `?conversation=new` в адресе.
   *
   * Пустой адрес такого не значит — при включённом «помнить контекст» вход на
   * /dashboard/ai-assistant без параметра штатно восстанавливает последний
   * диалог. Поэтому маркер и нужен: по нему сохранённый указатель гасится, как
   * по кнопке «Новий чат», а гидратация не запускается вовсе.
   *
   * Читается синхронно на первом рендере (инициализатор useState, не эффект):
   * `shouldHydrateConversation` считается прямо в рендере, и запрос диалога
   * ушёл бы ещё до того, как эффект успел бы его отменить.
   *
   * Флаг одноразовый — снимается тем же эффектом, что гасит указатель. Иначе
   * он запретил бы и последующий выбор диалога в истории в этом же
   * монтировании. Сам маркер из адреса не стираем: он держится до первой
   * отправки, и её id его заменит.
   */
  const [isNewConversationRequest, setIsNewConversationRequest] = useState(
    () => !isEmbedded && isNewConversationParam(window.location.search)
  )
  useEffect(() => {
    if (!isNewConversationRequest || userId == null) return
    clearStoredConversation()
    setIsExplicitSelection(false)
    setIsNewConversationRequest(false)
  }, [clearStoredConversation, isNewConversationRequest, userId])

  const shouldHydrateConversation =
    !isNewConversationRequest &&
    storedConversationId != null &&
    conversationId == null &&
    chatMessages.length === 0 &&
    (assistantSettings.rememberConversationContext || isExplicitSelection)
  const conversationQuery = useAssistantConversation(
    storedConversationId ?? 0,
    shouldHydrateConversation
  )

  // Write-through: settings survive unmount/reload and stay scoped to the user.
  useEffect(() => {
    if (userId == null) return
    saveSettings(userId, assistantSettings)
  }, [assistantSettings, saveSettings, userId])

  useEffect(() => {
    const onResize = () => setIsNarrowViewport(window.innerWidth < 1024)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isSettingsOpen || isMobileOrTablet) return

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedInsidePanel = settingsPanelRef.current?.contains(target)
      const clickedTrigger = settingsTriggerRef.current?.contains(target)

      if (!clickedInsidePanel && !clickedTrigger) {
        setIsSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [isSettingsOpen, isMobileOrTablet])

  const applySettings = (updater: (current: AssistantSettings) => AssistantSettings) => {
    setAssistantSettings((current) => updater(current))
  }

  const stopVoiceRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) {
      setInterimTranscript('')
      setVoiceStatus('idle')
      return
    }
    try {
      rec.stop()
    } catch {
      try {
        rec.abort()
      } catch {
        /* noop */
      }
    }
    recognitionRef.current = null
    setInterimTranscript('')
    setVoiceStatus('idle')
  }, [])

  const startVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      return
    }

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      toast.error(t('pages.aiAssistant.voiceNotSupported'))
      return
    }

    try {
      const rec = new Ctor()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = resolveSpeechLang(i18n.language)

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const segment = event.results[i][0]?.transcript ?? ''
          if (event.results[i].isFinal) {
            const cleaned = segment.trim()
            if (cleaned) {
              setMessage((prev) => (prev ? `${prev} ${cleaned}` : cleaned))
            }
          } else {
            interim += segment
          }
        }
        setInterimTranscript(interim)
      }

      rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return
        }
        if (event.error === 'not-allowed') {
          toast.error(t('pages.aiAssistant.voicePermissionDenied'))
        } else {
          toast.error(t('pages.aiAssistant.voiceError'))
        }
        recognitionRef.current = null
        setInterimTranscript('')
        setVoiceStatus('idle')
      }

      rec.onend = () => {
        recognitionRef.current = null
        setInterimTranscript('')
        setVoiceStatus('idle')
      }

      recognitionRef.current = rec
      rec.start()
      setVoiceStatus('listening')
    } catch {
      recognitionRef.current = null
      setVoiceStatus('idle')
      toast.error(t('pages.aiAssistant.voiceNotSupported'))
    }
  }, [i18n.language, t])

  // Primary voice input: server-side streaming STT (whisper + corrector layer
  // behind WS /ai-assistant/ws/transcribe). The draft is rendered as a grey
  // non-editable tail over the textarea; `final` commits the text and
  // `corrected` silently upgrades it. Any failure falls back to the browser
  // SpeechRecognition above.
  const {
    status: dictationStatus,
    start: startDictation,
    stop: stopDictation,
    cancel: cancelDictation,
  } = useServerDictation({
    language: resolveDictationLanguage(i18n.language),
    silenceTimeoutSec: assistantSettings.voiceSilenceTimeoutSec,
    maxDurationSec: assistantSettings.voiceMaxDurationSec,
    onDraft: (text) => setDictationDraft(text),
    onFinal: (text) => {
      setDictationDraft('')
      const cleaned = text.trim()
      lastDictationFinalRef.current = cleaned
      if (cleaned) {
        setMessage((prev) => joinDictation(prev, cleaned))
      }
      window.requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        const len = el.value.length
        el.setSelectionRange(len, len)
      })
    },
    onCorrected: (text) => {
      const finalText = lastDictationFinalRef.current
      const corrected = text.trim()
      if (!finalText || !corrected || corrected === finalText) return
      // Upgrade only when the user has not touched the dictated tail yet.
      setMessage((prev) =>
        prev.endsWith(finalText) ? prev.slice(0, prev.length - finalText.length) + corrected : prev
      )
      lastDictationFinalRef.current = corrected
    },
    onError: () => {
      setDictationDraft('')
      toast.error(t('pages.aiAssistant.voiceFallback'))
      startVoiceRecognition()
    },
  })

  const startServerDictation = useCallback(() => {
    lastDictationFinalRef.current = ''
    setDictationDraft('')
    void startDictation()
  }, [startDictation])

  const ttsPlayer = useTtsPlayer(() => toast.error(t('pages.aiAssistant.ttsError')))
  const { stop: stopTts } = ttsPlayer

  // Voice message (long-press on the mic): record → send as an `audio`
  // attachment; the gateway transcribes it and answers with regular text.
  // `sendVoiceMessageRef` breaks the declaration cycle with submitPrompt.
  const sendVoiceMessageRef = useRef<(result: VoiceMessageResult) => void>(() => {})
  const voiceRecorder = useVoiceMessageRecorder({
    maxDurationSec: assistantSettings.voiceMaxDurationSec,
    onComplete: (result) => sendVoiceMessageRef.current(result),
    onError: (reason) =>
      toast.error(
        t(
          reason === 'tooLarge'
            ? 'pages.aiAssistant.voiceMessageTooLarge'
            : 'pages.aiAssistant.voicePermissionDenied'
        )
      ),
  })
  const {
    status: recorderStatus,
    elapsedSec: recorderElapsedSec,
    stop: stopVoiceMessage,
    cancel: cancelVoiceMessage,
    start: startVoiceMessage,
  } = voiceRecorder

  useEffect(() => {
    if (recorderStatus !== 'recording') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelVoiceMessage()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [recorderStatus, cancelVoiceMessage])

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments((current) => {
      // Object URLs stay alive while a sent message still shows them in the
      // feed; pending chips that never left the composer are revoked here.
      current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
        attachmentUrlsRef.current = attachmentUrlsRef.current.filter(
          (url) => url !== item.previewUrl
        )
      })
      return current.length > 0 ? [] : current
    })
    setPreparingAttachments((current) => (current.length > 0 ? [] : current))
  }, [])

  // Reconcile the cap counter with what is actually staged: `addFiles` bumps it
  // synchronously when it admits files, removals only land through state.
  useEffect(() => {
    attachmentCountRef.current = pendingAttachments.length + preparingAttachments.length
  }, [pendingAttachments.length, preparingAttachments.length])

  useEffect(() => {
    const recordingActive =
      voiceStatus === 'listening' ||
      dictationStatus === 'listening' ||
      dictationStatus === 'finalizing'
    if (!recordingActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (dictationStatus === 'listening') {
        stopDictation()
      } else if (dictationStatus === 'finalizing') {
        cancelDictation()
      } else {
        stopVoiceRecognition()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [voiceStatus, dictationStatus, stopDictation, cancelDictation, stopVoiceRecognition])

  // Keep the grey draft tail visible: the textarea autosizes up to a max
  // height, after which both layers scroll to the bottom in lockstep.
  useEffect(() => {
    if (!dictationDraft) return
    const el = textareaRef.current
    if (el) el.scrollTop = el.scrollHeight
    const ghost = dictationGhostRef.current
    if (ghost) ghost.scrollTop = ghost.scrollHeight
  }, [dictationDraft, message])

  useEffect(() => {
    const urls = attachmentUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.length = 0
    }
  }, [])

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current
      if (rec) {
        try {
          rec.abort()
        } catch {
          /* noop */
        }
        recognitionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!assistantSettings.autoScrollToLatestAnswer) return
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [assistantSettings.autoScrollToLatestAnswer, chatMessages])

  useEffect(() => {
    if (!pageRootRef.current) return
    scrollContainerRef.current = pageRootRef.current.closest('main')
  }, [])

  useEffect(() => {
    const updateDockHeight = () => {
      // Reserve the dock's height plus a safety gap so the last bubble / the
      // streaming reasoning window always clears the composer (never slips
      // under the fixed input dock).
      const next = Math.ceil((dockRef.current?.getBoundingClientRect().height ?? 0) + 24)
      if (next <= 0) return
      setDockHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev))
    }

    const rafId = window.requestAnimationFrame(updateDockHeight)
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && dockRef.current) {
      resizeObserver = new ResizeObserver(() => updateDockHeight())
      resizeObserver.observe(dockRef.current)
    }
    window.addEventListener('resize', updateDockHeight)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updateDockHeight)
      resizeObserver?.disconnect()
    }
  }, [])

  const scrollToConversationBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const scrollToEnd = () => {
      const scrollContainer = scrollContainerRef.current
      chatBottomRef.current?.scrollIntoView({ behavior, block: 'end' })
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior,
        })
      }
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior,
      })
    }

    scrollToEnd()
    // Run again on next paint so late layout updates don't block reaching true bottom.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToEnd)
    })
  }, [])

  const mapServerMessages = useCallback(
    (detail: AssistantConversationDetail): ChatMessage[] =>
      detail.messages.map((item) => {
        const isAssistant = item.role === 'assistant'
        // Слой 5: источники приходят сырым конвертом `{items:[...]}` (как и во
        // фрейме `citations` стрима) — разворачиваем тем же нормализатором, что
        // и живой стрим, иначе рендер зовёт `.map` на объекте и падает
        // `.map is not a function` (белый экран при открытии диалога с SQL-
        // источниками). Пустой результат → undefined, чтобы сообщение без
        // источников вело себя как прежде (без секции «Источники»).
        const citations = isAssistant ? normalizeCitations(item.citations) : []
        return {
          id: `server-${item.id}`,
          role: item.role,
          // A turn sent from the OneX dock carries a machine-facing page-context
          // envelope alongside what the operator typed, and the backend stores
          // `message` verbatim. Unconditional (not gated on the dock): the
          // conversation is just as likely to be reopened in a plain CRM tab,
          // and that surface must not regress into a wall of machine text.
          content: isAssistant ? item.content : stripOnexContextBlock(item.content),
          serverMessageId: isAssistant ? item.id : undefined,
          // Слой 5: гидратируем раздумья и источники серверного сообщения, чтобы
          // панель «Активность» и факт-сноски `[[N]]` работали в загруженном из
          // истории диалоге (после F5 / переключения), а не только в текущем
          // стриме. Поля опциональны — старый бэкенд их не шлёт, тогда сообщение
          // ведёт себя как прежде (без чипа/источников).
          reasoning: isAssistant ? item.reasoning : undefined,
          citations: citations.length > 0 ? citations : undefined,
        }
      }),
    []
  )

  useEffect(() => {
    const detail = conversationQuery.data
    if (!detail || !shouldHydrateConversation) return
    setConversationId(detail.id)
    const mapped = mapServerMessages(detail)
    const last = detail.messages[detail.messages.length - 1]
    // Последний ход — вопрос без ответа: ответ ещё дописывается на сервере
    // (обрыв соединения при обновлении страницы). Показываем «печатает…» и
    // ждём его опросом, а не оставляем оператора с висящим вопросом.
    const pending = last?.role === 'user'
    setChatMessages(
      pending
        ? [
            ...mapped,
            {
              id: 'pending-server-answer',
              role: 'assistant',
              content: '',
              isLoading: true,
              loadingLabel: t('pages.aiAssistant.answerInProgress'),
            },
          ]
        : mapped
    )
    setAwaitingServerAnswer(pending)
    setIsExplicitSelection(false)
    window.setTimeout(() => scrollToConversationBottom('auto'), 0)
  }, [
    conversationQuery.data,
    shouldHydrateConversation,
    scrollToConversationBottom,
    mapServerMessages,
    t,
  ])

  // Опрос диалога с незавершённым ходом: refetch работает и у выключенного
  // запроса. Ответ появился — подменяем «печатает…» настоящими сообщениями;
  // потолок ожидания — дедлайн thinking-хода с запасом.
  useEffect(() => {
    if (!awaitingServerAnswer) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > ANSWER_POLL_MAX_MS) {
        setAwaitingServerAnswer(false)
        setChatMessages((current) => current.filter((m) => m.id !== 'pending-server-answer'))
        return
      }
      void conversationQuery.refetch()
    }, ANSWER_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
    // refetch стабилен на время жизни запроса; сам объект запроса меняется
    // каждый рендер и не должен перезапускать таймер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingServerAnswer])

  useEffect(() => {
    if (!awaitingServerAnswer) return
    const detail = conversationQuery.data
    const last = detail?.messages[detail.messages.length - 1]
    if (!detail || last?.role !== 'assistant') return
    setChatMessages(mapServerMessages(detail))
    setAwaitingServerAnswer(false)
    window.setTimeout(() => scrollToConversationBottom('auto'), 0)
  }, [awaitingServerAnswer, conversationQuery.data, mapServerMessages, scrollToConversationBottom])

  useEffect(() => {
    if (!conversationQuery.isError) return
    // The persisted conversation no longer exists — drop the stale pointer.
    // Transient errors (network, 5xx) keep it so a later visit can retry.
    if (isAxiosError(conversationQuery.error) && conversationQuery.error.response?.status === 404) {
      clearStoredConversation()
      // Мёртвый (или чужой) указатель мог прийти из deep-link — убираем и его,
      // чтобы F5 не долбил бэкенд тем же 404.
      if (!isEmbedded) writeConversationParam(null)
    }
  }, [conversationQuery.isError, conversationQuery.error, clearStoredConversation, isEmbedded])

  const updateScrollToLatestVisibility = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    if (!hasConversation) {
      setShowScrollToLatest(false)
      return
    }

    const mainHasOverflow = scrollContainer
      ? scrollContainer.scrollHeight - scrollContainer.clientHeight > 8
      : false
    const mainDistanceFromBottom = scrollContainer
      ? scrollContainer.scrollHeight - (scrollContainer.scrollTop + scrollContainer.clientHeight)
      : 0

    const doc = document.documentElement
    const pageHasOverflow = doc.scrollHeight - window.innerHeight > 8
    const pageDistanceFromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight)

    const shouldShowFromMain = mainHasOverflow && mainDistanceFromBottom > 48
    const shouldShowFromPage = pageHasOverflow && pageDistanceFromBottom > 48
    setShowScrollToLatest(shouldShowFromMain || shouldShowFromPage)
  }, [hasConversation])

  useEffect(() => {
    if (!hasConversation) return

    const onScroll = () => updateScrollToLatestVisibility()
    const scrollContainer = scrollContainerRef.current

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', onScroll, { passive: true })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.requestAnimationFrame(onScroll)

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', onScroll)
      }
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [hasConversation, updateScrollToLatestVisibility])

  useEffect(() => {
    if (!hasConversation) return
    window.requestAnimationFrame(() => updateScrollToLatestVisibility())
  }, [hasConversation, isOpenSideBar, updateScrollToLatestVisibility])

  // Drop the local chat state (messages, feedback, in-flight response). The
  // persisted conversation pointer is handled separately by the callers.
  const resetChatState = useCallback(() => {
    stopVoiceRecognition()
    cancelDictation()
    cancelVoiceMessage()
    stopTts()
    setDictationDraft('')
    clearPendingAttachments()
    responseTokenRef.current += 1
    setChatMessages((current) => (current.length > 0 ? [] : current))
    setConversationId(null)
    setContextUsage(null)
    setAwaitingServerAnswer(false)
    setFeedbackByMessage({})
    setCitationMarksByMessage((current) => (Object.keys(current).length > 0 ? {} : current))
    setReasoningOpenByMessage((current) => (Object.keys(current).length > 0 ? {} : current))
    setFocusedCitation(null)
    respondingRef.current = false
    setIsAssistantResponding(false)
  }, [stopVoiceRecognition, cancelDictation, cancelVoiceMessage, stopTts, clearPendingAttachments])

  const clientOptions = useMemo(
    () => [
      { value: 'all', label: t('pages.aiAssistant.allClients') },
      { value: 'my', label: t('pages.aiAssistant.myClients') },
    ],
    [t]
  )

  const settingsPanel = (
    <div className="border-border/80 bg-card ring-border/40 mx-auto flex max-h-full min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl ring-1">
      <header className="from-muted/80 border-border to-card shrink-0 border-b bg-gradient-to-b px-4 pt-3 pb-2">
        <h2 className="text-foreground text-sm font-semibold tracking-tight">
          {t('pages.aiAssistant.settingsTitle')}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-snug font-light">
          {t('pages.aiAssistant.settingsDescription')}
        </p>
      </header>

      <div className="divide-border min-h-0 flex-1 divide-y overflow-y-auto overscroll-y-contain">
        <section className="px-4 py-2.5">
          <h3 className="text-foreground mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.assistantPreferences')}
          </h3>
          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
            {t('pages.aiAssistant.responseMode')}
          </p>
          <div
            className="bg-muted/80 flex w-full rounded-lg p-0.5"
            role="group"
            aria-label={t('pages.aiAssistant.responseMode')}
          >
            <button
              type="button"
              onClick={() => applySettings((s) => ({ ...s, responseMode: 'short' }))}
              className={cn(
                'min-h-8 flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                assistantSettings.responseMode === 'short'
                  ? 'text-foreground bg-card ring-border/80 shadow-sm ring-1'
                  : 'hover:text-foreground text-muted-foreground'
              )}
            >
              {t('pages.aiAssistant.responseShort')}
            </button>
            <button
              type="button"
              onClick={() => applySettings((s) => ({ ...s, responseMode: 'detailed' }))}
              className={cn(
                'min-h-8 flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                assistantSettings.responseMode === 'detailed'
                  ? 'text-foreground bg-card ring-border/80 shadow-sm ring-1'
                  : 'hover:text-foreground text-muted-foreground'
              )}
            >
              {t('pages.aiAssistant.responseDetailed')}
            </button>
          </div>

          {/* Reasoning mode now lives in the dropdown next to the composer
              (single source of truth); the settings panel only points to it. */}
          <div
            className="bg-muted/60 border-border/70 mt-2.5 flex items-center gap-2 rounded-lg border px-2.5 py-2"
            data-testid="assistant-settings-mode-summary"
          >
            {activeExpertModel ? (
              <Icons.Sparkles size={14} strokeWidth={1.5} className="text-primary-500 shrink-0" />
            ) : assistantSettings.mode === 'thinking' ? (
              <Icons.AiBrain03 size={14} strokeWidth={1.5} className="text-primary-500 shrink-0" />
            ) : (
              <Icons.Flash size={14} strokeWidth={1.5} className="text-warning-500 shrink-0" />
            )}
            <span className="text-foreground min-w-0 flex-1 text-[11px] leading-snug font-light">
              {t('pages.aiAssistant.mode')}:{' '}
              {/* Экспертный ход идёт не на нашем боксе — сводка обязана
                  называть его, а не «Швидкий», под которым он уезжает. */}
              {activeExpertModel
                ? t('pages.aiAssistant.expertTrigger', {
                    model: expertModelLabel(activeExpertModel),
                  })
                : assistantSettings.mode === 'thinking'
                  ? t('pages.aiAssistant.modeThinkingShort')
                  : t('pages.aiAssistant.modeFastShort')}
            </span>
            <span className="text-muted-foreground shrink-0 text-[11px] font-light">
              {t('pages.aiAssistant.modeChangeHint')}
            </span>
          </div>

          <p className="text-muted-foreground mt-2.5 mb-1.5 text-[11px] font-medium">
            {t('pages.aiAssistant.outputFormat')}
          </p>
          <div
            className="bg-muted/80 grid w-full grid-cols-3 gap-0.5 rounded-lg p-0.5"
            role="group"
            aria-label={t('pages.aiAssistant.outputFormat')}
          >
            {(['text', 'tableFirst', 'mixed'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => applySettings((s) => ({ ...s, outputFormat: format }))}
                className={cn(
                  'min-h-8 rounded-md px-1 py-1.5 text-center text-[10px] leading-tight font-medium transition-all sm:px-1.5 sm:text-[11px]',
                  assistantSettings.outputFormat === format
                    ? 'text-foreground bg-card ring-border/80 shadow-sm ring-1'
                    : 'hover:text-foreground text-muted-foreground'
                )}
              >
                {format === 'text' && t('pages.aiAssistant.outputText')}
                {format === 'tableFirst' && t('pages.aiAssistant.outputTableFirst')}
                {format === 'mixed' && t('pages.aiAssistant.outputMixed')}
              </button>
            ))}
          </div>

          <div className="bg-muted/60 border-border/70 mt-2.5 flex items-center justify-between gap-3 rounded-lg border px-2.5 py-2">
            <span className="text-foreground min-w-0 flex-1 text-xs leading-snug font-light">
              {t('pages.aiAssistant.voiceInput')}
            </span>
            <ToggleSwitch
              checked={assistantSettings.voiceInputEnabled}
              onChange={(checked) => {
                if (!checked) {
                  stopVoiceRecognition()
                  cancelDictation()
                  cancelVoiceMessage()
                  setDictationDraft('')
                }
                applySettings((s) => ({ ...s, voiceInputEnabled: checked }))
              }}
              ariaLabel={t('pages.aiAssistant.voiceInput')}
            />
          </div>

          {assistantSettings.voiceInputEnabled && (
            <div data-testid="voice-listening-settings">
              <p className="text-muted-foreground mt-2.5 mb-1.5 text-[11px] font-medium">
                {t('pages.aiAssistant.voiceSilenceTimeout')}
              </p>
              <div
                className="bg-muted/80 grid w-full grid-cols-3 gap-0.5 rounded-lg p-0.5"
                role="group"
                aria-label={t('pages.aiAssistant.voiceSilenceTimeout')}
              >
                {VOICE_SILENCE_OPTIONS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => applySettings((s) => ({ ...s, voiceSilenceTimeoutSec: sec }))}
                    className={cn(
                      'min-h-8 rounded-md px-1 py-1.5 text-center text-[11px] font-medium transition-all',
                      assistantSettings.voiceSilenceTimeoutSec === sec
                        ? 'text-foreground bg-card ring-border/80 shadow-sm ring-1'
                        : 'hover:text-foreground text-muted-foreground'
                    )}
                  >
                    {t('pages.aiAssistant.voiceSeconds', { count: sec })}
                  </button>
                ))}
              </div>

              <p className="text-muted-foreground mt-2.5 mb-1.5 text-[11px] font-medium">
                {t('pages.aiAssistant.voiceMaxDuration')}
              </p>
              <div
                className="bg-muted/80 grid w-full grid-cols-3 gap-0.5 rounded-lg p-0.5"
                role="group"
                aria-label={t('pages.aiAssistant.voiceMaxDuration')}
              >
                {VOICE_MAX_DURATION_OPTIONS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => applySettings((s) => ({ ...s, voiceMaxDurationSec: sec }))}
                    className={cn(
                      'min-h-8 rounded-md px-1 py-1.5 text-center text-[11px] font-medium transition-all',
                      assistantSettings.voiceMaxDurationSec === sec
                        ? 'text-foreground bg-card ring-border/80 shadow-sm ring-1'
                        : 'hover:text-foreground text-muted-foreground'
                    )}
                  >
                    {t('pages.aiAssistant.voiceSeconds', { count: sec })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="px-4 py-2.5">
          <h3 className="text-foreground mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.contextBehavior')}
          </h3>
          <ul className="space-y-0">
            <li className="flex items-center justify-between gap-3 py-1.5 first:pt-0">
              <span className="text-foreground min-w-0 flex-1 text-xs leading-snug font-light">
                {t('pages.aiAssistant.useSelectedClientAutomatically')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.useSelectedClientAutomatically}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, useSelectedClientAutomatically: checked }))
                }
                ariaLabel={t('pages.aiAssistant.useSelectedClientAutomatically')}
              />
            </li>
            <li className="border-border flex items-center justify-between gap-3 border-t py-1.5">
              <span className="text-foreground min-w-0 flex-1 text-xs leading-snug font-light">
                {t('pages.aiAssistant.useSelectedPeriodAutomatically')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.useSelectedPeriodAutomatically}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, useSelectedPeriodAutomatically: checked }))
                }
                ariaLabel={t('pages.aiAssistant.useSelectedPeriodAutomatically')}
              />
            </li>
            <li className="border-border flex items-center justify-between gap-3 border-t py-1.5">
              <span className="text-foreground min-w-0 flex-1 text-xs leading-snug font-light">
                {t('pages.aiAssistant.rememberConversationContext')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.rememberConversationContext}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, rememberConversationContext: checked }))
                }
                ariaLabel={t('pages.aiAssistant.rememberConversationContext')}
              />
            </li>
          </ul>
        </section>

        <section className="px-4 py-2.5">
          <h3 className="text-foreground mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.suggestedActions')}
          </h3>
          <ul className="space-y-0">
            <li className="flex items-center justify-between gap-3 py-1.5 first:pt-0">
              <span className="text-foreground min-w-0 flex-1 text-xs leading-snug font-light">
                {t('pages.aiAssistant.autoScrollToLatestAnswer')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.autoScrollToLatestAnswer}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, autoScrollToLatestAnswer: checked }))
                }
                ariaLabel={t('pages.aiAssistant.autoScrollToLatestAnswer')}
              />
            </li>
          </ul>
        </section>

        <section className="bg-muted/40 px-4 py-2.5">
          <h3 className="text-foreground mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.advanced')}
          </h3>
          <button
            type="button"
            onClick={() => {
              resetChatState()
              setMessage('')
            }}
            className="text-error-700 border-error-200/80 bg-error-50/50 hover:bg-error-50 focus-visible:ring-error-400 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Icons.Delete size={14} strokeWidth={1.5} />
            {t('pages.aiAssistant.clearConversation')}
          </button>
        </section>
      </div>
    </div>
  )

  const periodOptions = useMemo(
    () => [
      { value: 'all', label: t('pages.aiAssistant.periodAll') },
      { value: 'today', label: t('pages.aiAssistant.periodToday') },
      { value: 'last7Days', label: t('pages.aiAssistant.periodLast7Days') },
      { value: 'last30Days', label: t('pages.aiAssistant.periodLast30Days') },
      { value: 'month', label: t('pages.aiAssistant.periodMonth') },
      { value: 'quarter', label: t('pages.aiAssistant.periodQuarter') },
    ],
    [t]
  )

  const quickActionPrompts = useMemo<Record<QuickActionKey, string>>(
    () => ({
      quickClientData: t('pages.aiAssistant.quickPromptClientData'),
      quickDebt: t('pages.aiAssistant.quickPromptDebt'),
      quickReport: t('pages.aiAssistant.quickPromptReport'),
      quickEmployee: t('pages.aiAssistant.quickPromptEmployee'),
    }),
    [t]
  )

  const appendChatMessage = useCallback((payload: Omit<ChatMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const next: ChatMessage = { id, ...payload }
    setChatMessages((current) => [...current, next])
    return id
  }, [])

  const handleSelectConversation = useCallback(
    (id: number) => {
      setIsHistoryDrawerOpen(false)
      if (userId == null || id === conversationId) return
      resetChatState()
      setIsExplicitSelection(true)
      setActiveConversation(userId, id)
      // Адрес обновляется сразу по клику, не дожидаясь гидратации: ссылка
      // должна быть копируемой в момент выбора.
      if (!isEmbedded) writeConversationParam(id)
    },
    [conversationId, isEmbedded, resetChatState, setActiveConversation, userId]
  )

  const handleNewChat = useCallback(() => {
    setIsHistoryDrawerOpen(false)
    resetChatState()
    setMessage('')
    setIsExplicitSelection(false)
    clearStoredConversation()
    // Маркер, а не снятие параметра: адрес обязан меняться на каждое нажатие.
    // Пустой адрес неотличим от обычного входа на страницу, и при включённом
    // «помнить контекст» перезагрузка по нему вернула бы прежний диалог —
    // ровно то, чего кнопка и не хочет.
    if (!isEmbedded) writeConversationParam(NEW_CONVERSATION_PARAM_VALUE)
  }, [clearStoredConversation, isEmbedded, resetChatState])

  // Меню слеш-команд (как в Claude Code): «/» в начале поля открывает список,
  // сами команды исполняет мозг — кроме /новий, который чистит диалог локально.
  const slashItems = slashDismissed ? [] : matchSlashCommands(message)
  const applySlashCommand = useCallback(
    (cmd: SlashCommand) => {
      setSlashDismissed(true)
      setSlashActiveIndex(0)
      if (cmd.clientAction === 'newChat') {
        setMessage('')
        handleNewChat()
        return
      }
      // Подстановка канона; отправка — вторым Enter (меню уже закрыто).
      setMessage(cmd.command)
      textareaRef.current?.focus()
    },
    [handleNewChat]
  )

  const submitPrompt = useCallback(
    async (rawPrompt: string, attachments?: PendingAttachment[]) => {
      const prompt = rawPrompt.trim()
      // Клиентская слеш-команда (/новий) — локальное действие, в мозг не уходит.
      const clientCommand = exactSlashCommand(prompt)
      if (clientCommand?.clientAction === 'newChat') {
        setMessage('')
        handleNewChat()
        return
      }
      const attachmentList = attachments ?? []
      const hasAudio = attachmentList.some((item) => item.type === 'audio')
      if (isAssistantResponding || respondingRef.current) return
      if (!prompt && !hasAudio) {
        // Backend rule: an empty message is valid only with a voice note;
        // images alone are a 422 — nudge the user instead of failing silently.
        if (attachmentList.length > 0) {
          toast.error(t('pages.aiAssistant.attachmentNeedsText'))
        }
        return
      }

      // OneX dock: the page the operator is looking at rides along as a fenced
      // block after their own text (the chat contract has no field for host
      // context; the text leads so the backend's auto-title names the chat after
      // the question). It is consumed by this one turn — but only once the turn
      // has actually landed, so a 5xx or a dropped connection does not silently
      // cost the operator their context.
      const sentContext = isEmbedded ? onexContext : null
      const outboundMessage = buildContextualMessage(prompt, sentContext)

      setMessage('')
      // Only the attachments that went out with this turn leave the composer —
      // a quick action fired while a file is staged must not discard it.
      if (attachmentList.length > 0) {
        const sentIds = new Set(attachmentList.map((item) => item.id))
        setPendingAttachments((current) => current.filter((item) => !sentIds.has(item.id)))
      }
      appendChatMessage({
        role: 'user',
        content: prompt,
        attachments:
          attachmentList.length > 0
            ? attachmentList.map((item) => ({
                type: item.type,
                mime: item.mime,
                url: item.previewUrl,
                name: item.name,
                sizeBytes: item.sizeBytes,
              }))
            : undefined,
      })
      respondingRef.current = true
      setIsAssistantResponding(true)

      const expertModel = activeExpertModel
      const isExpertTurn = expertModel != null
      // Экспертный ход идёт во внешнюю модель — «думающего» окна раздумий у
      // него нет, поэтому режим раздумий на него не распространяется.
      const isThinking = !isExpertTurn && assistantSettings.mode === 'thinking'
      const reasoningStartedAt = Date.now()
      const loadingId = appendChatMessage({
        role: 'assistant',
        content: isThinking
          ? t('pages.aiAssistant.assistantThinking')
          : t('pages.aiAssistant.assistantTyping'),
        // Экспертный ход отвечает десятки секунд: подпись со своим таймером
        // держит ожидание читаемым (см. ExpertWaitingLabel).
        expertWaitingModel: expertModel ?? undefined,
        isLoading: true,
        // Start marker for the "Xс" reasoning timer (chip + activity panel).
        reasoningStartedAt,
        // Thinking mode shows the "Ход рассуждения" window straight away (see
        // thinkingPlaceholder), so the generic "думаю…" label stands down; fast
        // mode keeps the light typing indicator.
        loadingLabel: undefined,
        // Arms the live "Ход рассуждения" view: the panel auto-expands while the
        // turn streams reasoning/tool events, then collapses once it settles.
        isStreamingReasoning: true,
        // Thinking mode: open the reasoning window immediately (spinner +
        // placeholder) before any reasoning delta. Fast mode shows the light
        // typing dots and only reveals the panel if reasoning actually streams.
        thinkingPlaceholder: isThinking,
      })
      window.setTimeout(() => scrollToConversationBottom('smooth'), 0)

      const requestToken = ++responseTokenRef.current
      // Patch the in-flight assistant bubble, ignoring late events from a
      // superseded request (new message / reset bumped the token).
      const patchLoadingMessage = (patch: Partial<ChatMessage>) => {
        if (requestToken !== responseTokenRef.current) return
        setChatMessages((current) =>
          current.map((item) => (item.id === loadingId ? { ...item, ...patch } : item))
        )
      }
      // First text delta flips the typing dots into the streamed answer; later
      // deltas append to it as the answer grows.
      let streamedText = ''
      let receivedDelta = false
      // Reasoning / tool events drive the "Ход рассуждения" panel. They are
      // accumulated locally and pushed into the in-flight bubble on each event.
      let streamedReasoning = ''
      let toolSteps: ToolStep[] = []
      try {
        const result = await sendChat({
          payload: {
            // The feed bubble above shows `prompt`; what goes to the brain may
            // carry the fenced OneX page-context block after it.
            message: outboundMessage,
            conversation_id: assistantSettings.rememberConversationContext
              ? (conversationId ?? undefined)
              : undefined,
            mode: assistantSettings.mode,
            response_mode: assistantSettings.responseMode,
            output_format: assistantSettings.outputFormat,
            // Send the deep-research flag only when on (forward-compatible: the
            // gateway ignores it until it ships support).
            deep_research: assistantSettings.deepResearch ? true : undefined,
            attachments:
              attachmentList.length > 0 ? toChatAttachmentPayload(attachmentList) : undefined,
            // Поле уходит только у экспертного хода — обычный запрос остаётся
            // байт-в-байт прежним.
            expert: expertModel ? { model: expertModel } : undefined,
          },
          callbacks: {
            onMeta: (meta) => {
              // Указатель диалога — сразу, не после done: обновление страницы
              // посреди ответа возвращает оператора в ЭТОТ диалог, где ответ
              // дописывается сервером и подтягивается опросом.
              const id = meta.conversation_id
              if (
                typeof id === 'number' &&
                id > 0 &&
                userId != null &&
                assistantSettings.rememberConversationContext
              ) {
                setActiveConversation(userId, id)
              }
            },
            onText: (delta) => {
              streamedText += delta
              receivedDelta = true
              patchLoadingMessage({ content: streamedText, isLoading: false })
            },
            onReasoning: (delta) => {
              streamedReasoning += delta
              // Keep `isLoading` until the first answer delta: reasoning streams
              // into the panel while the answer bubble still shows the live ход.
              patchLoadingMessage({ reasoning: streamedReasoning })
            },
            onToolStart: (tool) => {
              toolSteps = [
                ...toolSteps,
                {
                  id: `${loadingId}-tool-${toolSteps.length}`,
                  name: tool.name,
                  label: tool.label,
                  status: 'running',
                },
              ]
              patchLoadingMessage({ toolSteps })
            },
            onToolEnd: (tool) => {
              // tool_end has no name — settle the most recent still-running step.
              let settled = false
              toolSteps = toolSteps
                .slice()
                .reverse()
                .map((step) => {
                  if (!settled && step.status === 'running') {
                    settled = true
                    return {
                      ...step,
                      status: (tool.ok ? 'ok' : 'error') as ToolStepStatus,
                      resultPreview: tool.result_preview ?? tool.summary,
                    }
                  }
                  return step
                })
                .reverse()
              patchLoadingMessage({ toolSteps })
            },
            onSources: (sources) => {
              if (sources.tables.length > 0 || sources.tools.length > 0) {
                patchLoadingMessage({ sources })
              }
            },
            // Цитаты факт-сносок: patchLoadingMessage несёт тот же requestToken-
            // guard, что и остальные патчи (см. выше), поэтому доп. проверки нет.
            onCitations: (citations) => patchLoadingMessage({ citations }),
            onFollowups: (questions) => {
              if (questions.length > 0) patchLoadingMessage({ followups: questions })
            },
            onExpert: (usage) => patchLoadingMessage({ expert: usage }),
            onDone: (done) => {
              // Обновляем кружок контекста только по ходам с реальным usage:
              // слеш-команды и уточнения роутера завершаются без него — там
              // показание не менялось, затирать прежнее нечем.
              const snapshot = extractContextUsage(done)
              if (snapshot) setContextUsage(snapshot)
            },
          },
        })
        // The turn reached the brain, so the page context it carried is spent —
        // a conversation must not be re-stamped with the same page on every
        // message. Consumed by identity, so a page the host published while the
        // answer streamed survives for the next turn.
        if (sentContext) consumeOnexContext(sentContext)
        if (requestToken !== responseTokenRef.current) {
          return
        }
        setConversationId(result.conversation_id)
        if (userId != null && assistantSettings.rememberConversationContext) {
          setActiveConversation(userId, result.conversation_id)
        }
        // Reconcile with the final assembled answer (covers the no-delta case
        // and any difference between streamed and final text). The SSE contract
        // returns no per-message id (message_id === 0); the feedback row then
        // stays hidden until the conversation is hydrated with real ids.
        patchLoadingMessage({
          content: receivedDelta ? streamedText : result.response,
          isLoading: false,
          // Turn finished — collapse the reasoning panel (still re-expandable).
          isStreamingReasoning: false,
          // Drop the streaming placeholder; if no reasoning ever arrived the
          // window simply disappears (no empty box left behind).
          thinkingPlaceholder: false,
          // Freeze the reasoning timer at its final value.
          reasoningElapsedMs: Date.now() - reasoningStartedAt,
          serverMessageId: result.message_id > 0 ? result.message_id : undefined,
          // Ожидание закончилось — подпись с таймером уходит, ценник остаётся.
          expertWaitingModel: undefined,
          expert: result.expert,
        })
        if (isExpertTurn) {
          // Ход потратил деньги — счётчик остатка в меню обязан это увидеть.
          void queryClient.invalidateQueries({ queryKey: aiAssistantKeys.capabilities })
        }
      } catch (error) {
        if (requestToken !== responseTokenRef.current) {
          return
        }
        // 503 = the thinking model is temporarily unavailable. It can surface as
        // an HTTP status or as an in-band `event: error` frame (now wrapped in
        // AssistantChatStreamError) — handle both. Fall back to the
        // always-available fast mode and tell the user (ASSISTANT_MODES.md).
        const status =
          error instanceof AssistantChatStreamError
            ? error.status
            : isAxiosError(error)
              ? error.response?.status
              : undefined
        const isThinkingUnavailable = isThinking && status === 503
        // A rejected attachment is something the operator can fix, so the
        // server's own wording goes on screen instead of the catch-all. The two
        // rejections need different advice and must not be collapsed:
        //   422 — *this file* is wrong (type, size, faked signature);
        //   413 — *too much at once*, the fix is to send in smaller batches.
        const serverDetail =
          error instanceof AssistantChatStreamError ? error.serverDetail : undefined
        const errorCode = error instanceof AssistantChatStreamError ? error.code : undefined
        // A 413 has two possible authors and only one of them speaks to the
        // operator. Ours carries a machine code next to its Ukrainian wording;
        // the gateway's own size limit answers `{"message": "Request size limit
        // exceeded"}` — English, about bytes, and useless at the keyboard. So
        // the text is trusted here only when the code proves it is ours;
        // otherwise the localised batch wording stands in.
        const isOurRefusal = Boolean(errorCode)
        // Отказы экспертного хода бэкенд формулирует сам и по-украински —
        // «немає права», «денний ліміт витрат вичерпано (X з Y $)». Показываем
        // их дословно: свои выдумки здесь были бы менее точны, чем текст того,
        // кто отказал.
        const isExpertRefusal = isExpertTurn && (status === 403 || status === 429 || status === 503)
        // 503 — исключение: прокси CRM заменяет текст мозга своим, «Думающий
        // режим сейчас недоступен. Повторите запрос в обычном режиме», потому
        // что на этой формулировке держится откат thinking → fast
        // (`_status_detail` в services/ai-assistant/app/routers/chat.py). Для
        // экспертного хода она неверна вдвойне: он не «думающий», и повторять
        // его «в обычном режиме» — это другой вопрос к другой модели. Здесь
        // текст сервера не показываем, а говорим про внешний сервис сами.
        const showsServerText =
          status === 400 ||
          status === 415 ||
          status === 422 ||
          (status === 413 && isOurRefusal) ||
          (isExpertRefusal && status !== 503)
        const expertFallbackMessage = isExpertRefusal
          ? status === 403
            ? t('pages.aiAssistant.expertForbidden')
            : status === 429
              ? t('pages.aiAssistant.expertLimitReached')
              : t('pages.aiAssistant.expertUnavailable')
          : undefined
        const errorMessage = isThinkingUnavailable
          ? t('pages.aiAssistant.thinkingUnavailable')
          : showsServerText && serverDetail
            ? serverDetail
            : (expertFallbackMessage ??
              (status === 413
                ? t('pages.aiAssistant.attachTotalTooLarge')
                : t('pages.aiAssistant.apiError')))
        if (isThinkingUnavailable) {
          setAssistantSettings((s) => ({ ...s, mode: 'fast' }))
        }
        if (isExpertRefusal) {
          // 403 — права больше нет: снимаем выбор, иначе каждый следующий ход
          // упирается в тот же отказ. 429/503 — препятствие временное, выбор
          // руководителя остаётся за ним.
          if (status === 403) {
            setAssistantSettings((s) => ({ ...s, expertModel: null }))
          }
          void queryClient.invalidateQueries({ queryKey: aiAssistantKeys.capabilities })
        }
        // Give the typed text back so a failed send is one Enter away from a
        // retry — unless the user has already started typing something else.
        if (prompt) setMessage((current) => (current.trim() ? current : prompt))
        toast.error(errorMessage)
        patchLoadingMessage({
          content: errorMessage,
          isLoading: false,
          isError: true,
          isStreamingReasoning: false,
          thinkingPlaceholder: false,
          sources: undefined,
          citations: undefined,
          followups: undefined,
          reasoning: undefined,
          toolSteps: undefined,
          expertWaitingModel: undefined,
          expert: undefined,
        })
      } finally {
        if (requestToken === responseTokenRef.current) {
          respondingRef.current = false
          setIsAssistantResponding(false)
          window.setTimeout(() => scrollToConversationBottom('smooth'), 0)
        }
      }
    },
    [
      activeExpertModel,
      appendChatMessage,
      assistantSettings.deepResearch,
      assistantSettings.mode,
      assistantSettings.outputFormat,
      assistantSettings.rememberConversationContext,
      assistantSettings.responseMode,
      consumeOnexContext,
      conversationId,
      handleNewChat,
      isAssistantResponding,
      isEmbedded,
      onexContext,
      queryClient,
      scrollToConversationBottom,
      sendChat,
      setActiveConversation,
      t,
      userId,
    ]
  )

  /**
   * OneX «ask this now»: the host either spells the question out or names a
   * preset. The text lands in the composer either way, so a command that
   * arrives mid-answer is not lost — it simply waits for the operator to press
   * send instead of queueing behind the running turn.
   *
   * Staged attachments are deliberately left alone (same as a quick action): a
   * host command must not silently consume a file the operator picked for a
   * question they have not asked yet.
   */
  useOnexAsk(isEmbedded, (command) => {
    // Not i18n: the context block around it is a fixed Ukrainian machine contract,
    // and an EN-interface operator firing the preset must not pull the whole
    // turn into an English analysis (see embedContext.ts).
    const prompt = command.text || (command.preset === 'summary' ? ONEX_ASK_SUMMARY_PROMPT : '')
    if (!prompt) return
    setMessage(prompt)
    if (isAssistantResponding) return
    void submitPrompt(prompt)
  })

  // Latest-ref wiring: the recorder hook is declared before submitPrompt.
  useEffect(() => {
    sendVoiceMessageRef.current = (result: VoiceMessageResult) => {
      void (async () => {
        try {
          const data_b64 = await blobToBase64(result.blob)
          const previewUrl = URL.createObjectURL(result.blob)
          attachmentUrlsRef.current.push(previewUrl)
          await submitPrompt('', [
            {
              id: `voice-${Date.now()}`,
              type: 'audio',
              mime: result.mime,
              data_b64,
              previewUrl,
              sizeBytes: result.blob.size,
            },
          ])
        } catch {
          toast.error(t('pages.aiAssistant.voiceError'))
        }
      })()
    }
  }, [submitPrompt, t])

  /**
   * Stage picked files (picker / paste / drop): screenshots and documents alike.
   * Each file is validated against the contract first, then encoded to base64 —
   * a 50MB workbook takes a moment, so admitted files show a "preparing" card
   * until their bytes are ready.
   */
  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      let unsupported = false
      let overflow = false
      let readFailed = false
      let tooLarge = false
      const admitted: { file: File; id: string; type: AttachmentType; mime: string }[] = []

      for (const file of files) {
        const verdict = validateAttachmentFile(file, attachmentCountRef.current + admitted.length)
        if (verdict.ok) {
          admitted.push({
            file,
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: verdict.type,
            mime: verdict.mime,
          })
          continue
        }
        if (verdict.error === 'unsupportedType') unsupported = true
        else if (verdict.error === 'tooLarge') tooLarge = true
        else overflow = true
      }

      if (overflow) toast.error(t('pages.aiAssistant.attachTooMany', { count: MAX_ATTACHMENTS }))
      if (unsupported) toast.error(t('pages.aiAssistant.attachUnsupported'))
      if (tooLarge) {
        toast.error(
          t('pages.aiAssistant.attachTooLarge', {
            limit: formatAttachmentSize(MAX_ATTACHMENT_BYTES),
          })
        )
      }
      if (admitted.length === 0) return

      // Claim the slots before the first `await` so a second pick in the same
      // tick sees them taken.
      attachmentCountRef.current += admitted.length
      setPreparingAttachments((current) => [
        ...current,
        ...admitted.map(({ id, file }) => ({ id, name: file.name, sizeBytes: file.size })),
      ])

      for (const item of admitted) {
        try {
          const data_b64 = await blobToBase64(item.file)
          const previewUrl = URL.createObjectURL(item.file)
          attachmentUrlsRef.current.push(previewUrl)
          setPendingAttachments((current) => [
            ...current,
            {
              id: item.id,
              type: item.type,
              mime: item.mime,
              name: item.file.name,
              data_b64,
              previewUrl,
              sizeBytes: item.file.size,
            },
          ])
        } catch {
          readFailed = true
        } finally {
          setPreparingAttachments((current) => current.filter((entry) => entry.id !== item.id))
        }
      }
      if (readFailed) toast.error(t('pages.aiAssistant.attachReadFailed'))
    },
    [t]
  )

  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((current) => {
      const target = current.find((item) => item.id === id)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
        attachmentUrlsRef.current = attachmentUrlsRef.current.filter(
          (url) => url !== target.previewUrl
        )
      }
      return current.filter((item) => item.id !== id)
    })
  }, [])

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = extractFileEntries(event.clipboardData.items)
      if (files.length === 0) return
      event.preventDefault()
      void addFiles(files)
    },
    [addFiles]
  )

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (files && files.length > 0) {
        void addFiles(Array.from(files))
      }
      // Reset so picking the same file again still fires onChange.
      event.target.value = ''
    },
    [addFiles]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.files.length === 0) return
      // Always swallow file drops — otherwise the browser navigates to the
      // dropped file. Unsupported ones are rejected by addFiles with a toast.
      event.preventDefault()
      void addFiles(extractFileEntries(event.dataTransfer.files))
    },
    [addFiles]
  )

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleMicPointerDown = useCallback(() => {
    if (!assistantSettings.voiceInputEnabled) return
    const everythingIdle =
      dictationStatus === 'idle' && recorderStatus === 'idle' && voiceStatus === 'idle'
    if (!everythingIdle) return
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null
      longPressFiredRef.current = true
      void startVoiceMessage()
    }, LONG_PRESS_MS)
  }, [
    assistantSettings.voiceInputEnabled,
    dictationStatus,
    recorderStatus,
    voiceStatus,
    clearLongPressTimer,
    startVoiceMessage,
  ])

  const handleMicClick = useCallback(() => {
    if (longPressFiredRef.current) {
      // The click that follows a long-press release belongs to the
      // voice-message gesture — ignore it.
      longPressFiredRef.current = false
      return
    }
    if (!assistantSettings.voiceInputEnabled) return
    if (recorderStatus === 'recording') {
      stopVoiceMessage()
      return
    }
    if (dictationStatus === 'listening') {
      stopDictation()
      return
    }
    if (dictationStatus === 'finalizing') return
    if (voiceStatus === 'listening') {
      stopVoiceRecognition()
      return
    }
    startServerDictation()
  }, [
    assistantSettings.voiceInputEnabled,
    recorderStatus,
    dictationStatus,
    voiceStatus,
    stopVoiceMessage,
    stopDictation,
    stopVoiceRecognition,
    startServerDictation,
  ])

  /**
   * Оценка ответа оператором.
   *
   * `messageId === null` — серверный id хода неизвестен (прокси не прислал кадр
   * `persisted`, либо персист не состоялся). Раньше кнопки в этом случае просто не
   * рисовались: оператор не видел ни оценки, ни причины, а на проде это означало
   * НОЛЬ жалоб за 23 дня при живых ходах. Теперь кнопка есть всегда и вслух
   * говорит, почему не вышло, — молчаливого провала здесь больше нет.
   */
  const handleFeedback = useCallback(
    (messageId: number | null, patch: Partial<MessageFeedback>) => {
      if (messageId == null) {
        toast.error(t('pages.aiAssistant.feedbackUnavailable'))
        return
      }
      const previous = feedbackByMessage[messageId]
      const merged: MessageFeedback = { ...previous, ...patch }
      setFeedbackByMessage((current) => ({ ...current, [messageId]: merged }))
      mutateFeedback(
        { message_id: messageId, ...merged },
        {
          onError: () => {
            // Свой текст, а не общий apiError: «оценка не сохранилась» и
            // «ассистент недоступен» — разные события для оператора.
            toast.error(t('pages.aiAssistant.feedbackFailed'))
            setFeedbackByMessage((current) => ({ ...current, [messageId]: previous ?? {} }))
          },
        }
      )
    },
    [feedbackByMessage, mutateFeedback, t]
  )

  // Пометка источника факт-сноски «верно/неверно» (Слой 5). Оптимистично
  // подсвечиваем выбор; повторный клик по тому же вердикту снимает пометку
  // (чисто UI — контракт step-mark выражает только ok/wrong, «снятие» не шлём),
  // клик по другому вердикту — меняет и шлёт POST. Откат при ошибке POST.
  const handleMarkCitation = useCallback(
    (serverMessageId: number, citationId: number, verdict: AssistantCitationVerdict) => {
      const previousVerdict = citationMarksByMessage[serverMessageId]?.[citationId]
      const nextVerdict = previousVerdict === verdict ? undefined : verdict

      const applyVerdict = (value: AssistantCitationVerdict | undefined) => {
        setCitationMarksByMessage((current) => {
          const forMessage = { ...(current[serverMessageId] ?? {}) }
          if (value == null) delete forMessage[citationId]
          else forMessage[citationId] = value
          return { ...current, [serverMessageId]: forMessage }
        })
      }

      applyVerdict(nextVerdict)

      // Снятие пометки контракт не выражает (только ok/wrong) — держим локально.
      if (nextVerdict == null) return

      mutateMarkCitation(
        { message_id: serverMessageId, citation_id: citationId, verdict: nextVerdict },
        {
          onError: () => {
            toast.error(t('pages.aiAssistant.apiError'))
            applyVerdict(previousVerdict)
          },
        }
      )
    },
    [citationMarksByMessage, mutateMarkCitation, t]
  )

  // Resolve whether a message's reasoning panel is open: an explicit user
  // Панель раздумий НЕ выезжает автоматически: по умолчанию свёрнута, открывается
  // ТОЛЬКО явным кликом по плашке «Ход рассуждения» (toggleReasoning) или по факту.
  // Плашка при стриме показывает live-индикатор, но само окно ждёт нажатия кнопки.
  const isReasoningOpen = useCallback(
    (item: ChatMessage) => reasoningOpenByMessage[item.id] ?? false,
    [reasoningOpenByMessage]
  )

  const toggleReasoning = useCallback((item: ChatMessage) => {
    setReasoningOpenByMessage((current) => {
      const open = current[item.id] ?? false
      return { ...current, [item.id]: !open }
    })
  }, [])

  // Идемпотентно ОТКРЫТЬ панель для сообщения (в отличие от toggle — никогда не
  // сворачивает). Используется кликом по факт-сноске: активной становится
  // последняя открытая ветка (см. activeReasoningMessage).
  const openReasoning = useCallback((item: ChatMessage) => {
    setReasoningOpenByMessage((current) => ({ ...current, [item.id]: true }))
  }, [])

  const closeReasoning = useCallback((item: ChatMessage) => {
    setReasoningOpenByMessage((current) => ({ ...current, [item.id]: false }))
    // Закрыли ход — снимаем фокус на его источнике (чтобы повторное открытие
    // через чип не подсвечивало старый источник).
    setFocusedCitation((current) => (current?.messageId === item.id ? null : current))
  }, [])

  // Клик по факт-сноске `[[N]]` открывает панель «Активность» этого сообщения и
  // разворачивает КОНКРЕТНЫЙ источник n: фокус ведёт к авто-скроллу + подсветке
  // источника в секции «Источники» (см. ReasoningActivityPanel / focusedCitationId).
  const openReasoningForFact = useCallback(
    (item: ChatMessage, n: number) => {
      setFocusedCitation({ messageId: item.id, citationId: n })
      openReasoning(item)
    },
    [openReasoning]
  )

  // Single timestamp per render for the "Xс" reasoning timer — recomputed on
  // every render (streamed deltas re-render), so no interval is needed. The
  // final value is frozen into `reasoningElapsedMs` when the turn settles.
  const reasoningNow = Date.now()

  // The one assistant message whose activity panel is open (latest wins): an
  // explicit toggle or the live stream. Drives the single fixed side panel and
  // the composer/ribbon offset.
  const activeReasoningMessage = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const item = chatMessages[i]
      if (item.role !== 'assistant' || item.isError) continue
      if (!messageHasActivity(item, assistantSettings.showReasoning)) continue
      if (isReasoningOpen(item)) return item
    }
    return null
  }, [chatMessages, isReasoningOpen, assistantSettings.showReasoning])

  const isReasoningPanelOpen = activeReasoningMessage != null
  // Номер источника для подсветки в панели — только если фокус принадлежит
  // активному сообщению (иначе клик по факту в одном ходе подсветил бы источник
  // с тем же номером в другом открытом ходе).
  const focusedCitationId =
    focusedCitation != null &&
    activeReasoningMessage != null &&
    focusedCitation.messageId === activeReasoningMessage.id
      ? focusedCitation.citationId
      : null
  // Live width during a drag (parent-owned so the composer/ribbon shift in
  // lockstep); the committed value is persisted in the store.
  const storedReasoningPanelWidth = useAiAssistantStore((state) => state.reasoningPanelWidth)
  const setStoredReasoningPanelWidth = useAiAssistantStore((state) => state.setReasoningPanelWidth)
  const [reasoningPanelWidth, setReasoningPanelWidth] = useState(storedReasoningPanelWidth)
  const activeReasoningElapsed =
    activeReasoningMessage != null ? reasoningElapsedMs(activeReasoningMessage, reasoningNow) : null

  // Слой 5: пометки «верно/неверно» доступны только когда у активного сообщения
  // есть серверный message_id (после гидратации диалога). Пометки берём по нему из
  // стейта; клик прокидывает id внутрь handleMarkCitation.
  const activeServerMessageId = activeReasoningMessage?.serverMessageId ?? null
  const activeCitationMarks =
    activeServerMessageId != null
      ? (citationMarksByMessage[activeServerMessageId] ?? EMPTY_CITATION_MARKS)
      : EMPTY_CITATION_MARKS
  const handleActiveMarkCitation = useCallback(
    (citationId: number, verdict: AssistantCitationVerdict) => {
      if (activeServerMessageId == null) return
      handleMarkCitation(activeServerMessageId, citationId, verdict)
    },
    [activeServerMessageId, handleMarkCitation]
  )

  const feedbackButtonClass = (isChosen: boolean, isGroupLocked: boolean) =>
    cn(
      'inline-flex min-h-7 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors',
      isChosen && 'border-primary-300 bg-primary-50 text-primary-700',
      !isChosen && isGroupLocked && 'border-border bg-card text-muted-foreground/60',
      !isChosen &&
        !isGroupLocked &&
        'hover:border-primary-300 hover:text-primary-600 cursor-pointer border-border bg-card text-muted-foreground',
      isGroupLocked && 'cursor-default'
    )

  const renderTtsButton = (item: ChatMessage) => {
    const isTtsPlaying = ttsPlayer.playingId === item.id
    const isTtsLoading = ttsPlayer.loadingId === item.id
    return (
      <button
        type="button"
        aria-label={t(isTtsPlaying ? 'pages.aiAssistant.ttsStop' : 'pages.aiAssistant.ttsListen')}
        aria-pressed={isTtsPlaying}
        onClick={() =>
          ttsPlayer.toggle(item.id, prepareTtsText(item.content), resolveTtsVoice(i18n.language))
        }
        className={feedbackButtonClass(isTtsPlaying || isTtsLoading, false)}
      >
        {isTtsLoading ? (
          <span
            className="border-border h-3.5 w-3.5 animate-spin rounded-full border border-t-transparent"
            aria-hidden
          />
        ) : isTtsPlaying ? (
          <Icons.Pause size={14} strokeWidth={1.5} />
        ) : (
          <Icons.VolumeHigh size={14} strokeWidth={1.5} />
        )}
      </button>
    )
  }

  const renderFeedbackControls = (serverMessageId: number | null) => {
    // Без серверного id хранить нечего — состояние пустое, а клик уходит в
    // honest-путь handleFeedback (тост, не тишина).
    const feedback = serverMessageId == null ? {} : (feedbackByMessage[serverMessageId] ?? {})
    const ratingLocked = feedback.rating != null
    const comprehensionLocked = feedback.comprehension != null

    return (
      <>
        <button
          type="button"
          aria-label={t('pages.aiAssistant.feedbackUseful')}
          aria-pressed={feedback.rating === 'useful'}
          disabled={ratingLocked}
          onClick={() => handleFeedback(serverMessageId, { rating: 'useful' })}
          className={feedbackButtonClass(feedback.rating === 'useful', ratingLocked)}
        >
          <Icons.ThumbsUp size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={t('pages.aiAssistant.feedbackNotUseful')}
          aria-pressed={feedback.rating === 'not_useful'}
          disabled={ratingLocked}
          onClick={() => handleFeedback(serverMessageId, { rating: 'not_useful' })}
          className={feedbackButtonClass(feedback.rating === 'not_useful', ratingLocked)}
        >
          <Icons.ThumbsDown size={14} strokeWidth={1.5} />
        </button>
        <span className="bg-border mx-0.5 h-4 w-px" aria-hidden />
        <button
          type="button"
          aria-pressed={feedback.comprehension === 'clear'}
          disabled={comprehensionLocked}
          onClick={() => handleFeedback(serverMessageId, { comprehension: 'clear' })}
          className={feedbackButtonClass(feedback.comprehension === 'clear', comprehensionLocked)}
        >
          {t('pages.aiAssistant.feedbackClear')}
        </button>
        <button
          type="button"
          aria-pressed={feedback.comprehension === 'unclear'}
          disabled={comprehensionLocked}
          onClick={() => handleFeedback(serverMessageId, { comprehension: 'unclear' })}
          className={feedbackButtonClass(feedback.comprehension === 'unclear', comprehensionLocked)}
        >
          {t('pages.aiAssistant.feedbackUnclear')}
        </button>
      </>
    )
  }

  /**
   * Ценник экспертного хода: «Sonnet · $0.05». Без цифр (бэкенд их не прислал)
   * остаётся одна модель — так видно, что отвечал внешний Claude, даже когда
   * стоимость неизвестна.
   */
  const renderExpertCost = (usage: AssistantExpertUsage) => (
    <span
      data-testid="assistant-expert-cost"
      title={expertTokensTitle(usage, t)}
      className="border-border bg-muted/60 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-light"
    >
      <Icons.Sparkles size={12} strokeWidth={1.5} className="text-primary-500 shrink-0" />
      {usage.costUsd != null
        ? `${expertModelLabel(usage.model)} · ${formatUsd(usage.costUsd)}`
        : expertModelLabel(usage.model)}
    </span>
  )

  /** TTS playback + feedback in one row under an assistant bubble. */
  const renderAssistantActions = (item: ChatMessage) => (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1">
      {renderTtsButton(item)}
      {item.expert && renderExpertCost(item.expert)}
      {/* Оценка есть у ЛЮБОГО дописанного ответа. Прятать её при неизвестном
          серверном id значило прятать и сам факт, что оценить нельзя. */}
      <span className="bg-border mx-0.5 h-4 w-px" aria-hidden />
      {renderFeedbackControls(item.serverMessageId ?? null)}
    </div>
  )

  /**
   * Compact reasoning summary shown in the answer bubble — a toggle that opens
   * the «Активность» side panel. Only for thinking-style turns that actually
   * carry reasoning / tool-steps / the pre-open placeholder; fast turns render
   * nothing (as before). The full ход рассуждения lives in the side panel.
   */
  const renderReasoningChip = (item: ChatMessage) => {
    // Показываем чип при ЛЮБОЙ активности (раздумья/шаги ИЛИ источники), а не
    // только при reasoning: у fast-хода раздумий нет, но источники факт-сносок
    // есть — без чипа они после гидратации/перезагрузки истории становятся
    // недоступны (панель нельзя открыть). Чип корректно деградирует на пустом
    // reasoning + нулевом stepCount (см. ReasoningInlineChip).
    if (!messageHasActivity(item, assistantSettings.showReasoning)) return null
    const elapsed = reasoningElapsedMs(item, reasoningNow)
    return (
      <ReasoningInlineChip
        open={isReasoningOpen(item)}
        streaming={Boolean(item.isStreamingReasoning)}
        // Раздумья скрыты — не отдаём их и в тизер плашки (иначе последняя мысль
        // всё равно попадала бы оператору на глаза).
        reasoning={assistantSettings.showReasoning ? (item.reasoning ?? '') : ''}
        stepCount={item.toolSteps?.length ?? 0}
        elapsedLabel={elapsed != null ? formatReasoningDuration(elapsed) : null}
        onToggle={() => toggleReasoning(item)}
      />
    )
  }

  /** One labelled row of source chips (tables or tools). */
  const renderSourceRow = (label: string, items: string[]) =>
    items.length > 0 ? (
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
        {items.map((item, index) => (
          <span
            key={index}
            className="text-foreground bg-muted inline-flex max-w-full items-center rounded px-1.5 py-0.5 font-mono text-[10px] leading-snug"
          >
            <span className="truncate">{item}</span>
          </span>
        ))}
      </div>
    ) : null

  /** Compact "source of the numbers" block (tables + tools) under an answer. */
  const renderSources = (sources: AssistantSources) => (
    <div
      data-testid="assistant-sources"
      className="border-border bg-muted/60 mt-2 w-full max-w-full space-y-1 rounded-xl border px-3 py-2"
    >
      <div className="text-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-tight">
        <Icons.Info size={13} strokeWidth={1.5} className="text-muted-foreground" />
        {t('pages.aiAssistant.sourcesTitle')}
      </div>
      {renderSourceRow(t('pages.aiAssistant.sourcesTables'), sources.tables)}
      {renderSourceRow(t('pages.aiAssistant.sourcesTools'), sources.tools)}
    </div>
  )

  /** Clickable follow-up suggestion chips; a click sends the chip text. */
  const renderFollowups = (followups: string[]) => (
    <div
      data-testid="assistant-followups"
      className="mt-2 flex flex-wrap gap-1.5"
      role="group"
      aria-label={t('pages.aiAssistant.followupsTitle')}
    >
      {followups.map((followup, index) => (
        <button
          key={index}
          type="button"
          disabled={isAssistantResponding}
          onClick={() => void submitPrompt(followup)}
          className="border-primary-200 bg-primary-50/50 text-primary-700 hover:border-primary-300 hover:bg-primary-50 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-snug font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icons.Search size={12} strokeWidth={1.5} className="shrink-0" />
          <span className="truncate">{followup}</span>
        </button>
      ))}
    </div>
  )

  const activeSidebarConversationId = conversationId ?? storedConversationId
  const isVoiceActive =
    voiceStatus === 'listening' || dictationStatus !== 'idle' || recorderStatus === 'recording'

  if (aiSettings?.assistant_enabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="border-border bg-card max-w-md rounded-xl border p-6 text-center shadow-sm">
          <div className="text-foreground text-sm font-medium">
            {t('pages.aiSettings.disabledBanner')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={pageRootRef}
      // Reserve room on the right for the open «Активность» panel (desktop): the
      // message ribbon is pushed left by the panel width so it never slides
      // under the panel. The fixed dock mirrors this via getDockRightOffset.
      style={{
        paddingRight:
          !isMobileOrTablet && isReasoningPanelOpen ? `${reasoningPanelWidth}px` : undefined,
      }}
      data-testid={isEmbedded ? 'assistant-onex-dock' : undefined}
      className={cn(
        'relative flex w-full min-w-0 flex-1 flex-col self-stretch overflow-x-hidden',
        // The dashboard header (80px top padding + 20px bottom) is not there in
        // the dock, so the chat gets the whole host window height.
        isEmbedded
          ? 'min-h-screen supports-[height:100dvh]:min-h-[100dvh]'
          : 'min-h-[calc(100vh-5.5rem)] supports-[height:100dvh]:min-h-[calc(100dvh-5.5rem)]',
        // Reserve space for the fixed history panel (its width + a 1rem gap).
        !isMobileOrTablet &&
          'lg:transition-[padding] lg:duration-300 ' +
            (isHistoryCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[18.5rem]')
      )}
    >
      {/* Conversation history — Claude-style panel on the left (desktop only,
          the mobile counterpart is the drawer overlay below). Fixed like the
          input dock: the page scrolls at window level (<main> only grows), so
          sticky positioning cannot pin the panel. Left offset clears the
          dashboard sidebar rail (72px collapsed / 240px expanded) plus the
          28px <main> padding. */}
      {!isMobileOrTablet && (
        <aside
          className={cn(
            'fixed top-[80px] bottom-[20px] z-10 hidden transition-[left,width] duration-300 lg:block',
            isHistoryCollapsed ? 'w-14' : 'w-[17.5rem]',
            isOpenSideBar ? 'left-[16.75rem]' : 'left-[6.25rem]'
          )}
        >
          <ConversationSidebar
            activeConversationId={activeSidebarConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            collapsed={isHistoryCollapsed}
            onCollapsedChange={setHistoryCollapsed}
          />
        </aside>
      )}

      {/* Mobile history trigger: fixed below the dashboard header so it stays
          reachable in a scrolled chat (sticky elements never pin here — see
          the note on the panel above). In the OneX dock the history panel is
          gone for good (no width for it) and there is no dashboard header to
          clear, so the same button sits at the very top and keeps past chats
          plus "new chat" one tap away through the drawer — at every width,
          hence no `lg:hidden` there. */}
      {isMobileOrTablet && (
        <button
          type="button"
          aria-label={t('pages.aiAssistant.historyOpenAria')}
          onClick={() => setIsHistoryDrawerOpen(true)}
          className={cn(
            'border-border text-foreground hover:bg-muted bg-card/95 fixed z-30 flex h-9 w-9 items-center justify-center rounded-full border shadow-md transition-colors',
            isEmbedded ? 'top-2 left-2' : 'top-[68px] left-3 lg:hidden'
          )}
        >
          <Icons.MessageMultiple01 size={18} strokeWidth={1.5} />
        </button>
      )}

      <div className="pointer-events-none sticky top-0 z-1 flex w-full justify-center px-3 pt-2">
        <span className="border-warning-200 bg-warning-100/95 text-warning-700 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm">
          <span className="bg-warning-500 h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden />
          {t('pages.aiAssistant.betaBadge')}
        </span>
      </div>

      {hasConversation ? (
        <div
          className={cn(
            'relative min-h-0 flex-1',
            // Dock: no room for the wide desktop gutters — the ribbon runs
            // nearly edge to edge in a ~420px sidebar.
            isEmbedded
              ? 'px-2 pt-2'
              : 'px-3 pt-3 sm:px-8 sm:pt-5 md:px-10 lg:px-14 lg:pt-6 xl:px-20'
          )}
          style={{ paddingBottom: `${dockHeight}px` }}
        >
          <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
            <div className="mx-auto w-full max-w-4xl space-y-3 sm:space-y-4 2xl:max-w-5xl">
              {chatMessages.map((item) => {
                // Reasoning fills the answer-bubble width track (symmetric with
                // the answer), so a bubble carrying reasoning/tool-steps/the
                // thinking placeholder stretches to its max width instead of
                // shrinking to the short header (w-fit) — the reasoning box then
                // uses the full available width rather than looking narrow.
                const hasReasoningSurface =
                  item.role === 'assistant' &&
                  !item.isError &&
                  messageHasActivity(item, assistantSettings.showReasoning)
                return (
                  <div
                    key={item.id}
                    className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'flex max-w-[min(100%,22rem)] flex-col sm:max-w-[min(100%,85%)] md:max-w-2xl lg:max-w-3xl',
                        hasReasoningSurface ? 'w-full' : 'w-fit',
                        item.role === 'user' ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-full rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:px-4 sm:py-3',
                          hasReasoningSurface ? 'w-full' : 'w-fit',
                          item.role === 'user'
                            ? 'bg-secondary-800 text-secondary-foreground'
                            : 'text-foreground border-border bg-card border',
                          (item.role === 'user' || item.isLoading || item.isError) &&
                            'whitespace-pre-wrap',
                          item.isError && 'border-error-200 bg-error-50/60 text-error-700'
                        )}
                        // The conversation itself (KAN-KB-54): operators ask about
                        // clients by name and the answers quote the data back. One
                        // attribute on the bubble covers every TEXT NODE inside it —
                        // the question, the answer, the citations, the attachment
                        // names as displayed. It covers no attribute: those the
                        // tracker sends verbatim, which is why the attachment card
                        // below carries no `title` and uses <PiiTooltip> instead.
                        {...piiProps}
                      >
                        {item.attachments && item.attachments.length > 0 && (
                          <div className={cn('flex flex-col gap-2', item.content && 'mb-2')}>
                            {item.attachments.map((attachment, index) => {
                              if (attachment.type === 'image') {
                                return (
                                  <img
                                    key={index}
                                    src={attachment.url}
                                    alt={t('pages.aiAssistant.attachedImageAlt')}
                                    className="max-h-48 max-w-full rounded-lg object-contain"
                                  />
                                )
                              }
                              if (attachment.type === 'document') {
                                // The card is the record that the operator sent
                                // this file — the parsed content lives server-side.
                                return (
                                  <div
                                    key={index}
                                    data-testid="message-attachment-document"
                                    className="border-border/60 bg-background/10 flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-2"
                                  >
                                    <AttachmentIcon mime={attachment.mime} />
                                    <div className="min-w-0">
                                      {/* A file attached to a client's case is
                                          named after the client more often than
                                          not. The hover-reveal of the truncated
                                          name goes through a tooltip, whose
                                          content is a text node the markup
                                          masks; a `title` would be sent as-is. */}
                                      <PiiTooltip label={attachment.name}>
                                        <p className="max-w-[14rem] truncate text-xs font-medium">
                                          {attachment.name}
                                        </p>
                                      </PiiTooltip>
                                      {attachment.sizeBytes != null && (
                                        <p className="text-[11px] opacity-70">
                                          {formatAttachmentSize(attachment.sizeBytes)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )
                              }
                              return (
                                // eslint-disable-next-line jsx-a11y/media-has-caption -- voice note, no transcript available client-side
                                <audio
                                  key={index}
                                  controls
                                  src={attachment.url}
                                  aria-label={t('pages.aiAssistant.voiceMessageBubbleLabel')}
                                  className="h-10 max-w-full"
                                />
                              )
                            })}
                          </div>
                        )}
                        {/* Live "Ход рассуждения": shown above the answer both
                          while the turn streams and (collapsed) afterwards. */}
                        {item.role === 'assistant' && !item.isError && renderReasoningChip(item)}
                        {item.isLoading ? (
                          // Generic typing dots only until something concrete is
                          // streaming — once reasoning/tool events arrive (or the
                          // thinking window is pre-opened) the panel above is the
                          // live indicator, so the dots stand down.
                          item.reasoning ||
                          item.thinkingPlaceholder ||
                          (item.toolSteps && item.toolSteps.length > 0) ? null : (
                            <span className="inline-flex items-center gap-1.5 py-1">
                              <span className="bg-secondary-500 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
                              <span className="bg-secondary-500 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
                              <span className="bg-secondary-500 h-1.5 w-1.5 animate-bounce rounded-full" />
                              {item.expertWaitingModel ? (
                                <ExpertWaitingLabel model={item.expertWaitingModel} />
                              ) : (
                                item.loadingLabel && (
                                  <span className="text-muted-foreground ml-1.5 text-xs font-light">
                                    {item.loadingLabel}
                                  </span>
                                )
                              )}
                            </span>
                          )
                        ) : item.role === 'assistant' && !item.isError ? (
                          <MarkdownMessage
                            className={MARKDOWN_BODY_CLASS}
                            citations={mapCitations(item.citations)}
                            onFactClick={(n) => openReasoningForFact(item, n)}
                          >
                            {item.content}
                          </MarkdownMessage>
                        ) : (
                          item.content
                        )}
                        {item.role === 'assistant' &&
                          !item.isError &&
                          item.sources &&
                          (item.sources.tables.length > 0 || item.sources.tools.length > 0) &&
                          renderSources(item.sources)}
                      </div>
                      {item.role === 'assistant' &&
                        !item.isLoading &&
                        !item.isError &&
                        renderAssistantActions(item)}
                      {item.role === 'assistant' &&
                        !item.isLoading &&
                        !item.isError &&
                        item.followups &&
                        item.followups.length > 0 &&
                        renderFollowups(item.followups)}
                    </div>
                  </div>
                )
              })}
              {/* Bottom anchor + a small spacer so the last bubble / streaming
                  reasoning keeps a visible gap above the fixed composer even
                  before the measured dock height settles. */}
              <div ref={chatBottomRef} className="h-2" />
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col items-center justify-center',
            isEmbedded ? 'px-2' : 'px-3 sm:px-8 md:px-10 lg:px-14 xl:px-20'
          )}
          style={{ paddingBottom: `${dockHeight}px` }}
        >
          <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 text-center sm:gap-5">
            <span className="relative inline-flex h-10 items-center sm:h-12">
              <img
                src="/logo-l.svg"
                alt={t('app.name')}
                className="sidebar-brand-logo-light h-10 w-auto sm:h-12"
              />
              <img
                src="/logo.svg"
                alt=""
                aria-hidden
                className="sidebar-brand-logo-dark h-10 w-auto sm:h-12"
              />
            </span>
            <span className="text-foreground text-center text-2xl leading-[129%] font-light tracking-[-0.04em] sm:text-[28px] lg:text-[30px] lg:tracking-[-0.6px]">
              {t('pages.aiAssistant.greeting')}
            </span>
          </div>
        </div>
      )}

      <div
        ref={dockRef}
        // When the «Активность» panel is open (desktop), shift the dock's right
        // edge left by the panel width so the composer never slides under it —
        // geometrically mirroring the page-root paddingRight above. Inline
        // `right` overrides the resting `lg:right-7`; undefined restores it.
        style={{
          right: getDockRightOffset(isReasoningPanelOpen, isMobileOrTablet, reasoningPanelWidth),
        }}
        className={cn(
          // Desktop: pin the fixed dock to the exact same box as the chat
          // content area (see dockGeometry.ts), so the input card and the
          // quick actions share one column centre with the message ribbon in
          // every sidebar combination. Mobile keeps the full-width box.
          'pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex w-full min-w-0 shrink-0 flex-col items-center transition-[left,right] duration-300',
          isEmbedded
            ? 'px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]'
            : 'px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-6 md:px-10 lg:px-14 xl:px-20',
          getDockDesktopBoxClasses(isOpenSideBar, isHistoryCollapsed, isEmbedded)
        )}
      >
        {hasConversation && showScrollToLatest && (
          <button
            type="button"
            aria-label={t('pages.aiAssistant.scrollToLatestAria')}
            onClick={() => scrollToConversationBottom('smooth')}
            className="border-border text-foreground hover:bg-muted bg-card pointer-events-auto absolute -top-3 left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-md transition-colors sm:-top-4"
          >
            <Icons.ArrowDown size={16} strokeWidth={1.5} />
          </button>
        )}
        <div className="pointer-events-auto mx-auto w-full max-w-5xl min-w-0 2xl:max-w-6xl">
          <div
            className={cn(
              'border-border/60 bg-card/95 shadow-foreground/5 rounded-2xl border shadow-lg',
              isEmbedded ? 'p-2' : 'p-3 sm:rounded-3xl sm:p-5'
            )}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) e.preventDefault()
            }}
            onDrop={handleDrop}
            data-testid="pending-attachments-dropzone"
          >
            {(pendingAttachments.length > 0 || preparingAttachments.length > 0) && (
              <div className="mb-2 flex flex-wrap gap-2" data-testid="pending-attachments">
                {pendingAttachments.map((attachment) =>
                  attachment.type === 'image' ? (
                    <div
                      key={attachment.id}
                      className="border-border bg-card relative h-16 w-16 overflow-hidden rounded-lg border"
                      data-testid="pending-attachment-image"
                    >
                      <img
                        src={attachment.previewUrl}
                        alt={t('pages.aiAssistant.attachedImageAlt')}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={t('pages.aiAssistant.attachImageRemove')}
                        onClick={() => removePendingAttachment(attachment.id)}
                        className="absolute top-0.5 right-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <Icons.Cancel01 size={12} strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={attachment.id}
                      className="border-border bg-muted/40 flex h-16 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2"
                      data-testid="pending-attachment-document"
                    >
                      <AttachmentIcon mime={attachment.mime} />
                      <div className="min-w-0">
                        <PiiTooltip label={attachment.name}>
                          <p
                            className="text-foreground max-w-[11rem] truncate text-xs font-medium"
                            {...piiProps}
                          >
                            {attachment.name}
                          </p>
                        </PiiTooltip>
                        <p className="text-muted-foreground text-[11px]">
                          {formatAttachmentSize(attachment.sizeBytes)}
                        </p>
                      </div>
                      <button
                        type="button"
                        // The role, not the file name: an aria-label is sent to
                        // the recording verbatim. The name is right beside the
                        // button as (masked) text, so nothing is lost for a reader.
                        aria-label={t(
                          'pages.aiAssistant.attachmentRemoveShort',
                          'Remove attachment'
                        )}
                        onClick={() => removePendingAttachment(attachment.id)}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                      >
                        <Icons.Cancel01 size={12} strokeWidth={2} />
                      </button>
                    </div>
                  )
                )}
                {preparingAttachments.map((item) => (
                  <div
                    key={item.id}
                    className="border-border bg-muted/40 flex h-16 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2"
                    data-testid="pending-attachment-preparing"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="border-primary-500 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
                    <div className="min-w-0">
                      <PiiTooltip label={item.name}>
                        <p
                          className="text-foreground max-w-[11rem] truncate text-xs font-medium"
                          {...piiProps}
                        >
                          {item.name}
                        </p>
                      </PiiTooltip>
                      <p className="text-muted-foreground text-[11px]">
                        {t('pages.aiAssistant.attachPreparing')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isEmbedded && onexContext && (
              <OnexContextChip context={onexContext} onClear={clearOnexContext} />
            )}

            {/* Экспертный режим включён — руководитель видит ДО отправки, что
                этот вопрос уйдёт во внешний сервис. Констатация, не
                предупреждение: отправлять данные туда решено осознанно. */}
            {activeExpertModel && (
              <div
                data-testid="assistant-expert-external-notice"
                className="border-primary-200 bg-primary-50/60 text-muted-foreground mb-2 flex items-center gap-2 rounded-xl border border-dashed px-2.5 py-1.5 text-[11px] font-light"
              >
                <Icons.Link01 size={14} strokeWidth={1.5} className="text-primary-600 shrink-0" />
                <span className="min-w-0 flex-1">
                  {t('pages.aiAssistant.expertComposerNotice', {
                    model: expertModelLabel(activeExpertModel),
                  })}
                </span>
              </div>
            )}

            <div className="relative">
              <SlashCommandMenu
                items={slashItems}
                activeIndex={Math.min(slashActiveIndex, Math.max(slashItems.length - 1, 0))}
                onSelect={applySlashCommand}
              />
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  // Ручной ввод снимает «закрыто по Esc» — меню слеш-команд
                  // снова следует за содержимым поля.
                  setSlashDismissed(false)
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (slashItems.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setSlashActiveIndex((i) => (i + 1) % slashItems.length)
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setSlashActiveIndex((i) => (i - 1 + slashItems.length) % slashItems.length)
                      return
                    }
                    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                      e.preventDefault()
                      applySlashCommand(
                        slashItems[Math.min(slashActiveIndex, slashItems.length - 1)]
                      )
                      return
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setSlashDismissed(true)
                      return
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    // Sending now would leave the still-encoding files behind.
                    if (preparingAttachments.length > 0) {
                      toast.error(t('pages.aiAssistant.attachStillPreparing'))
                      return
                    }
                    void submitPrompt(message, pendingAttachments)
                  }
                }}
                // The grey draft ghost is drawn over the textarea — the
                // placeholder underneath would collide with it visually.
                placeholder={dictationDraft ? '' : t('pages.aiAssistant.inputPlaceholder')}
                className={cn(
                  'ai-chat-input-scrollbar max-h-[min(40vh,16rem)] min-h-[52px] resize-none overflow-y-auto border-0 bg-transparent py-2 pr-2 pl-1 text-sm shadow-none sm:max-h-none sm:min-h-[120px] sm:text-base',
                  'placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0'
                )}
                aria-label={t('pages.aiAssistant.inputPlaceholder')}
              />
              {/* Grey non-editable dictation tail: a ghost layer with the same
                  metrics as the textarea — the committed text is transparent,
                  the live draft continues it in grey. */}
              {dictationDraft && (
                <div
                  ref={dictationGhostRef}
                  aria-hidden
                  data-testid="dictation-ghost"
                  className="ai-chat-input-scrollbar pointer-events-none absolute inset-0 max-h-[min(40vh,16rem)] min-h-[52px] overflow-y-auto py-2 pr-2 pl-1 text-sm font-light break-words whitespace-pre-wrap sm:max-h-none sm:min-h-[120px] sm:text-base"
                >
                  <span className="text-transparent">{message}</span>
                  <span className="text-muted-foreground">
                    {(message ? ' ' : '') + dictationDraft}
                  </span>
                </div>
              )}
            </div>

            {voiceStatus === 'listening' && (
              <div
                className="border-primary-200 bg-primary-50/60 text-foreground mb-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-light"
                role="status"
                aria-live="polite"
              >
                <span className="bg-primary-500 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full" />
                <span className="min-w-0 flex-1">
                  {interimTranscript.trim()
                    ? interimTranscript
                    : t('pages.aiAssistant.voiceListening')}
                </span>
              </div>
            )}

            {voiceStatus !== 'listening' && dictationStatus !== 'idle' && (
              <div
                className="border-primary-200 bg-primary-50/60 text-foreground mb-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-light"
                role="status"
                aria-live="polite"
              >
                <span className="bg-primary-500 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full" />
                <span className="min-w-0 flex-1">
                  {dictationStatus === 'finalizing'
                    ? t('pages.aiAssistant.voiceFinalizing')
                    : t('pages.aiAssistant.voiceListening')}
                </span>
              </div>
            )}

            {recorderStatus === 'recording' && (
              <div
                className="border-error-200 bg-error-50/60 text-foreground mb-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-light"
                role="status"
                aria-live="polite"
              >
                <span className="bg-error-500 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full" />
                <span className="min-w-0 flex-1">
                  {t('pages.aiAssistant.voiceMessageRecording')}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
                  {formatRecordingTime(recorderElapsedSec)} /{' '}
                  {formatRecordingTime(assistantSettings.voiceMaxDurationSec)}
                </span>
                <button
                  type="button"
                  aria-label={t('pages.aiAssistant.voiceMessageCancel')}
                  onClick={cancelVoiceMessage}
                  className="hover:text-error-600 text-muted-foreground flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                >
                  <Icons.Cancel01 size={14} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label={t('pages.aiAssistant.voiceMessageSend')}
                  onClick={stopVoiceMessage}
                  className="bg-primary-500 hover:bg-primary-600 text-primary-foreground flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors"
                >
                  <Icons.MailSend01 size={14} strokeWidth={1.5} />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              <div className="flex shrink-0 items-center gap-2">
                {/* Composer "+" hub: attach / CRM actions / deep research /
                    context — Claude / ChatGPT "+" pattern. */}
                <ComposerHubMenu
                  onAttach={() => fileInputRef.current?.click()}
                  onQuickAction={(key) => void submitPrompt(quickActionPrompts[key])}
                  quickActionDisabled={isAssistantResponding}
                  deepResearch={assistantSettings.deepResearch}
                  onToggleDeepResearch={() =>
                    applySettings((s) => ({ ...s, deepResearch: !s.deepResearch }))
                  }
                  clientScope={clientScope}
                  clientOptions={clientOptions}
                  onClientScopeChange={setClientScope}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  multiple
                  className="hidden"
                  data-testid="attach-image-input"
                  onChange={handleFileInputChange}
                />

                <div className="relative shrink-0">
                  <button
                    ref={settingsTriggerRef}
                    type="button"
                    onClick={() => setIsSettingsOpen((open) => !open)}
                    aria-expanded={isSettingsOpen}
                    aria-label={t('pages.aiAssistant.settings')}
                    className="text-muted-foreground hover:text-primary-600 border-border bg-card flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors sm:h-7 sm:w-7"
                  >
                    <Icons.Settings size={16} strokeWidth={1.5} />
                  </button>
                  {!isMobileOrTablet && isSettingsOpen && (
                    <div
                      ref={settingsPanelRef}
                      className="absolute bottom-full left-0 z-30 mb-3 flex max-h-[min(52vh,calc(100dvh-11rem))] w-[min(calc(100vw-1.5rem),28rem)] min-w-0 flex-col"
                    >
                      {settingsPanel}
                    </div>
                  )}
                </div>

                {/* Заполненность контекста мозга — как кружок в Claude Code. */}
                <ContextUsageRing usage={contextUsage} />
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.client')}
                  value={clientScope}
                  onChange={setClientScope}
                  options={clientOptions}
                />
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.period')}
                  value={period}
                  onChange={setPeriod}
                  options={periodOptions}
                />

                {/* Reasoning-mode picker (source of truth for `mode`) + тумблер
                    видимости раздумий. */}
                <ModeDropdown
                  value={assistantSettings.mode}
                  // Выбор обычного режима снимает экспертный: пункты меню
                  // взаимоисключающие, «Швидкий + Експерт» одновременно не бывает.
                  onChange={(mode) => applySettings((s) => ({ ...s, mode, expertModel: null }))}
                  showReasoning={assistantSettings.showReasoning}
                  onShowReasoningChange={(show) =>
                    applySettings((s) => ({ ...s, showReasoning: show }))
                  }
                  expert={expertCapability}
                  expertModel={activeExpertModel}
                  // Экспертный ход идёт во внешнюю модель — «думающий» режим
                  // нашего бокса при этом ни при чём, поэтому сбрасываем его в
                  // fast, чтобы возврат к обычному ходу был предсказуем.
                  onSelectExpert={(model) =>
                    applySettings((s) => ({ ...s, mode: 'fast', expertModel: model }))
                  }
                />

                <button
                  type="button"
                  aria-label={
                    isVoiceActive
                      ? t('pages.aiAssistant.voiceStopRecording')
                      : t('pages.aiAssistant.voiceStartRecording')
                  }
                  title={t('pages.aiAssistant.voiceHoldHint')}
                  aria-pressed={isVoiceActive}
                  disabled={!assistantSettings.voiceInputEnabled}
                  onClick={handleMicClick}
                  onPointerDown={handleMicPointerDown}
                  onPointerUp={clearLongPressTimer}
                  onPointerLeave={clearLongPressTimer}
                  onPointerCancel={clearLongPressTimer}
                  onContextMenu={(e) => {
                    // Long-press on touch devices must not open the context menu.
                    if (recorderStatus === 'recording' || longPressTimerRef.current != null) {
                      e.preventDefault()
                    }
                  }}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border transition-colors sm:h-9 sm:w-9',
                    !assistantSettings.voiceInputEnabled &&
                      'border-border bg-muted text-muted-foreground cursor-not-allowed',
                    assistantSettings.voiceInputEnabled &&
                      !isVoiceActive &&
                      'border-border bg-card text-muted-foreground hover:border-primary-300 hover:text-primary-600 cursor-pointer',
                    assistantSettings.voiceInputEnabled &&
                      isVoiceActive &&
                      'border-error-500 bg-error-500 hover:bg-error-600 ring-offset-background cursor-pointer text-white ring-2 ring-red-400/60 ring-offset-2'
                  )}
                >
                  {isVoiceActive ? (
                    <Icons.Pause size={18} strokeWidth={1.5} />
                  ) : (
                    <Icons.Mic02 size={20} strokeWidth={1} />
                  )}
                </button>
              </div>
            </div>
            {/* Enter-to-send hint is keyboard-only guidance — pointless on touch. */}
            <p className="text-muted-foreground mt-2 hidden text-center text-[11px] leading-snug sm:block sm:text-right">
              {t('pages.aiAssistant.inputHint')}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile chat history: left drawer above the content with a dimmed
          backdrop, closed by tapping outside. */}
      {isMobileOrTablet && isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('pages.aiAssistant.historyCloseAria')}
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsHistoryDrawerOpen(false)}
          />
          <div className="bg-card absolute top-0 bottom-0 left-0 flex w-[min(85vw,20rem)] flex-col shadow-2xl">
            <ConversationSidebar
              variant="drawer"
              activeConversationId={activeSidebarConversationId}
              onSelectConversation={handleSelectConversation}
              onNewChat={handleNewChat}
              onClose={() => setIsHistoryDrawerOpen(false)}
              className="pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            />
          </div>
        </div>
      )}

      {isMobileOrTablet && isSettingsOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label={t('pages.aiAssistant.closeSettingsAria')}
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsSettingsOpen(false)}
          />
          <div className="bg-muted/95 absolute right-0 bottom-0 left-0 max-h-[90vh] overflow-auto rounded-t-2xl px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div
              className="bg-muted-foreground/30 mx-auto mb-3 h-1 w-10 shrink-0 rounded-full"
              aria-hidden
            />
            <div className="mx-auto w-full max-w-lg pb-1">{settingsPanel}</div>
          </div>
        </div>
      )}

      {/* «Активность» — the single fixed reasoning panel (right). Shows the ход
          рассуждения of the currently-open message; toggled by the bubble chip,
          the header crest, Esc, or (mobile) the backdrop. */}
      <ReasoningActivityPanel
        open={isReasoningPanelOpen}
        streaming={Boolean(activeReasoningMessage?.isStreamingReasoning)}
        placeholderActive={Boolean(
          activeReasoningMessage?.thinkingPlaceholder &&
          activeReasoningMessage?.isStreamingReasoning
        )}
        showReasoning={assistantSettings.showReasoning}
        reasoning={activeReasoningMessage?.reasoning ?? ''}
        toolSteps={activeReasoningMessage?.toolSteps ?? []}
        citations={activeReasoningMessage?.citations ?? []}
        focusedCitationId={focusedCitationId}
        citationMarkingEnabled={activeServerMessageId != null}
        citationMarks={activeCitationMarks}
        onMarkCitation={handleActiveMarkCitation}
        elapsedLabel={
          activeReasoningElapsed != null ? formatReasoningDuration(activeReasoningElapsed) : null
        }
        isMobileOrTablet={isMobileOrTablet}
        width={reasoningPanelWidth}
        onClose={() => {
          if (activeReasoningMessage) closeReasoning(activeReasoningMessage)
        }}
        onResize={setReasoningPanelWidth}
        onResizeEnd={setStoredReasoningPanelWidth}
      />
    </div>
  )
}
