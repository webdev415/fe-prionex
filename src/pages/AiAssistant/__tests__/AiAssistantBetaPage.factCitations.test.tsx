import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type { AssistantChatResponse, SendChatMessageCallbacks } from '@/features/aiAssistant/api'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    // Гидратация диалога заменила бы live-сообщение серверным БЕЗ reasoning (он
    // эфемерен до Слоя 5) — что гонится с кликом по факту и делает тест flaky.
    // Держим getConversation вечно pending: гидратация не срабатывает, reasoning
    // текущего хода стабилен — проверяем именно клик факта в открытом ходе.
    getConversation: vi.fn(() => new Promise(() => {})),
    getConversations: vi.fn().mockResolvedValue([]),
    sendChatMessage: vi.fn(),
    sendFeedback: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { sendChatMessage } from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

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

/**
 * A settled turn that streamed reasoning + one `citations` frame and an answer
 * carrying a `[[1]]` fact footnote — the shape the fact→panel wiring consumes.
 */
function mockFactTurn() {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onReasoning?.('Проверяю таблицу платежей.')
      callbacks?.onCitations?.([{ id: 1, kind: 'sql', ref: 'debts:remaining_debt_amount' }])
      callbacks?.onText?.('Остаток долга 48 750 ₴[[1]]')
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Остаток долга 48 750 ₴[[1]]',
        coverage_flag: null,
        tool_calls: [],
        citations: [{ id: 1, kind: 'sql', ref: 'debts:remaining_debt_amount' }],
      }
    }
  )
}

describe('AiAssistantBetaPage — факт-сноска открывает панель «Активность» (Слой 1/3)', () => {
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
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('рендерит кликабельную сноску с меткой из citations и открывает панель по клику', async () => {
    mockFactTurn()
    renderPage()
    send('сколько остаток долга?')

    await screen.findByText(/Остаток долга/)

    // Сноска [[1]] — интерактивная (передан onFactClick), тайтл = ref цитаты.
    const fact = await screen.findByTestId('markdown-fact')
    expect(fact).toHaveAttribute('role', 'button')
    expect(fact).toHaveAttribute('title', 'debts:remaining_debt_amount')

    // Ход settled → панель ещё не смонтирована.
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()

    // Клик по сноске открывает панель «Активность» именно этого сообщения.
    // timeout поднят: на медленном CI-runner'е монтирование тяжёлой страницы +
    // re-render панели не укладывается в дефолтные 1000ms (локально стабильно).
    fireEvent.click(screen.getByTestId('markdown-fact'))
    const scroll = await screen.findByTestId('assistant-reasoning-scroll', undefined, {
      timeout: 5000,
    })
    expect(scroll).toHaveTextContent('Проверяю таблицу платежей.')
  })

  it('повторный клик по сноске не сворачивает панель (open идемпотентен, не toggle)', async () => {
    mockFactTurn()
    renderPage()
    send('покажи остаток')
    await screen.findByText(/Остаток долга/)

    await screen.findByTestId('markdown-fact')
    fireEvent.click(screen.getByTestId('markdown-fact'))
    expect(
      await screen.findByTestId('assistant-reasoning-scroll', undefined, { timeout: 5000 })
    ).toBeInTheDocument()

    // Второй клик по факту не должен закрыть панель (в отличие от toggle-чипа).
    fireEvent.click(screen.getByTestId('markdown-fact'))
    expect(screen.getByTestId('assistant-reasoning-scroll')).toBeInTheDocument()
  })
})
