import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type { AssistantConversationDetail } from '@/features/aiAssistant/api'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    getConversation: vi.fn(),
    getConversations: vi.fn().mockResolvedValue([]),
    sendChatMessage: vi.fn(),
    sendFeedback: vi.fn(),
    markCitationStep: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { getConversation, markCitationStep } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)
const mockedMarkCitationStep = vi.mocked(markCitationStep)

/** Ассистентское сообщение с раздумьями + источниками и сносками `[[1]]`/`[[2]]`. */
const ASSISTANT_MESSAGE_ID = 102

const HYDRATED_CONVERSATION: AssistantConversationDetail = {
  id: 42,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: null,
  pinned: false,
  archived: false,
  created_at: '2026-07-08T10:00:00Z',
  last_message_at: '2026-07-08T10:01:00Z',
  messages: [
    {
      id: 101,
      conversation_id: 42,
      role: 'user',
      content: 'Сколько клиентов в проекте?',
      model: null,
      latency_ms: null,
      tokens: null,
      created_at: '2026-07-08T10:00:00Z',
    },
    {
      id: ASSISTANT_MESSAGE_ID,
      conversation_id: 42,
      role: 'assistant',
      content: 'В проекте 351 000 клиентов[[1]], из них активных 128 400[[2]].',
      model: 'rosh',
      latency_ms: 900,
      tokens: 50,
      created_at: '2026-07-08T10:01:00Z',
      // Слой 5: сервер отдаёт раздумья + источники в ассистентском сообщении.
      // ВАЖНО: источники приходят документированным конвертом `{items:[...]}`
      // (ровно так их персистит бэкенд и шлёт фрейм `citations` стрима), НЕ голым
      // массивом. Раньше мок был массивом и скрывал реальный контракт — из-за
      // чего `.map is not a function` (белый экран) не ловился ни фронт-, ни
      // бэкенд-тестами. Держим форму реалистичной, чтобы регресс не вернулся.
      reasoning: 'Считаю клиентов по таблице clients.',
      citations: {
        items: [
          {
            id: 1,
            kind: 'sql',
            ref: 'clients:count',
            query: 'SELECT count(*) FROM clients',
            columns: ['count'],
            rows: [[351000]],
          },
          { id: 2, kind: 'sql', ref: 'clients:active_count' },
        ],
      },
    },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

/** Свежий DOM-узел факт-сноски по номеру (не сохранённая ссылка — против flaky). */
function getFact(n: number): HTMLElement {
  const node = screen
    .getAllByTestId('markdown-fact')
    .find((el) => el.getAttribute('data-fact-n') === String(n))
  if (!node) throw new Error(`fact [[${n}]] not found`)
  return node
}

/** Свежий DOM-узел источника по номеру (data-citation-id). */
function getSource(n: number): HTMLElement {
  const node = screen
    .getAllByTestId('citation-source')
    .find((el) => el.getAttribute('data-citation-id') === String(n))
  if (!node) throw new Error(`source #${n} not found`)
  return node
}

/** Свежая кнопка-пометка внутри источника (свежий узел в момент клика). */
function getMarkButton(sourceN: number, verdict: 'ok' | 'wrong'): HTMLElement {
  return within(getSource(sourceN)).getByTestId(`citation-mark-${verdict}`)
}

describe('AiAssistantBetaPage — гидратация раздумий/источников + пометки (Слой 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // scrollIntoView мокаем ДО рендера — авто-скролл источника/чата в jsdom иначе
    // бросает (это уже ловило нас flaky в CI).
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
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('гидратирует диалог: чип раздумий + клик по факту открывает панель с источниками', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(HYDRATED_CONVERSATION)

    renderPage()

    // Диалог гидратирован из истории (F5): чип «Ход рассуждения» присутствует у
    // загруженного сообщения (messageHasReasoning сработал на reasoning из бэкенда).
    await screen.findByText(/В проекте/)
    expect(await screen.findByTestId('assistant-reasoning')).toBeInTheDocument()

    // Панель ещё не смонтирована.
    expect(screen.queryByTestId('assistant-citations')).not.toBeInTheDocument()

    // Клик по факт-сноске в ЗАГРУЖЕННОМ диалоге открывает панель «Активность»
    // именно этого сообщения — раздумья и источники доступны после гидратации.
    fireEvent.click(getFact(1))

    const scroll = await screen.findByTestId('assistant-reasoning-scroll', undefined, {
      timeout: 5000,
    })
    expect(scroll).toHaveTextContent('Считаю клиентов по таблице clients.')

    await screen.findByTestId('assistant-citations')
    expect(screen.getAllByTestId('citation-source')).toHaveLength(2)
    // Источник №1 (sql) — запрос + таблица, фокус на нём.
    expect(within(getSource(1)).getByTestId('citation-sql')).toHaveTextContent(
      'SELECT count(*) FROM clients'
    )
    expect(getSource(1)).toHaveClass('border-primary-400')
  })

  it('клик по чипу раздумий тоже открывает панель загруженного диалога', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(HYDRATED_CONVERSATION)

    renderPage()

    const chip = await screen.findByTestId('assistant-reasoning')
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()

    // Тоггл-чип в бабле разворачивает панель того же гидратированного сообщения.
    fireEvent.click(within(chip).getByRole('button'))
    expect(
      await screen.findByTestId('assistant-reasoning-scroll', undefined, { timeout: 5000 })
    ).toHaveTextContent('Считаю клиентов по таблице clients.')
  })

  it('пометка источника: POST step-mark с вердиктом; повтор снимает (без POST), другой — меняет', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(HYDRATED_CONVERSATION)

    renderPage()

    await screen.findByText(/В проекте/)
    fireEvent.click(getFact(1))
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })

    // Кнопки пометки доступны — у сообщения есть серверный message_id (гидратация).
    expect(getMarkButton(1, 'ok')).toBeInTheDocument()

    // 1) Клик «верно» → оптимистичная подсветка + POST step-mark с вердиктом ok.
    fireEvent.click(getMarkButton(1, 'ok'))
    await waitFor(() => expect(getMarkButton(1, 'ok')).toHaveAttribute('aria-pressed', 'true'))
    expect(mockedMarkCitationStep).toHaveBeenCalledTimes(1)
    expect(mockedMarkCitationStep).toHaveBeenLastCalledWith({
      message_id: ASSISTANT_MESSAGE_ID,
      citation_id: 1,
      verdict: 'ok',
    })

    // 2) Повторный клик по «верно» снимает пометку (UI), нового POST нет
    // (контракт step-mark выражает только ok/wrong — «снятие» не шлём).
    fireEvent.click(getMarkButton(1, 'ok'))
    await waitFor(() => expect(getMarkButton(1, 'ok')).toHaveAttribute('aria-pressed', 'false'))
    expect(mockedMarkCitationStep).toHaveBeenCalledTimes(1)

    // 3) Клик «неверно» → меняет выбор и шлёт POST с вердиктом wrong.
    fireEvent.click(getMarkButton(1, 'wrong'))
    await waitFor(() => expect(getMarkButton(1, 'wrong')).toHaveAttribute('aria-pressed', 'true'))
    expect(mockedMarkCitationStep).toHaveBeenCalledTimes(2)
    expect(mockedMarkCitationStep).toHaveBeenLastCalledWith({
      message_id: ASSISTANT_MESSAGE_ID,
      citation_id: 1,
      verdict: 'wrong',
    })
  })

  it('гидратация не падает на конверте без items / битых источниках (регресс .map is not a function)', async () => {
    // Старый бэкенд мог отдать `citations` без `items`, `null` или мусор.
    // normalizeCitations должен вернуть [] — сообщение рендерится без секции
    // источников, а не роняет страницу в ErrorBoundary.
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue({
      ...HYDRATED_CONVERSATION,
      messages: HYDRATED_CONVERSATION.messages.map((m) =>
        m.role === 'assistant'
          ? { ...m, content: 'Просто ответ без источников.', citations: { note: 'no items' } }
          : m
      ),
    })

    renderPage()

    // Текст сообщения отрисовался (страница жива, ErrorBoundary не сработал)…
    expect(await screen.findByText(/Просто ответ без источников/)).toBeInTheDocument()
    // …и секции источников нет — цитат не было.
    expect(screen.queryByTestId('citation-source')).not.toBeInTheDocument()
  })
})
