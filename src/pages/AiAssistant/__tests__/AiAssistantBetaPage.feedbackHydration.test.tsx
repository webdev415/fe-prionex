import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { getConversation } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)

function conversation(
  feedback: AssistantConversationDetail['messages'][number]['feedback']
): AssistantConversationDetail {
  return {
    id: 42,
    user_id: 7,
    project_id: 1,
    channel: 'web',
    status: 'active',
    title: null,
    pinned: false,
    archived: false,
    created_at: '2026-09-25T10:00:00Z',
    last_message_at: '2026-09-25T10:01:00Z',
    messages: [
      {
        id: 101,
        conversation_id: 42,
        role: 'user',
        content: 'Сколько обещаний на сегодня?',
        model: null,
        latency_ms: null,
        tokens: null,
        created_at: '2026-09-25T10:00:00Z',
      },
      {
        id: 102,
        conversation_id: 42,
        role: 'assistant',
        content: 'На сегодня 12 обещаний оплаты.',
        model: 'rosh',
        latency_ms: 900,
        tokens: 50,
        created_at: '2026-09-25T10:01:00Z',
        feedback,
      },
    ],
  } as AssistantConversationDetail
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

function pressedButtons(): HTMLElement[] {
  return screen.queryAllByRole('button', { pressed: true })
}

describe('AiAssistantBetaPage — оценка ответа после F5', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({
      userId: null,
      conversationId: null,
      settings: null,
      reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
    })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('saved 👍 and «clear» stay highlighted and locked after reload', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(
      conversation({ rating: 'useful', comprehension: 'clear' })
    )

    renderPage()
    await screen.findByText(/12 обещаний/)

    const pressed = pressedButtons()
    expect(pressed).toHaveLength(2)
    // Группа заблокирована, как сразу после клика: вторую оценку не поставить.
    for (const button of pressed) expect(button).toBeDisabled()
  })

  it('an answer without a saved mark shows grey buttons (control)', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(conversation(null))

    renderPage()
    await screen.findByText(/12 обещаний/)

    expect(pressedButtons()).toHaveLength(0)
  })
})
