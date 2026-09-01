/**
 * Возврат в диалог, чей ответ ещё дописывается на сервере (обновление
 * страницы посреди ответа): страница показывает «печатает…», опрашивает
 * диалог и подменяет заглушку настоящим ответом; указатель диалога
 * сохраняется уже при `meta`, а не после `done`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import type { AssistantConversationDetail } from '@/features/aiAssistant/api'

vi.mock('../answerPolling', () => ({ ANSWER_POLL_INTERVAL_MS: 30, ANSWER_POLL_MAX_MS: 60_000 }))
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

import { getConversation, sendChatMessage } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)
const mockedSendChatMessage = vi.mocked(sendChatMessage)

const userOnly: AssistantConversationDetail = {
  id: 42,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: null,
  pinned: false,
  archived: false,
  created_at: '2026-08-31T10:00:00Z',
  last_message_at: '2026-08-31T10:00:00Z',
  messages: [
    {
      id: 201,
      conversation_id: 42,
      role: 'user',
      content: 'Скільки обіцянок на сьогодні?',
      model: null,
      latency_ms: null,
      tokens: null,
      created_at: '2026-08-31T10:00:00Z',
    },
  ],
}
const answered: AssistantConversationDetail = {
  ...userOnly,
  messages: [
    ...userOnly.messages,
    {
      id: 202,
      conversation_id: 42,
      role: 'assistant',
      content: 'На сьогодні 375 домовленостей.',
      model: 'rosh',
      latency_ms: 900,
      tokens: 50,
      created_at: '2026-08-31T10:01:00Z',
    },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

describe('AiAssistantBetaPage: ответ дописывается после обрыва', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('вопрос без ответа → «печатает…», опрос, ответ подменяет заглушку', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValueOnce(userOnly).mockResolvedValue(answered)

    renderPage()

    expect(await screen.findByText('Скільки обіцянок на сьогодні?')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.answerInProgress')).toBeInTheDocument()

    expect(await screen.findByText('На сьогодні 375 домовленостей.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('pages.aiAssistant.answerInProgress')).not.toBeInTheDocument()
    })
    expect(mockedGetConversation.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('диалог с ответом не опрашивается', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(answered)

    renderPage()

    expect(await screen.findByText('На сьогодні 375 домовленостей.')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 120))
    expect(mockedGetConversation).toHaveBeenCalledTimes(1)
  })

  it('указатель диалога сохраняется при meta, до done', async () => {
    let metaSeen = false
    mockedSendChatMessage.mockImplementation(async (_payload, callbacks) => {
      callbacks?.onMeta?.({ conversation_id: 77 })
      metaSeen = useAiAssistantStore.getState().conversationIdFor('7') === 77
      return {
        conversation_id: 77,
        message_id: 5,
        response: 'Готово',
        coverage_flag: null,
        tool_calls: [],
      }
    })
    renderPage()
    const input = screen.getByRole('textbox', { name: 'pages.aiAssistant.inputPlaceholder' })
    const { default: userEvent } = await import('@testing-library/user-event')
    await userEvent.type(input, 'питання')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalled())
    expect(metaSeen).toBe(true)
  })
})
