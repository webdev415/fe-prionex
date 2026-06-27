import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
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

const CONVERSATION_DETAIL: AssistantConversationDetail = {
  id: 42,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: null,
  pinned: false,
  archived: false,
  created_at: '2026-06-11T10:00:00Z',
  last_message_at: '2026-06-11T10:01:00Z',
  messages: [
    {
      id: 101,
      conversation_id: 42,
      role: 'user',
      content: 'Вопрос',
      model: null,
      latency_ms: null,
      tokens: null,
      created_at: '2026-06-11T10:00:00Z',
    },
  ],
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

// CRM quick-actions moved into the composer "+" hub; the hub trigger is always
// available in the dock (mobile + desktop, empty + active conversation). The
// old stacked bottom quick-action row no longer exists.
describe('AiAssistantBetaPage mobile layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    setViewportWidth(390)
  })

  it('keeps the composer "+" hub reachable on mobile while a conversation is active', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(CONVERSATION_DETAIL)

    renderPage()

    expect(await screen.findByText('Вопрос')).toBeInTheDocument()
    expect(screen.getByTestId('composer-hub-trigger')).toBeInTheDocument()
    // The old stacked bottom quick-action row is gone (actions live in the hub).
    expect(screen.queryByText('pages.aiAssistant.quickClientData')).not.toBeInTheDocument()
  })

  it('shows the composer "+" hub on mobile while the chat is empty', () => {
    renderPage()

    expect(screen.getByTestId('composer-hub-trigger')).toBeInTheDocument()
  })

  it('shows the composer "+" hub in an active conversation on desktop', async () => {
    setViewportWidth(1280)
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(CONVERSATION_DETAIL)

    renderPage()

    expect(await screen.findByText('Вопрос')).toBeInTheDocument()
    expect(screen.getByTestId('composer-hub-trigger')).toBeInTheDocument()
  })
})
