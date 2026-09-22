/**
 * Переключатель «Міркування 31B» — тот же тумблер, что скрывал раздумья, но
 * теперь он ещё и УПРАВЛЯЕТ ими: снятый уходит в тело запроса как
 * `thinking: false`, и 31B отвечает без хода рассуждения (быстрее).
 *
 * Здесь проверяется всё, что видно снаружи страницы: тело запроса, панель
 * раздумий, чип факта хода из кадра `done` и мягкая деградация на прокси, ещё
 * не знающем поля. Видимость самого тумблера и его дефолт живут в
 * AiAssistantBetaPage.showReasoning.test.tsx — там же, где остальная логика
 * меню режима.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  SendChatMessageCallbacks,
} from '@/features/aiAssistant/api'
import type { SseDonePayload } from '@/features/aiAssistant/sse'
import {
  AI_ASSISTANT_STORAGE_KEY,
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
} from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    // Гидратация подменила бы live-сообщение серверным — держим её вечно
    // pending, как в соседних тестах страницы.
    getConversation: vi.fn(() => new Promise(() => {})),
    getConversations: vi.fn().mockResolvedValue([]),
    sendChatMessage: vi.fn(),
    sendFeedback: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { AssistantChatStreamError, sendChatMessage } from '@/features/aiAssistant/api'
import { toast } from 'sonner'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

const USER_ID = '7'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText('pages.aiAssistant.inputPlaceholder') as HTMLTextAreaElement
}

function send(text: string) {
  fireEvent.change(getTextarea(), { target: { value: text } })
  fireEvent.keyDown(getTextarea(), { key: 'Enter' })
}

/** Поднять сохранённые настройки (режим + тумблер) до рендера страницы. */
async function withStoredSettings(settings: { mode: 'fast' | 'thinking'; showReasoning: boolean }) {
  localStorage.setItem(
    AI_ASSISTANT_STORAGE_KEY,
    JSON.stringify({
      state: {
        userId: USER_ID,
        conversationId: null,
        settings: { ...DEFAULT_ASSISTANT_SETTINGS, ...settings },
        historySidebarCollapsed: false,
        reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
      },
      version: 0,
    })
  )
  await useAiAssistantStore.persist.rehydrate()
}

/** Ход, который отвечает текстом и (опционально) фактом хода в кадре `done`. */
function mockTurn(done?: SseDonePayload) {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onText?.('Готово')
      if (done) callbacks?.onDone?.(done)
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Готово',
        coverage_flag: null,
        tool_calls: [],
      }
    }
  )
}

function sentPayload(call = 0): AssistantChatRequest {
  return mockedSendChatMessage.mock.calls[call][0]
}

describe('AiAssistantBetaPage — переключатель «Міркування 31B»', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({
      userId: null,
      conversationId: null,
      settings: null,
      reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
    })
    useAuthStore.setState({ user: { id: USER_ID } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('включённый тумблер просит раздумья: в теле thinking: true', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: true })
    mockTurn()
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    expect(sentPayload().thinking).toBe(true)
  })

  it('снятый тумблер уходит как thinking: false и не открывает панель раздумий', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: false })
    // Ход, который не отвечает: проверяем состояние страницы, пока он идёт.
    mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))
    renderPage()
    send('думай')

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalled())
    expect(sentPayload().thinking).toBe(false)
    // Раздумий не будет вовсе — окно ждать нечего, плашки нет.
    expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
  })

  it('включённый тумблер, наоборот, открывает окно раздумий сразу', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: true })
    mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))
    renderPage()
    send('думай')

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalled())
    expect(await screen.findByTestId('assistant-reasoning')).toBeInTheDocument()
  })

  it('в быстром режиме поля thinking в теле нет вовсе', async () => {
    await withStoredSettings({ mode: 'fast', showReasoning: false })
    mockTurn()
    renderPage()
    send('быстро')
    await screen.findByText('Готово')

    const payload = sentPayload()
    expect(payload.thinking).toBeUndefined()
    // Не только «undefined», но и физически не уходит на провод: прокси старой
    // версии отвергает незнакомое поле, и fast-ход обязан остаться прежним.
    // Искать надо КЛЮЧ: значение `"mode":"thinking"` в теле законно.
    expect(JSON.stringify(payload)).not.toContain('"thinking":')
  })

  it('после ответа чип говорит, чем ход шёл на самом деле', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: false })
    mockTurn({ thinking_requested: false, thinking_used: false })
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    const chip = await screen.findByTestId('assistant-thinking-fact')
    expect(chip).toHaveTextContent('pages.aiAssistant.thinkingUsedOff')
    expect(chip).toHaveAttribute('data-mismatch', 'false')
    expect(chip).not.toHaveAttribute('title')
  })

  it('ответ с раздумьями показывает свой чип', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: true })
    mockTurn({ thinking_requested: true, thinking_used: true })
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    expect(await screen.findByTestId('assistant-thinking-fact')).toHaveTextContent(
      'pages.aiAssistant.thinkingUsedOn'
    )
  })

  it('сервер ответил иначе, чем просили — чип предупреждает', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: false })
    // Просили без раздумий, а сервер всё равно думал.
    mockTurn({ thinking_requested: false, thinking_used: true })
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    const chip = await screen.findByTestId('assistant-thinking-fact')
    expect(chip).toHaveTextContent('pages.aiAssistant.thinkingUsedOn')
    expect(chip).toHaveAttribute('data-mismatch', 'true')
    expect(chip).toHaveAttribute('title', 'pages.aiAssistant.thinkingUsedMismatch')
  })

  it('у быстрого хода чипа нет, даже если сервер прислал факт', async () => {
    await withStoredSettings({ mode: 'fast', showReasoning: true })
    mockTurn({ thinking_requested: false, thinking_used: false })
    renderPage()
    send('быстро')
    await screen.findByText('Готово')

    expect(screen.queryByTestId('assistant-thinking-fact')).not.toBeInTheDocument()
  })

  it('старый шлюз молча игнорирует thinking: ответ без повтора, чип ловит расхождение', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: false })
    // У ChatRequest extra="ignore" (не forbid): прокси, ещё не знающий поля,
    // НЕ отвечает 422 — он молча его роняет и отдаёт 200, раздумья всё равно
    // идут. Старый шлюз может и не прислать thinking_requested. Детектор «сервер
    // не применил мой флаг» — done.thinking_used против локального намерения, а
    // не повтор запроса без поля.
    mockTurn({ thinking_used: true })
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    // Ровно один запрос — никакого повтора без поля.
    expect(mockedSendChatMessage).toHaveBeenCalledTimes(1)
    // Поле ушло (forward-compatible), но никаких «поле не поддерживается» тостов.
    expect(sentPayload().thinking).toBe(false)
    expect(toast.info).not.toHaveBeenCalled()
    // Просили без раздумий, а ход шёл с ними — чип честно предупреждает.
    const chip = await screen.findByTestId('assistant-thinking-fact')
    expect(chip).toHaveAttribute('data-mismatch', 'true')
    expect(chip).toHaveAttribute('title', 'pages.aiAssistant.thinkingUsedMismatch')
  })

  it('чужой отказ 422 не превращается в повтор', async () => {
    await withStoredSettings({ mode: 'thinking', showReasoning: false })
    // 422 про вложение — поле `thinking` тут ни при чём, повторять нечего.
    mockedSendChatMessage.mockRejectedValue(
      new AssistantChatStreamError({ status: 422, message: 'Файл не підходить' })
    )
    renderPage()
    send('думай')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Файл не підходить'))
    expect(mockedSendChatMessage).toHaveBeenCalledTimes(1)
    expect(toast.info).not.toHaveBeenCalled()
  })
})
