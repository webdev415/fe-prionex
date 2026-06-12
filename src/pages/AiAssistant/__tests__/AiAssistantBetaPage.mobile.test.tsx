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

// Quick-action buttons render with the pages.aiAssistant.* translation keys
// (the global i18n mock returns raw keys).
const QUICK_ACTION_TEXT = 'pages.aiAssistant.quickClientData'

describe('AiAssistantBetaPage mobile layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    setViewportWidth(390)
  })

  it('hides quick actions on mobile while a conversation is active', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(CONVERSATION_DETAIL)

    renderPage()

    expect(await screen.findByText('Вопрос')).toBeInTheDocument()
    expect(screen.queryByText(QUICK_ACTION_TEXT)).not.toBeInTheDocument()
  })

  it('keeps quick actions on mobile while the chat is empty', () => {
    renderPage()

    expect(screen.getByText(QUICK_ACTION_TEXT)).toBeInTheDocument()
  })

  it('keeps quick actions in an active conversation on desktop', async () => {
    setViewportWidth(1280)
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(CONVERSATION_DETAIL)

    renderPage()

    expect(await screen.findByText('Вопрос')).toBeInTheDocument()
    expect(screen.getByText(QUICK_ACTION_TEXT)).toBeInTheDocument()
  })
})
