/**
 * Deep-link на диалог: ?conversation=<id> открывает диалог по ссылке и
 * адресная строка всегда отражает активный диалог (см. conversationUrl.ts).
 * Харнес — как в AiAssistantBetaPage.hydration.test.tsx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_ASSISTANT_SETTINGS, useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import type { AssistantConversationDetail } from '@/features/aiAssistant/api'

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

import { getConversation } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)

const conversationDetail = (id: number): AssistantConversationDetail => ({
  id,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: null,
  pinned: false,
  archived: false,
  created_at: '2026-08-31T10:00:00Z',
  last_message_at: '2026-08-31T10:01:00Z',
  messages: [
    {
      id: 201,
      conversation_id: id,
      role: 'user',
      content: 'Скільки обіцянок на сьогодні?',
      model: null,
      latency_ms: null,
      tokens: null,
      created_at: '2026-08-31T10:00:00Z',
    },
    {
      id: 202,
      conversation_id: id,
      role: 'assistant',
      content: 'На сьогодні 375 домовленостей.',
      model: 'rosh',
      latency_ms: 900,
      tokens: 50,
      created_at: '2026-08-31T10:01:00Z',
    },
  ],
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

describe('AiAssistantBetaPage: deep-link ?conversation=', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    window.history.replaceState(null, '', '/dashboard/ai-assistant')
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('открывает диалог из URL без сохранённого указателя', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=42')
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    expect(await screen.findByText('На сьогодні 375 домовленостей.')).toBeInTheDocument()
    expect(mockedGetConversation).toHaveBeenCalledWith(42)
  })

  it('URL перекрывает сохранённый указатель и открывает диалог даже при выключенном «помнить контекст»', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=42')
    useAiAssistantStore.getState().setActiveConversation('7', 55)
    useAiAssistantStore.getState().saveSettings('7', {
      ...DEFAULT_ASSISTANT_SETTINGS,
      rememberConversationContext: false,
    })
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    await waitFor(() => {
      expect(mockedGetConversation).toHaveBeenCalledWith(42)
    })
    expect(mockedGetConversation).not.toHaveBeenCalledWith(55)
  })

  it('после гидратации сохранённого диалога id появляется в адресе', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    await screen.findByText('На сьогодні 375 домовленостей.')
    await waitFor(() => {
      expect(window.location.search).toContain('conversation=42')
    })
  })

  it('«Новий чат» убирает параметр из адреса', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()
    await screen.findByText('На сьогодні 375 домовленостей.')
    await waitFor(() => expect(window.location.search).toContain('conversation=42'))

    // i18n в тестах отдаёт сырые ключи — целимся так же, как sidebar-тест.
    const newChatButtons = screen.getAllByText('pages.aiAssistant.historyNewChat')
    await userEvent.click(newChatButtons[0])

    await waitFor(() => {
      expect(window.location.search).not.toContain('conversation')
    })
  })

  it('мусорный параметр игнорируется — страница открывается как обычно', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=abc')

    renderPage()

    await waitFor(() => {
      expect(mockedGetConversation).not.toHaveBeenCalled()
    })
  })
})
