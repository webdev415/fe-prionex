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
  useAssistantConversation,
  useMarkCitation,
  useSendAssistantMessage,
  useSendFeedback,
} from '@/features/aiAssistant/hooks'
import {
  AssistantChatStreamError,
  type AssistantCitationVerdict,
  type AssistantFeedbackComprehension,
  type AssistantFeedbackRating,
} from '@/features/aiAssistant/api'
import { normalizeCitations } from '@/features/aiAssistant/sse'
import type { AssistantCitation, AssistantSources } from '@/features/aiAssistant/sse'
import {
  blobToBase64,
  extractImageFiles,
  MAX_ATTACHMENTS,
  toChatAttachmentPayload,
  validateImageFile,
  type AttachmentType,
  type PendingAttachment,
} from '@/features/aiAssistant/attachments'
import { useServerDictation } from '@/features/aiAssistant/useServerDictation'
import {
  useVoiceMessageRecorder,
  type VoiceMessageResult,
} from '@/features/aiAssistant/useVoiceMessageRecorder'
import { prepareTtsText, resolveTtsVoice, useTtsPlayer } from '@/features/aiAssistant/tts'
import { useAuthStore } from '@/stores/authStore'
import {
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
  type AssistantSettings,
  type AssistantVoiceMaxDuration,
  type AssistantVoiceSilenceTimeout,
} from '@/stores/aiAssistantStore'
import type { AssistantMode } from '@/features/aiAssistant/api'
import { isAxiosError } from 'axios'
import { ConversationSidebar } from './ConversationSidebar'
import { getDockDesktopBoxClasses, getDockRightOffset } from './dockGeometry'
import { MarkdownMessage, type MarkdownCitation } from './MarkdownMessage'
import {
  ReasoningActivityPanel,
  ReasoningInlineChip,
  type ToolStep,
  type ToolStepStatus,
} from './ReasoningActivityPanel'

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

type AssistDropdownProps = {
  ariaLabel: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  triggerClassName?: string
}

type ChatRole = 'user' | 'assistant'

/** Attachment rendered inside a feed bubble (object URL lives client-side only). */
type LocalAttachment = {
  type: AttachmentType
  mime: string
  url: string
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
 */
function messageHasActivity(item: ChatMessage): boolean {
  return messageHasReasoning(item) || Boolean(item.citations && item.citations.length > 0)
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
  '[&_th]:bg-light-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium',
  '[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1',
  // Code styling (inline + fenced blocks) is owned by MarkdownMessage's custom
  // code renderer (syntax highlight + copy + horizontal scroll).
  '[&_a]:text-primary-600 [&_a]:underline',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600',
  '[&_hr]:my-3 [&_hr]:border-gray-200',
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

function AssistFilterDropdown({
  ariaLabel,
  value,
  options,
  onChange,
  triggerClassName,
}: AssistDropdownProps) {
  const label = useMemo(
    () => options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '',
    [options, value]
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'text-dark-500 inline-flex h-9 min-h-9 min-w-0 cursor-pointer items-center justify-center gap-1.5 border-l border-l-gray-200 bg-white px-2.5 text-xs font-light shadow-none sm:h-6 sm:min-h-0 sm:w-32 sm:max-w-none sm:px-3',
            triggerClassName
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className="text-dark-500 text-sm font-light"
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
    iconClass: 'text-amber-500',
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
 */
function ModeDropdown({ value, onChange }: ModeDropdownProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isThinking = value === 'thinking'
  const ActiveIcon = isThinking ? Icons.AiBrain03 : Icons.Flash

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
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t('pages.aiAssistant.mode')}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="assistant-mode-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="text-dark-500 hover:border-primary-300 hover:text-primary-600 inline-flex h-9 min-h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-light shadow-none transition-colors sm:h-8 sm:min-h-0 sm:w-auto"
      >
        <ActiveIcon
          size={15}
          strokeWidth={1.5}
          className={isThinking ? 'text-primary-500' : 'text-amber-500'}
        />
        <span className="min-w-0 truncate">
          {isThinking
            ? t('pages.aiAssistant.modeThinkingShort')
            : t('pages.aiAssistant.modeFastShort')}
        </span>
        <Icons.ArrowDown size={13} strokeWidth={1.5} className="shrink-0 text-gray-400" />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="assistant-mode-menu"
          className="border-light-200 absolute right-0 bottom-full z-30 mb-2 w-64 overflow-hidden rounded-xl border bg-white p-1 shadow-lg ring-1 ring-black/[0.04]"
        >
          {MODE_OPTIONS.map(({ mode, Icon, iconClass, labelKey, hintKey }) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={value === mode}
              onClick={() => {
                onChange(mode)
                setOpen(false)
              }}
              className="hover:bg-light-100/70 flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
            >
              <Icon size={16} strokeWidth={1.5} className={cn('mt-0.5 shrink-0', iconClass)} />
              <span className="min-w-0 flex-1">
                <span className="text-dark-500 flex items-center gap-1.5 text-sm font-medium">
                  {t(labelKey)}
                  {value === mode && (
                    <Icons.Checkmark
                      size={14}
                      strokeWidth={2}
                      className="text-primary-500 shrink-0"
                    />
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug font-light text-gray-500">
                  {t(hintKey)}
                </span>
              </span>
            </button>
          ))}
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
          className="text-dark-500 hover:border-primary-300 hover:text-primary-600 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 transition-colors sm:h-7 sm:w-7"
        >
          <Icons.Add size={18} strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-72 bg-white"
        data-testid="composer-hub-menu"
      >
        <DropdownMenuItem
          className="text-dark-500 flex items-center gap-2.5 px-2.5 py-2 text-sm"
          onSelect={onAttach}
          data-testid="hub-attach"
        >
          <Icons.Attachment01 size={16} strokeWidth={1.5} className="shrink-0 text-gray-500" />
          {t('pages.aiAssistant.hubAttach')}
        </DropdownMenuItem>

        <DropdownMenuCheckboxItem
          checked={deepResearch}
          // Keep the menu open after toggling so the choice stays visible.
          onSelect={(event) => {
            event.preventDefault()
            onToggleDeepResearch()
          }}
          className="text-dark-500 py-2 pr-2 pl-8 text-sm"
          data-testid="hub-deep-research"
        >
          <span className="flex items-center gap-2.5">
            <Icons.Sparkles size={16} strokeWidth={1.5} className="text-primary-500 shrink-0" />
            <span className="min-w-0">
              <span className="block">{t('pages.aiAssistant.hubDeepResearch')}</span>
              <span className="block text-[11px] leading-snug font-light text-gray-500">
                {t('pages.aiAssistant.hubDeepResearchHint')}
              </span>
            </span>
          </span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] font-medium tracking-tight text-gray-500">
          <Icons.FileSearch size={13} strokeWidth={1.5} className="shrink-0 text-gray-400" />
          {t('pages.aiAssistant.hubCrmActions')}
        </DropdownMenuLabel>
        {QUICK_ACTION_KEYS.map((key) => {
          const ActionIcon = QUICK_ACTION_ICONS[key]
          return (
            <DropdownMenuItem
              key={key}
              className="text-dark-500 flex items-center gap-2.5 px-2.5 py-2 text-sm"
              disabled={quickActionDisabled}
              onSelect={() => onQuickAction(key)}
              data-testid={`hub-action-${key}`}
            >
              <ActionIcon size={16} strokeWidth={1.5} className="shrink-0 text-gray-500" />
              {t(`pages.aiAssistant.${key}`)}
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] font-medium tracking-tight text-gray-500">
          <Icons.UserMultiple size={13} strokeWidth={1.5} className="shrink-0 text-gray-400" />
          {t('pages.aiAssistant.hubContext')}
          <span className="text-dark-500 ml-auto max-w-[7rem] truncate font-light">
            {activeClientLabel}
          </span>
        </DropdownMenuLabel>
        {clientOptions.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className="text-dark-500 flex items-center justify-between gap-2 px-2.5 py-2 text-sm"
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
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => window.innerWidth < 1024)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening'>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [dictationDraft, setDictationDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingAttachment[]>([])
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
  const imageInputRef = useRef<HTMLInputElement>(null)
  const dictationGhostRef = useRef<HTMLDivElement>(null)
  const lastDictationFinalRef = useRef('')
  const longPressTimerRef = useRef<number | null>(null)
  const longPressFiredRef = useRef(false)
  /** Every object URL minted for attachments — revoked on reset/unmount. */
  const attachmentUrlsRef = useRef<string[]>([])
  const responseTokenRef = useRef(0)
  const hasConversation = chatMessages.length > 0

  const { mutateAsync: sendChat } = useSendAssistantMessage()
  const { mutate: mutateFeedback } = useSendFeedback()
  const { mutate: mutateMarkCitation } = useMarkCitation()

  // Re-hydrate the dialog persisted for this user: history lives on the
  // backend, the store only keeps the conversation pointer. Hydration is
  // skipped as soon as the user starts a conversation in this mount.
  // Switching a conversation from the history panel resets the local chat
  // state and re-arms this flag, so the same mechanism loads the new dialog.
  const shouldHydrateConversation =
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
    const onResize = () => setIsMobileOrTablet(window.innerWidth < 1024)
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

  const clearPendingImages = useCallback(() => {
    setPendingImages((current) => {
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
  }, [])

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

  useEffect(() => {
    const detail = conversationQuery.data
    if (!detail || !shouldHydrateConversation) return
    setConversationId(detail.id)
    setChatMessages(
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
          content: item.content,
          serverMessageId: isAssistant ? item.id : undefined,
          // Слой 5: гидратируем раздумья и источники серверного сообщения, чтобы
          // панель «Активность» и факт-сноски `[[N]]` работали в загруженном из
          // истории диалоге (после F5 / переключения), а не только в текущем
          // стриме. Поля опциональны — старый бэкенд их не шлёт, тогда сообщение
          // ведёт себя как прежде (без чипа/источников).
          reasoning: isAssistant ? item.reasoning : undefined,
          citations: citations.length > 0 ? citations : undefined,
        }
      })
    )
    setIsExplicitSelection(false)
    window.setTimeout(() => scrollToConversationBottom('auto'), 0)
  }, [conversationQuery.data, shouldHydrateConversation, scrollToConversationBottom])

  useEffect(() => {
    if (!conversationQuery.isError) return
    // The persisted conversation no longer exists — drop the stale pointer.
    // Transient errors (network, 5xx) keep it so a later visit can retry.
    if (isAxiosError(conversationQuery.error) && conversationQuery.error.response?.status === 404) {
      clearStoredConversation()
    }
  }, [conversationQuery.isError, conversationQuery.error, clearStoredConversation])

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
    clearPendingImages()
    responseTokenRef.current += 1
    setChatMessages((current) => (current.length > 0 ? [] : current))
    setConversationId(null)
    setFeedbackByMessage({})
    setCitationMarksByMessage((current) => (Object.keys(current).length > 0 ? {} : current))
    setReasoningOpenByMessage((current) => (Object.keys(current).length > 0 ? {} : current))
    setFocusedCitation(null)
    setIsAssistantResponding(false)
  }, [stopVoiceRecognition, cancelDictation, cancelVoiceMessage, stopTts, clearPendingImages])

  const clientOptions = useMemo(
    () => [
      { value: 'all', label: t('pages.aiAssistant.allClients') },
      { value: 'my', label: t('pages.aiAssistant.myClients') },
    ],
    [t]
  )

  const settingsPanel = (
    <div className="border-light-200/80 mx-auto flex max-h-full min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl ring-1 ring-black/[0.04]">
      <header className="from-light-50/80 shrink-0 border-b border-gray-100 bg-gradient-to-b to-white px-4 pt-3 pb-2">
        <h2 className="text-dark-500 text-sm font-semibold tracking-tight">
          {t('pages.aiAssistant.settingsTitle')}
        </h2>
        <p className="mt-1 text-xs leading-snug font-light text-gray-600">
          {t('pages.aiAssistant.settingsDescription')}
        </p>
      </header>

      <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto overscroll-y-contain">
        <section className="px-4 py-2.5">
          <h3 className="text-dark-500 mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.assistantPreferences')}
          </h3>
          <p className="mb-1.5 text-[11px] font-medium text-gray-500">
            {t('pages.aiAssistant.responseMode')}
          </p>
          <div
            className="bg-light-100/80 flex w-full rounded-lg p-0.5"
            role="group"
            aria-label={t('pages.aiAssistant.responseMode')}
          >
            <button
              type="button"
              onClick={() => applySettings((s) => ({ ...s, responseMode: 'short' }))}
              className={cn(
                'min-h-8 flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all',
                assistantSettings.responseMode === 'short'
                  ? 'text-dark-500 bg-white shadow-sm ring-1 ring-gray-200/80'
                  : 'hover:text-dark-500 text-gray-600'
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
                  ? 'text-dark-500 bg-white shadow-sm ring-1 ring-gray-200/80'
                  : 'hover:text-dark-500 text-gray-600'
              )}
            >
              {t('pages.aiAssistant.responseDetailed')}
            </button>
          </div>

          {/* Reasoning mode now lives in the dropdown next to the composer
              (single source of truth); the settings panel only points to it. */}
          <div className="bg-light-50/60 mt-2.5 flex items-center gap-2 rounded-lg border border-gray-200/70 px-2.5 py-2">
            {assistantSettings.mode === 'thinking' ? (
              <Icons.AiBrain03 size={14} strokeWidth={1.5} className="text-primary-500 shrink-0" />
            ) : (
              <Icons.Flash size={14} strokeWidth={1.5} className="shrink-0 text-amber-500" />
            )}
            <span className="text-dark-500 min-w-0 flex-1 text-[11px] leading-snug font-light">
              {t('pages.aiAssistant.mode')}:{' '}
              {assistantSettings.mode === 'thinking'
                ? t('pages.aiAssistant.modeThinkingShort')
                : t('pages.aiAssistant.modeFastShort')}
            </span>
            <span className="shrink-0 text-[11px] font-light text-gray-400">
              {t('pages.aiAssistant.modeChangeHint')}
            </span>
          </div>

          <p className="mt-2.5 mb-1.5 text-[11px] font-medium text-gray-500">
            {t('pages.aiAssistant.outputFormat')}
          </p>
          <div
            className="bg-light-100/80 grid w-full grid-cols-3 gap-0.5 rounded-lg p-0.5"
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
                    ? 'text-dark-500 bg-white shadow-sm ring-1 ring-gray-200/80'
                    : 'hover:text-dark-500 text-gray-600'
                )}
              >
                {format === 'text' && t('pages.aiAssistant.outputText')}
                {format === 'tableFirst' && t('pages.aiAssistant.outputTableFirst')}
                {format === 'mixed' && t('pages.aiAssistant.outputMixed')}
              </button>
            ))}
          </div>

          <div className="bg-light-50/60 mt-2.5 flex items-center justify-between gap-3 rounded-lg border border-gray-200/70 px-2.5 py-2">
            <span className="text-dark-500 min-w-0 flex-1 text-xs leading-snug font-light">
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
              <p className="mt-2.5 mb-1.5 text-[11px] font-medium text-gray-500">
                {t('pages.aiAssistant.voiceSilenceTimeout')}
              </p>
              <div
                className="bg-light-100/80 grid w-full grid-cols-3 gap-0.5 rounded-lg p-0.5"
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
                        ? 'text-dark-500 bg-white shadow-sm ring-1 ring-gray-200/80'
                        : 'hover:text-dark-500 text-gray-600'
                    )}
                  >
                    {t('pages.aiAssistant.voiceSeconds', { count: sec })}
                  </button>
                ))}
              </div>

              <p className="mt-2.5 mb-1.5 text-[11px] font-medium text-gray-500">
                {t('pages.aiAssistant.voiceMaxDuration')}
              </p>
              <div
                className="bg-light-100/80 grid w-full grid-cols-3 gap-0.5 rounded-lg p-0.5"
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
                        ? 'text-dark-500 bg-white shadow-sm ring-1 ring-gray-200/80'
                        : 'hover:text-dark-500 text-gray-600'
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
          <h3 className="text-dark-500 mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.contextBehavior')}
          </h3>
          <ul className="space-y-0">
            <li className="flex items-center justify-between gap-3 py-1.5 first:pt-0">
              <span className="text-dark-500 min-w-0 flex-1 text-xs leading-snug font-light">
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
            <li className="flex items-center justify-between gap-3 border-t border-gray-100 py-1.5">
              <span className="text-dark-500 min-w-0 flex-1 text-xs leading-snug font-light">
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
            <li className="flex items-center justify-between gap-3 border-t border-gray-100 py-1.5">
              <span className="text-dark-500 min-w-0 flex-1 text-xs leading-snug font-light">
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
          <h3 className="text-dark-500 mb-2 text-xs font-semibold tracking-tight">
            {t('pages.aiAssistant.suggestedActions')}
          </h3>
          <ul className="space-y-0">
            <li className="flex items-center justify-between gap-3 py-1.5 first:pt-0">
              <span className="text-dark-500 min-w-0 flex-1 text-xs leading-snug font-light">
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

        <section className="bg-light-50/40 px-4 py-2.5">
          <h3 className="text-dark-500 mb-2 text-xs font-semibold tracking-tight">
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
    },
    [conversationId, resetChatState, setActiveConversation, userId]
  )

  const handleNewChat = useCallback(() => {
    setIsHistoryDrawerOpen(false)
    resetChatState()
    setMessage('')
    setIsExplicitSelection(false)
    clearStoredConversation()
  }, [clearStoredConversation, resetChatState])

  const submitPrompt = useCallback(
    async (rawPrompt: string, attachments?: PendingAttachment[]) => {
      const prompt = rawPrompt.trim()
      const attachmentList = attachments ?? []
      const hasAudio = attachmentList.some((item) => item.type === 'audio')
      if (isAssistantResponding) return
      if (!prompt && !hasAudio) {
        // Backend rule: an empty message is valid only with a voice note;
        // images alone are a 422 — nudge the user instead of failing silently.
        if (attachmentList.length > 0) {
          toast.error(t('pages.aiAssistant.attachmentNeedsText'))
        }
        return
      }

      setMessage('')
      setPendingImages((current) => (current.length > 0 ? [] : current))
      appendChatMessage({
        role: 'user',
        content: prompt,
        attachments:
          attachmentList.length > 0
            ? attachmentList.map((item) => ({
                type: item.type,
                mime: item.mime,
                url: item.previewUrl,
              }))
            : undefined,
      })
      setIsAssistantResponding(true)

      const isThinking = assistantSettings.mode === 'thinking'
      const reasoningStartedAt = Date.now()
      const loadingId = appendChatMessage({
        role: 'assistant',
        content: isThinking
          ? t('pages.aiAssistant.assistantThinking')
          : t('pages.aiAssistant.assistantTyping'),
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
            message: prompt,
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
          },
          callbacks: {
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
          },
        })
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
        })
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
        const errorMessage = isThinkingUnavailable
          ? t('pages.aiAssistant.thinkingUnavailable')
          : t('pages.aiAssistant.apiError')
        if (isThinkingUnavailable) {
          setAssistantSettings((s) => ({ ...s, mode: 'fast' }))
        }
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
        })
      } finally {
        if (requestToken === responseTokenRef.current) {
          setIsAssistantResponding(false)
          window.setTimeout(() => scrollToConversationBottom('smooth'), 0)
        }
      }
    },
    [
      appendChatMessage,
      assistantSettings.deepResearch,
      assistantSettings.mode,
      assistantSettings.outputFormat,
      assistantSettings.rememberConversationContext,
      assistantSettings.responseMode,
      conversationId,
      isAssistantResponding,
      scrollToConversationBottom,
      sendChat,
      setActiveConversation,
      t,
      userId,
    ]
  )

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

  const addImageFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      const room = MAX_ATTACHMENTS - pendingImages.length
      let unsupported = false
      let tooLarge = false
      let overflow = files.length > Math.max(room, 0)
      const accepted: PendingAttachment[] = []
      for (const file of files.slice(0, Math.max(room, 0))) {
        const error = validateImageFile(file, 0)
        if (error === 'unsupportedType') {
          unsupported = true
          continue
        }
        if (error === 'tooLarge') {
          tooLarge = true
          continue
        }
        try {
          const data_b64 = await blobToBase64(file)
          const previewUrl = URL.createObjectURL(file)
          attachmentUrlsRef.current.push(previewUrl)
          accepted.push({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'image',
            mime: file.type,
            data_b64,
            previewUrl,
            sizeBytes: file.size,
          })
        } catch {
          unsupported = true
        }
      }
      if (room <= 0) overflow = true
      if (overflow) toast.error(t('pages.aiAssistant.attachImageTooMany'))
      if (unsupported) toast.error(t('pages.aiAssistant.attachImageUnsupported'))
      if (tooLarge) toast.error(t('pages.aiAssistant.attachImageTooLarge'))
      if (accepted.length > 0) {
        setPendingImages((current) => [...current, ...accepted].slice(0, MAX_ATTACHMENTS))
      }
    },
    [pendingImages.length, t]
  )

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((current) => {
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
      const files = extractImageFiles(event.clipboardData.items)
      if (files.length === 0) return
      event.preventDefault()
      void addImageFiles(files)
    },
    [addImageFiles]
  )

  const handleImageInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (files && files.length > 0) {
        void addImageFiles(Array.from(files))
      }
      // Reset so picking the same file again still fires onChange.
      event.target.value = ''
    },
    [addImageFiles]
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.files.length === 0) return
      // Always swallow file drops — otherwise the browser navigates to the
      // dropped file; non-image files surface the unsupported-type toast.
      event.preventDefault()
      const files = extractImageFiles(event.dataTransfer.files)
      if (files.length === 0) {
        toast.error(t('pages.aiAssistant.attachImageUnsupported'))
        return
      }
      void addImageFiles(files)
    },
    [addImageFiles, t]
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

  const handleFeedback = useCallback(
    (messageId: number, patch: Partial<MessageFeedback>) => {
      const previous = feedbackByMessage[messageId]
      const merged: MessageFeedback = { ...previous, ...patch }
      setFeedbackByMessage((current) => ({ ...current, [messageId]: merged }))
      mutateFeedback(
        { message_id: messageId, ...merged },
        {
          onError: () => {
            toast.error(t('pages.aiAssistant.apiError'))
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
      if (!messageHasActivity(item)) continue
      if (isReasoningOpen(item)) return item
    }
    return null
  }, [chatMessages, isReasoningOpen])

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
      !isChosen && isGroupLocked && 'border-gray-100 bg-white text-gray-300',
      !isChosen &&
        !isGroupLocked &&
        'hover:border-primary-300 hover:text-primary-600 cursor-pointer border-gray-200 bg-white text-gray-500',
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
            className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-400 border-t-transparent"
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

  const renderFeedbackControls = (serverMessageId: number) => {
    const feedback = feedbackByMessage[serverMessageId] ?? {}
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
        <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />
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

  /** TTS playback + feedback in one row under an assistant bubble. */
  const renderAssistantActions = (item: ChatMessage) => (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1">
      {renderTtsButton(item)}
      {item.serverMessageId != null && (
        <>
          <span className="mx-0.5 h-4 w-px bg-gray-200" aria-hidden />
          {renderFeedbackControls(item.serverMessageId)}
        </>
      )}
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
    if (!messageHasActivity(item)) return null
    const elapsed = reasoningElapsedMs(item, reasoningNow)
    return (
      <ReasoningInlineChip
        open={isReasoningOpen(item)}
        streaming={Boolean(item.isStreamingReasoning)}
        reasoning={item.reasoning ?? ''}
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
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        {items.map((item, index) => (
          <span
            key={index}
            className="text-dark-500 bg-light-100 inline-flex max-w-full items-center rounded px-1.5 py-0.5 font-mono text-[10px] leading-snug"
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
      className="border-light-200 bg-light-50/60 mt-2 w-full max-w-full space-y-1 rounded-xl border px-3 py-2"
    >
      <div className="text-dark-500 flex items-center gap-1.5 text-[11px] font-semibold tracking-tight">
        <Icons.Info size={13} strokeWidth={1.5} className="text-gray-500" />
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
      className={cn(
        'relative flex min-h-[calc(100vh-5.5rem)] w-full min-w-0 flex-1 flex-col self-stretch overflow-x-hidden supports-[height:100dvh]:min-h-[calc(100dvh-5.5rem)]',
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
          the note on the panel above). */}
      {isMobileOrTablet && (
        <button
          type="button"
          aria-label={t('pages.aiAssistant.historyOpenAria')}
          onClick={() => setIsHistoryDrawerOpen(true)}
          className="border-light-200 text-dark-500 hover:bg-light-50 fixed top-[68px] left-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 shadow-md transition-colors lg:hidden"
        >
          <Icons.MessageMultiple01 size={18} strokeWidth={1.5} />
        </button>
      )}

      <div className="pointer-events-none sticky top-0 z-30 flex w-full justify-center px-3 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1 text-[11px] font-medium text-amber-700 shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
          {t('pages.aiAssistant.betaBadge')}
        </span>
      </div>

      {hasConversation ? (
        <div
          className="relative min-h-0 flex-1 px-3 pt-3 sm:px-8 sm:pt-5 md:px-10 lg:px-14 lg:pt-6 xl:px-20"
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
                  item.role === 'assistant' && !item.isError && messageHasActivity(item)
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
                            ? 'bg-secondary-800 text-white'
                            : 'text-dark-500 border border-gray-100 bg-white',
                          (item.role === 'user' || item.isLoading || item.isError) &&
                            'whitespace-pre-wrap',
                          item.isError && 'border-error-200 bg-error-50/60 text-error-700'
                        )}
                      >
                        {item.attachments && item.attachments.length > 0 && (
                          <div className={cn('flex flex-col gap-2', item.content && 'mb-2')}>
                            {item.attachments.map((attachment, index) =>
                              attachment.type === 'image' ? (
                                <img
                                  key={index}
                                  src={attachment.url}
                                  alt={t('pages.aiAssistant.attachedImageAlt')}
                                  className="max-h-48 max-w-full rounded-lg object-contain"
                                />
                              ) : (
                                // eslint-disable-next-line jsx-a11y/media-has-caption -- voice note, no transcript available client-side
                                <audio
                                  key={index}
                                  controls
                                  src={attachment.url}
                                  aria-label={t('pages.aiAssistant.voiceMessageBubbleLabel')}
                                  className="h-10 max-w-full"
                                />
                              )
                            )}
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
                              {item.loadingLabel && (
                                <span className="ml-1.5 text-xs font-light text-gray-500">
                                  {item.loadingLabel}
                                </span>
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
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 sm:px-8 md:px-10 lg:px-14 xl:px-20"
          style={{ paddingBottom: `${dockHeight}px` }}
        >
          <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 text-center sm:gap-5">
            <img src="/logo.svg" alt={t('app.name')} className="mx-auto h-10 w-auto sm:h-12" />
            <span className="text-dark-500 text-center text-2xl leading-[129%] font-light tracking-[-0.04em] sm:text-[28px] lg:text-[30px] lg:tracking-[-0.6px]">
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
          'from-light-50 via-light-50/95 pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex w-full min-w-0 shrink-0 flex-col items-center bg-gradient-to-t to-transparent px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[left,right] duration-300 sm:px-8 sm:pt-6 md:px-10 lg:px-14 xl:px-20',
          getDockDesktopBoxClasses(isOpenSideBar, isHistoryCollapsed)
        )}
      >
        {hasConversation && showScrollToLatest && (
          <button
            type="button"
            aria-label={t('pages.aiAssistant.scrollToLatestAria')}
            onClick={() => scrollToConversationBottom('smooth')}
            className="border-light-200 text-dark-500 hover:bg-light-50 pointer-events-auto absolute -top-3 left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border bg-white shadow-md transition-colors sm:-top-4"
          >
            <Icons.ArrowDown size={16} strokeWidth={1.5} />
          </button>
        )}
        <div className="pointer-events-auto mx-auto w-full max-w-5xl min-w-0 2xl:max-w-6xl">
          <div
            className="border-light-200 shadow-dark-500/5 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-lg sm:rounded-3xl sm:p-5"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) e.preventDefault()
            }}
            onDrop={handleDrop}
          >
            {pendingImages.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2" data-testid="pending-attachments">
                {pendingImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    <img
                      src={image.previewUrl}
                      alt={t('pages.aiAssistant.attachedImageAlt')}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={t('pages.aiAssistant.attachImageRemove')}
                      onClick={() => removePendingImage(image.id)}
                      className="absolute top-0.5 right-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <Icons.Cancel01 size={12} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void submitPrompt(message, pendingImages)
                  }
                }}
                // The grey draft ghost is drawn over the textarea — the
                // placeholder underneath would collide with it visually.
                placeholder={dictationDraft ? '' : t('pages.aiAssistant.inputPlaceholder')}
                className={cn(
                  'ai-chat-input-scrollbar max-h-[min(40vh,16rem)] min-h-[52px] resize-none overflow-y-auto border-0 bg-transparent py-2 pr-2 pl-1 text-sm shadow-none sm:max-h-none sm:min-h-[120px] sm:text-base',
                  'placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0'
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
                  <span className="text-gray-400">{(message ? ' ' : '') + dictationDraft}</span>
                </div>
              )}
            </div>

            {voiceStatus === 'listening' && (
              <div
                className="border-primary-200 bg-primary-50/60 text-dark-500 mb-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-light"
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
                className="border-primary-200 bg-primary-50/60 text-dark-500 mb-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-light"
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
                className="border-error-200 bg-error-50/60 text-dark-500 mb-2 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-light"
                role="status"
                aria-live="polite"
              >
                <span className="bg-error-500 inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full" />
                <span className="min-w-0 flex-1">
                  {t('pages.aiAssistant.voiceMessageRecording')}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-gray-600 tabular-nums">
                  {formatRecordingTime(recorderElapsedSec)} /{' '}
                  {formatRecordingTime(assistantSettings.voiceMaxDurationSec)}
                </span>
                <button
                  type="button"
                  aria-label={t('pages.aiAssistant.voiceMessageCancel')}
                  onClick={cancelVoiceMessage}
                  className="hover:text-error-600 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors"
                >
                  <Icons.Cancel01 size={14} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label={t('pages.aiAssistant.voiceMessageSend')}
                  onClick={stopVoiceMessage}
                  className="bg-primary-500 hover:bg-primary-600 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-colors"
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
                  onAttach={() => imageInputRef.current?.click()}
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
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  data-testid="attach-image-input"
                  onChange={handleImageInputChange}
                />

                <div className="relative shrink-0">
                  <button
                    ref={settingsTriggerRef}
                    type="button"
                    onClick={() => setIsSettingsOpen((open) => !open)}
                    aria-expanded={isSettingsOpen}
                    className="text-dark-500 hover:text-primary-600 flex min-h-9 cursor-pointer items-center gap-2 text-sm font-light transition-colors"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 sm:h-7 sm:w-7">
                      <Icons.Settings size={16} strokeWidth={1.5} />
                    </span>
                    <span className="hidden sm:inline">{t('pages.aiAssistant.settings')}</span>
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
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.client')}
                  value={clientScope}
                  onChange={setClientScope}
                  options={clientOptions}
                  triggerClassName="min-w-0 flex-1 rounded-full border border-gray-300 sm:w-32 sm:flex-none"
                />
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.period')}
                  value={period}
                  onChange={setPeriod}
                  options={periodOptions}
                  triggerClassName="min-w-0 flex-1 rounded-full border border-gray-300 sm:w-32 sm:flex-none"
                />

                {/* Reasoning-mode picker (source of truth for `mode`). */}
                <div className="min-w-0 flex-1 sm:flex-none">
                  <ModeDropdown
                    value={assistantSettings.mode}
                    onChange={(mode) => applySettings((s) => ({ ...s, mode }))}
                  />
                </div>

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
                    'flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full shadow-md transition-colors sm:h-9 sm:w-9',
                    !assistantSettings.voiceInputEnabled && 'cursor-not-allowed bg-gray-200',
                    assistantSettings.voiceInputEnabled &&
                      !isVoiceActive &&
                      'bg-primary-300 hover:bg-primary-500 cursor-pointer',
                    assistantSettings.voiceInputEnabled &&
                      isVoiceActive &&
                      'bg-error-500 hover:bg-error-600 cursor-pointer ring-2 ring-red-400/60 ring-offset-2'
                  )}
                >
                  {isVoiceActive ? (
                    <Icons.Pause size={18} strokeWidth={1.5} className="text-white" />
                  ) : (
                    <Icons.Mic02
                      size={20}
                      strokeWidth={1}
                      className={
                        assistantSettings.voiceInputEnabled ? 'text-dark-500' : 'text-gray-400'
                      }
                    />
                  )}
                </button>
              </div>
            </div>
            {/* Enter-to-send hint is keyboard-only guidance — pointless on touch. */}
            <p className="mt-2 hidden text-center text-[11px] leading-snug text-gray-400 sm:block sm:text-right">
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
          <div className="absolute top-0 bottom-0 left-0 flex w-[min(85vw,20rem)] flex-col bg-white shadow-2xl">
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
          <div className="bg-light-50/95 absolute right-0 bottom-0 left-0 max-h-[90vh] overflow-auto rounded-t-2xl px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div
              className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-gray-300/90"
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
