import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import type { AssistantConversationDetail } from '@/features/aiAssistant/api'
import { buildContextBlock, buildContextualMessage } from '@/features/onexEmbed/embedContext'

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
      content: 'Сколько клиентов в проекте?',
      model: null,
      latency_ms: null,
      tokens: null,
      created_at: '2026-06-11T10:00:00Z',
    },
    {
      id: 102,
      conversation_id: 42,
      role: 'assistant',
      content: 'В проекте 351 000 клиентов.',
      model: 'rosh',
      latency_ms: 900,
      tokens: 50,
      created_at: '2026-06-11T10:01:00Z',
    },
  ],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

describe('AiAssistantBetaPage conversation hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('restores the persisted conversation from the backend on mount', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(CONVERSATION_DETAIL)

    renderPage()

    expect(await screen.findByText('Сколько клиентов в проекте?')).toBeInTheDocument()
    expect(await screen.findByText('В проекте 351 000 клиентов.')).toBeInTheDocument()
    expect(mockedGetConversation).toHaveBeenCalledWith(42)
  })

  it('does not fetch anything when there is no persisted conversation', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockedGetConversation).not.toHaveBeenCalled()
    })
  })

  it('ignores a conversation persisted by another user', async () => {
    useAiAssistantStore.getState().setActiveConversation('8', 42)

    renderPage()

    await waitFor(() => {
      expect(mockedGetConversation).not.toHaveBeenCalled()
    })
  })

  const ONEX_CONTEXT = {
    url: 'https://crm/dashboard/clients/42',
    title: 'Картка Іваненка',
    clientId: 42,
    selection: 'борг 12 000',
    text: 'тіло сторінки клієнта',
    ts: null,
  }

  const hydrateStoredUserMessage = (content: string) => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue({
      ...CONVERSATION_DETAIL,
      messages: [{ ...CONVERSATION_DETAIL.messages[0], content }],
    })
    renderPage()
  }

  it('hides the OneX context block stored with a message — on the plain page too', async () => {
    // The dock sends `<what the operator typed>\n\n<дані-сторінки …>…</дані-сторінки>`
    // and the backend keeps `message` verbatim, so without stripping the machine
    // block resurfaces inside the operator's own bubble on every reload —
    // including in a normal CRM tab, which never opted into the dock.
    hydrateStoredUserMessage(buildContextualMessage('Що йому запропонувати?', ONEX_CONTEXT))

    expect(await screen.findByText('Що йому запропонувати?')).toBeInTheDocument()
    expect(screen.queryByText(/дані-сторінки/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Текст сторінки/)).not.toBeInTheDocument()
  })

  it('hides it in the older leading placement too', async () => {
    // Turns sent while the block still led the message are already in
    // `ai_assistant_db`; those bubbles must render just as clean.
    const block = buildContextBlock(ONEX_CONTEXT)!
    hydrateStoredUserMessage(`${block}\n\nЩо йому запропонувати?`)

    expect(await screen.findByText('Що йому запропонувати?')).toBeInTheDocument()
    expect(screen.queryByText(/дані-сторінки/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Текст сторінки/)).not.toBeInTheDocument()
  })

  it('clears the stored pointer when the conversation is gone on the backend', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    const notFound = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404 },
    })
    mockedGetConversation.mockRejectedValue(notFound)

    renderPage()

    await waitFor(() => {
      expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    })
  })
})
