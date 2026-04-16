import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
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
    return [
      `${summaryPrefix} ${t('pages.aiAssistant.mockDetectedRequest')}: "${input}".`,
      '',
      t('pages.aiAssistant.mockTableHeader'),
      '| Metric | Value |',
      '| --- | --- |',
      '| Clients | 42 |',
      '| Debt at risk | $128,450 |',
      '| Overdue ratio | 17.4% |',
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
            'text-dark-500 inline-flex h-6 cursor-pointer items-center justify-center gap-1.5 border-l-1 border-l-gray-200 bg-white px-3 text-xs font-light shadow-none sm:w-32 sm:max-w-none',
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
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
  const pageRootRef = useRef<HTMLDivElement>(null)
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

  const clientOptions = useMemo(
    () => [
      { value: 'all', label: t('pages.aiAssistant.allClients') },
      { value: 'my', label: t('pages.aiAssistant.myClients') },
    ],
    [t]
  )

  const settingsPanel = (
    <div className="border-light-200 w-full rounded-2xl border bg-white p-4 shadow-xl sm:w-[360px]">
      <div className="mb-3">
        <p className="text-dark-500 text-sm font-medium">{t('pages.aiAssistant.settingsTitle')}</p>
        <p className="text-xs text-gray-500">{t('pages.aiAssistant.settingsDescription')}</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-dark-500 mb-2 text-xs font-semibold tracking-wide uppercase">
            {t('pages.aiAssistant.assistantPreferences')}
          </p>
          <p className="text-dark-500 text-xs font-light">{t('pages.aiAssistant.responseMode')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applySettings((s) => ({ ...s, responseMode: 'short' }))}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-xs font-light transition-colors',
                assistantSettings.responseMode === 'short'
                  ? 'border-primary-500 bg-primary-50 text-dark-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {t('pages.aiAssistant.responseShort')}
            </button>
            <button
              type="button"
              onClick={() => applySettings((s) => ({ ...s, responseMode: 'detailed' }))}
              className={cn(
                'rounded-lg border px-2 py-1.5 text-xs font-light transition-colors',
                assistantSettings.responseMode === 'detailed'
                  ? 'border-primary-500 bg-primary-50 text-dark-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {t('pages.aiAssistant.responseDetailed')}
            </button>
          </div>

          <p className="text-dark-500 mt-3 text-xs font-light">
            {t('pages.aiAssistant.outputFormat')}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(['text', 'tableFirst', 'mixed'] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => applySettings((s) => ({ ...s, outputFormat: format }))}
                className={cn(
                  'rounded-lg border px-2 py-1.5 text-[11px] font-light transition-colors',
                  assistantSettings.outputFormat === format
                    ? 'border-primary-500 bg-primary-50 text-dark-500'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {format === 'text' && t('pages.aiAssistant.outputText')}
                {format === 'tableFirst' && t('pages.aiAssistant.outputTableFirst')}
                {format === 'mixed' && t('pages.aiAssistant.outputMixed')}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-dark-500 text-xs font-light">
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
        </div>

        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-dark-500 mb-2 text-xs font-semibold tracking-wide uppercase">
            {t('pages.aiAssistant.contextBehavior')}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-dark-500 text-xs font-light">
                {t('pages.aiAssistant.useSelectedClientAutomatically')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.useSelectedClientAutomatically}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, useSelectedClientAutomatically: checked }))
                }
                ariaLabel={t('pages.aiAssistant.useSelectedClientAutomatically')}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-dark-500 text-xs font-light">
                {t('pages.aiAssistant.useSelectedPeriodAutomatically')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.useSelectedPeriodAutomatically}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, useSelectedPeriodAutomatically: checked }))
                }
                ariaLabel={t('pages.aiAssistant.useSelectedPeriodAutomatically')}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-dark-500 text-xs font-light">
                {t('pages.aiAssistant.rememberConversationContext')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.rememberConversationContext}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, rememberConversationContext: checked }))
                }
                ariaLabel={t('pages.aiAssistant.rememberConversationContext')}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 p-3">
          <p className="text-dark-500 mb-2 text-xs font-semibold tracking-wide uppercase">
            {t('pages.aiAssistant.suggestedActions')}
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-dark-500 text-xs font-light">
                {t('pages.aiAssistant.showQuickSuggestionsAfterResponse')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.showQuickSuggestionsAfterResponse}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, showQuickSuggestionsAfterResponse: checked }))
                }
                ariaLabel={t('pages.aiAssistant.showQuickSuggestionsAfterResponse')}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-dark-500 text-xs font-light">
                {t('pages.aiAssistant.autoScrollToLatestAnswer')}
              </span>
              <ToggleSwitch
                checked={assistantSettings.autoScrollToLatestAnswer}
                onChange={(checked) =>
                  applySettings((s) => ({ ...s, autoScrollToLatestAnswer: checked }))
                }
                ariaLabel={t('pages.aiAssistant.autoScrollToLatestAnswer')}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-dark-500 text-xs font-semibold tracking-wide uppercase">
              {t('pages.aiAssistant.advanced')}
            </p>
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
              className="text-error-600 border-error-200 hover:bg-error-50 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-light transition-colors"
            >
              <Icons.Delete size={12} strokeWidth={1.5} />
              {t('pages.aiAssistant.clearConversation')}
            </button>
          </div>
        </div>
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
        'relative flex min-h-[calc(100vh-5.5rem)] w-full flex-1 flex-col self-stretch supports-[height:100dvh]:min-h-[calc(100dvh-5.5rem)]'
      )}
    >
      {hasConversation ? (
        <div className="relative min-h-0 flex-1 px-4 pt-4 pb-72 sm:px-12 sm:pt-6 sm:pb-80 lg:px-20">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              {chatMessages.map((item) => (
                <div
                  key={item.id}
                  className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap shadow-sm',
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-72 sm:px-12 sm:pb-80 lg:px-20">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-5 text-center">
            <img src="/logo.svg" alt={t('app.name')} className="mx-auto h-12 w-auto" />
            <span className="text-dark-500 text-center text-[30px] leading-[129%] font-light tracking-[-0.6px]">
              {t('pages.aiAssistant.greeting')}
            </span>
          </div>
        </div>
      )}

      <div className="from-light-50 via-light-50/95 pointer-events-none fixed right-0 bottom-0 left-0 z-20 flex w-full shrink-0 flex-col items-center bg-gradient-to-t to-transparent px-4 pt-6 pb-4 sm:px-12 lg:px-20">
        {hasConversation && showScrollToLatest && (
          <button
            type="button"
            aria-label="Scroll to latest"
            onClick={() => scrollToConversationBottom('smooth')}
            className="border-light-200 text-dark-500 hover:bg-light-50 pointer-events-auto absolute -top-4 left-1/2 z-30 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border bg-white shadow-md transition-colors"
          >
            <Icons.ArrowDown size={16} strokeWidth={1.5} />
          </button>
        )}
        <div className="pointer-events-auto w-full max-w-5xl">
          <div className="border-light-200 shadow-dark-500/5 rounded-3xl border border-white/60 bg-white/95 p-4 shadow-lg sm:p-5">
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
                'min-h-[120px] resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none',
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

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="relative">
                <button
                  ref={settingsTriggerRef}
                  type="button"
                  onClick={() => setIsSettingsOpen((open) => !open)}
                  className="text-dark-500 hover:text-primary-600 flex cursor-pointer items-center gap-2 text-sm font-light transition-colors"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500">
                    <Icons.Add size={16} strokeWidth={1.5} />
                  </span>
                  {t('pages.aiAssistant.settings')}
                </button>
                {!isMobileOrTablet && isSettingsOpen && (
                  <div ref={settingsPanelRef} className="absolute bottom-full left-0 z-30 mb-2">
                    {settingsPanel}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
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
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-md transition-colors',
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
            <p className="mt-2 text-right text-[11px] text-gray-400">
              {t('pages.aiAssistant.inputHint')}
            </p>
          </div>

          {assistantSettings.showQuickSuggestionsAfterResponse && (
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              {QUICK_ACTION_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={isAssistantResponding}
                  className={cn(
                    'text-secondary-800 cursor-pointer rounded-full border border-white bg-white/70 px-5 py-3 text-center text-base leading-[155%] font-light tracking-[-0.32px]',
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
            aria-label="Close settings"
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsSettingsOpen(false)}
          />
          <div className="absolute right-0 bottom-0 left-0 max-h-[85vh] overflow-auto rounded-t-2xl bg-white p-4 shadow-2xl">
            {settingsPanel}
          </div>
        </div>
      )}
    </div>
  )
}
