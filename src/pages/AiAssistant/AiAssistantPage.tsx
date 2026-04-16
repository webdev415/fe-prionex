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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

const QUICK_ACTION_KEYS = ['quickClientData', 'quickDebt', 'quickReport', 'quickEmployee'] as const
type QuickActionKey = (typeof QUICK_ACTION_KEYS)[number]

type AssistDropdownProps = {
  ariaLabel: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  triggerClassName?: string
}

type ResponseMode = 'short' | 'detailed'
type OutputFormat = 'text' | 'tableFirst' | 'mixed'

type AssistantSettings = {
  responseMode: ResponseMode
  outputFormat: OutputFormat
  voiceInputEnabled: boolean
  useSelectedClientAutomatically: boolean
  useSelectedPeriodAutomatically: boolean
  rememberConversationContext: boolean
  showQuickSuggestionsAfterResponse: boolean
  autoScrollToLatestAnswer: boolean
}

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  isLoading?: boolean
}

const DEFAULT_SETTINGS: AssistantSettings = {
  responseMode: 'short',
  outputFormat: 'mixed',
  voiceInputEnabled: true,
  useSelectedClientAutomatically: true,
  useSelectedPeriodAutomatically: true,
  rememberConversationContext: true,
  showQuickSuggestionsAfterResponse: true,
  autoScrollToLatestAnswer: true,
}

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
  if (language.startsWith('ru')) return 'ru-RU'
  return 'en-US'
}

function buildMockAssistantReply(
  input: string,
  settings: AssistantSettings,
  t: (key: string) => string
): string {
  const summaryPrefix =
    settings.responseMode === 'short'
      ? t('pages.aiAssistant.mockSummaryShort')
      : t('pages.aiAssistant.mockSummaryDetailed')

  if (settings.outputFormat === 'tableFirst' || input.toLowerCase().includes('report')) {
    const colMetric = t('pages.aiAssistant.mockTableColMetric')
    const colValue = t('pages.aiAssistant.mockTableColValue')
    return [
      `${summaryPrefix} ${t('pages.aiAssistant.mockDetectedRequest')}: "${input}".`,
      '',
      t('pages.aiAssistant.mockTableHeader'),
      `| ${colMetric} | ${colValue} |`,
      '| --- | --- |',
      `| ${t('pages.aiAssistant.mockTableRowClients')} | 42 |`,
      `| ${t('pages.aiAssistant.mockTableRowDebt')} | $128,450 |`,
      `| ${t('pages.aiAssistant.mockTableRowOverdue')} | 17.4% |`,
      '',
      t('pages.aiAssistant.mockTableFooter'),
    ].join('\n')
  }

  if (settings.outputFormat === 'mixed' && settings.responseMode === 'detailed') {
    return [
      `${summaryPrefix} ${t('pages.aiAssistant.mockDetectedRequest')}: "${input}".`,
      '',
      `1) ${t('pages.aiAssistant.mockMixedPointOne')}`,
      `2) ${t('pages.aiAssistant.mockMixedPointTwo')}`,
      `3) ${t('pages.aiAssistant.mockMixedPointThree')}`,
    ].join('\n')
  }

  return `${summaryPrefix} ${t('pages.aiAssistant.mockDetectedRequest')}: "${input}". ${t('pages.aiAssistant.mockPlainTail')}`
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

export function AiAssistantPage() {
  const { t, i18n } = useTranslation('common')
  const isOpenSideBar = useSidebarStore((state) => state.isOpenSideBar)
  const [message, setMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isAssistantResponding, setIsAssistantResponding] = useState(false)
  const [clientScope, setClientScope] = useState('all')
  const [period, setPeriod] = useState('all')
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => window.innerWidth < 1024)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening'>('idle')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [showScrollToLatest, setShowScrollToLatest] = useState(false)
  const [dockHeight, setDockHeight] = useState(320)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const pageRootRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const responseTokenRef = useRef(0)
  const hasConversation = chatMessages.length > 0

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

  useEffect(() => {
    if (voiceStatus !== 'listening') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopVoiceRecognition()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [voiceStatus, stopVoiceRecognition])

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
      const next = Math.ceil((dockRef.current?.getBoundingClientRect().height ?? 0) + 12)
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
                }
                applySettings((s) => ({ ...s, voiceInputEnabled: checked }))
              }}
              ariaLabel={t('pages.aiAssistant.voiceInput')}
            />
          </div>
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
                {t('pages.aiAssistant.showQuickSuggestionsAfterResponse')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.showQuickSuggestionsAfterResponse}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, showQuickSuggestionsAfterResponse: checked }))
                }
                ariaLabel={t('pages.aiAssistant.showQuickSuggestionsAfterResponse')}
              />
            </li>
            <li className="flex items-center justify-between gap-3 border-t border-gray-100 py-1.5">
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
              stopVoiceRecognition()
              responseTokenRef.current += 1
              setMessage('')
              if (chatMessages.length > 0) {
                setChatMessages([])
              }
              setIsAssistantResponding(false)
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

  const submitPrompt = useCallback(
    async (rawPrompt: string) => {
      const prompt = rawPrompt.trim()
      if (!prompt || isAssistantResponding) return

      setMessage('')
      appendChatMessage({ role: 'user', content: prompt })
      setIsAssistantResponding(true)

      const loadingId = appendChatMessage({
        role: 'assistant',
        content: t('pages.aiAssistant.assistantTyping'),
        isLoading: true,
      })
      window.setTimeout(() => scrollToConversationBottom('smooth'), 0)

      const waitMs = 900 + Math.floor(Math.random() * 900)
      const requestToken = ++responseTokenRef.current
      await new Promise((resolve) => window.setTimeout(resolve, waitMs))
      if (requestToken !== responseTokenRef.current) {
        return
      }
      const mockedResponse = buildMockAssistantReply(prompt, assistantSettings, t)

      setChatMessages((current) =>
        current.map((item) =>
          item.id === loadingId ? { ...item, content: mockedResponse, isLoading: false } : item
        )
      )
      setIsAssistantResponding(false)
      window.setTimeout(() => scrollToConversationBottom('smooth'), 0)
    },
    [appendChatMessage, assistantSettings, isAssistantResponding, scrollToConversationBottom, t]
  )

  return (
    <div
      ref={pageRootRef}
      className={cn(
        'relative flex min-h-[calc(100vh-5.5rem)] w-full min-w-0 flex-1 flex-col self-stretch overflow-x-hidden supports-[height:100dvh]:min-h-[calc(100dvh-5.5rem)]'
      )}
    >
      {hasConversation ? (
        <div
          className="relative min-h-0 flex-1 px-3 pt-3 sm:px-8 sm:pt-5 md:px-10 lg:px-14 lg:pt-6 xl:px-20"
          style={{ paddingBottom: `${dockHeight}px` }}
        >
          <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
            <div className="mx-auto w-full max-w-4xl space-y-3 sm:space-y-4 2xl:max-w-5xl">
              {chatMessages.map((item) => (
                <div
                  key={item.id}
                  className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'w-fit max-w-[min(100%,22rem)] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm sm:max-w-[min(100%,85%)] sm:px-4 sm:py-3 md:max-w-2xl lg:max-w-3xl',
                      item.role === 'user'
                        ? 'bg-secondary-800 text-white'
                        : 'text-dark-500 border border-gray-100 bg-white'
                    )}
                  >
                    {item.isLoading ? (
                      <span className="inline-flex items-center gap-1.5 py-1">
                        <span className="bg-secondary-500 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
                        <span className="bg-secondary-500 h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
                        <span className="bg-secondary-500 h-1.5 w-1.5 animate-bounce rounded-full" />
                      </span>
                    ) : (
                      item.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
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
        className={cn(
          'from-light-50 via-light-50/95 pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex w-full min-w-0 shrink-0 flex-col items-center bg-gradient-to-t to-transparent px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[left] duration-300 sm:px-8 sm:pt-6 md:px-10 lg:left-9',
          /* Match DashboardLayout <main> lg:px-[28px] + this page's horizontal padding so composer lines up with chat */
          'lg:px-[calc(28px+3.5rem)] xl:px-[calc(28px+5rem)]',
          isOpenSideBar && 'lg:left-60'
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
          <div className="border-light-200 shadow-dark-500/5 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-lg sm:rounded-3xl sm:p-5">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submitPrompt(message)
                }
              }}
              placeholder={t('pages.aiAssistant.inputPlaceholder')}
              className={cn(
                'ai-chat-input-scrollbar max-h-[min(40vh,16rem)] min-h-[88px] resize-none overflow-y-auto border-0 bg-transparent py-2 pr-2 pl-1 text-sm shadow-none sm:max-h-none sm:min-h-[120px] sm:text-base',
                'placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0'
              )}
              aria-label={t('pages.aiAssistant.inputPlaceholder')}
            />

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

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
              <div className="relative shrink-0">
                <button
                  ref={settingsTriggerRef}
                  type="button"
                  onClick={() => setIsSettingsOpen((open) => !open)}
                  className="text-dark-500 hover:text-primary-600 flex min-h-9 cursor-pointer items-center gap-2 text-sm font-light transition-colors"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 sm:h-6 sm:w-6">
                    <Icons.Add size={16} strokeWidth={1.5} />
                  </span>
                  {t('pages.aiAssistant.settings')}
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

              <div className="grid w-full min-w-0 grid-cols-[1fr_1fr_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.client')}
                  value={clientScope}
                  onChange={setClientScope}
                  options={clientOptions}
                  triggerClassName="w-full min-w-0 sm:w-32"
                />
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.period')}
                  value={period}
                  onChange={setPeriod}
                  options={periodOptions}
                  triggerClassName="w-full min-w-0 sm:w-32"
                />

                <button
                  type="button"
                  aria-label={
                    voiceStatus === 'listening'
                      ? t('pages.aiAssistant.voiceStopRecording')
                      : t('pages.aiAssistant.voiceStartRecording')
                  }
                  aria-pressed={voiceStatus === 'listening'}
                  disabled={!assistantSettings.voiceInputEnabled}
                  onClick={() => {
                    if (!assistantSettings.voiceInputEnabled) return
                    if (voiceStatus === 'listening') {
                      stopVoiceRecognition()
                    } else {
                      startVoiceRecognition()
                    }
                  }}
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full shadow-md transition-colors sm:h-9 sm:w-9',
                    !assistantSettings.voiceInputEnabled && 'cursor-not-allowed bg-gray-200',
                    assistantSettings.voiceInputEnabled &&
                      voiceStatus === 'idle' &&
                      'bg-primary-300 hover:bg-primary-500 cursor-pointer',
                    assistantSettings.voiceInputEnabled &&
                      voiceStatus === 'listening' &&
                      'bg-error-500 hover:bg-error-600 cursor-pointer ring-2 ring-red-400/60 ring-offset-2'
                  )}
                >
                  {voiceStatus === 'listening' ? (
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
            <p className="mt-2 text-center text-[11px] leading-snug text-gray-400 sm:text-right">
              {t('pages.aiAssistant.inputHint')}
            </p>
          </div>

          {assistantSettings.showQuickSuggestionsAfterResponse && (
            <div className="mt-4 flex w-full min-w-0 flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 lg:gap-4">
              {QUICK_ACTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={isAssistantResponding}
                  className={cn(
                    'text-secondary-800 w-full cursor-pointer rounded-full border border-white bg-white/70 px-4 py-2.5 text-center text-sm leading-[150%] font-light tracking-[-0.02em] sm:w-auto sm:px-5 sm:py-3 sm:text-base sm:leading-[155%] sm:tracking-[-0.32px]',
                    'hover:border-primary-300 hover:bg-primary-50/40 transition-colors disabled:cursor-not-allowed disabled:opacity-60'
                  )}
                  onClick={() => {
                    void submitPrompt(quickActionPrompts[key])
                  }}
                >
                  {t(`pages.aiAssistant.${key}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
    </div>
  )
}
