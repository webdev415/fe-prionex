import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import type {
  AssistantConversationDetail,
  AssistantConversationSummary,
} from '@/features/aiAssistant/api'

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

import { getConversation, getConversations } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)
const mockedGetConversations = vi.mocked(getConversations)

const DAY = 24 * 60 * 60 * 1000

function summary(id: number, lastMessageAt: string): AssistantConversationSummary {
  return {
    id,
    user_id: 7,
    project_id: 1,
    channel: 'web',
    status: 'active',
    title: null,
    pinned: false,
    archived: false,
    created_at: lastMessageAt,
    last_message_at: lastMessageAt,
  }
}

function detail(id: number, text: string): AssistantConversationDetail {
  return {
    ...summary(id, new Date().toISOString()),
    messages: [
      {
        id: id * 10 + 1,
        conversation_id: id,
        role: 'user',
        content: text,
        model: null,
        latency_ms: null,
        tokens: null,
        created_at: new Date().toISOString(),
      },
    ],
  }
}

const SUMMARIES = [
  summary(42, new Date().toISOString()),
  summary(43, new Date(Date.now() - DAY).toISOString()),
]

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

describe('AiAssistantBetaPage conversation sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({
      userId: null,
      conversationId: null,
      settings: null,
      historySidebarCollapsed: false,
    })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    mockedGetConversations.mockResolvedValue(SUMMARIES)
    mockedGetConversation.mockImplementation(async (id: number) =>
      id === 42 ? detail(42, 'Сообщение в чате 42') : detail(43, 'Сообщение в чате 43')
    )
    setViewportWidth(1280)
  })

  it('opens a conversation from the sidebar and persists the pointer', async () => {
    renderPage()

    fireEvent.click(await screen.findByTestId('conversation-item-43'))

    expect(await screen.findByText('Сообщение в чате 43')).toBeInTheDocument()
    expect(mockedGetConversation).toHaveBeenCalledWith(43)
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBe(43)
  })

  it('switches to another conversation while a chat is already open', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    renderPage()

    expect(await screen.findByText('Сообщение в чате 42')).toBeInTheDocument()

    fireEvent.click(await screen.findByTestId('conversation-item-43'))

    expect(await screen.findByText('Сообщение в чате 43')).toBeInTheDocument()
    expect(screen.queryByText('Сообщение в чате 42')).not.toBeInTheDocument()
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBe(43)
  })

  it('starts a fresh chat via the new-chat button', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)

    renderPage()

    expect(await screen.findByText('Сообщение в чате 42')).toBeInTheDocument()

    fireEvent.click(screen.getByText('pages.aiAssistant.historyNewChat'))

    await waitFor(() => {
      expect(screen.queryByText('Сообщение в чате 42')).not.toBeInTheDocument()
    })
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    expect(screen.getByText('pages.aiAssistant.greeting')).toBeInTheDocument()
  })

  it('persists the collapsed state in the assistant store', async () => {
    renderPage()

    fireEvent.click(await screen.findByLabelText('pages.aiAssistant.historyCollapseAria'))

    expect(useAiAssistantStore.getState().historySidebarCollapsed).toBe(true)
    expect(await screen.findByLabelText('pages.aiAssistant.historyExpandAria')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('pages.aiAssistant.historyExpandAria'))
    expect(useAiAssistantStore.getState().historySidebarCollapsed).toBe(false)
  })

  it('shows the history as a drawer on mobile', async () => {
    setViewportWidth(390)

    renderPage()

    // Desktop panel is not mounted on mobile.
    expect(screen.queryByLabelText('pages.aiAssistant.historyCollapseAria')).not.toBeInTheDocument()
    expect(screen.queryByTestId('conversation-item-42')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('pages.aiAssistant.historyOpenAria'))

    fireEvent.click(await screen.findByTestId('conversation-item-43'))

    // Selecting a conversation closes the drawer and loads the dialog.
    await waitFor(() => {
      expect(screen.queryByTestId('conversation-item-43')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Сообщение в чате 43')).toBeInTheDocument()
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBe(43)
  })

  it('closes the mobile drawer by tapping the backdrop', async () => {
    setViewportWidth(390)

    renderPage()

    fireEvent.click(screen.getByLabelText('pages.aiAssistant.historyOpenAria'))
    await screen.findByTestId('conversation-item-42')

    fireEvent.click(screen.getAllByLabelText('pages.aiAssistant.historyCloseAria')[0])

    await waitFor(() => {
      expect(screen.queryByTestId('conversation-item-42')).not.toBeInTheDocument()
    })
  })
})
