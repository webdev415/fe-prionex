import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConversationSidebar } from '../ConversationSidebar'
import type { AssistantConversationSummary } from '@/features/aiAssistant/api'

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

import { getConversations } from '@/features/aiAssistant/api'

const mockedGetConversations = vi.mocked(getConversations)

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function summary(id: number, lastMessageAt: string | null, createdAt?: string) {
  return {
    id,
    user_id: 7,
    project_id: 1,
    channel: 'web',
    status: 'active',
    created_at: createdAt ?? new Date(Date.now() - 10 * DAY).toISOString(),
    last_message_at: lastMessageAt,
  } satisfies AssistantConversationSummary
}

// `new Date()` is always "today"; now - 24h is always "yesterday"; now - 72h
// is always "earlier" — regardless of the wall-clock time the suite runs at.
const CONVERSATIONS: AssistantConversationSummary[] = [
  summary(42, new Date().toISOString()),
  summary(41, new Date(Date.now() - DAY).toISOString()),
  summary(40, new Date(Date.now() - 3 * DAY).toISOString()),
]

function renderSidebar(props: Partial<Parameters<typeof ConversationSidebar>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const baseProps = {
    activeConversationId: null,
    onSelectConversation: vi.fn(),
    onNewChat: vi.fn(),
    collapsed: false,
    onCollapsedChange: vi.fn(),
  }
  return {
    ...render(<ConversationSidebar {...baseProps} {...props} />, { wrapper }),
    props: { ...baseProps, ...props },
  }
}

describe('ConversationSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetConversations.mockResolvedValue(CONVERSATIONS)
  })

  it('renders conversations grouped into Today / Yesterday / Earlier', async () => {
    renderSidebar()

    expect(await screen.findByTestId('conversation-item-42')).toBeInTheDocument()
    expect(screen.getByTestId('conversation-item-41')).toBeInTheDocument()
    expect(screen.getByTestId('conversation-item-40')).toBeInTheDocument()

    const headers = [
      screen.getByText('pages.aiAssistant.historyToday'),
      screen.getByText('pages.aiAssistant.historyYesterday'),
      screen.getByText('pages.aiAssistant.historyEarlier'),
    ]
    // Group headers appear in chronological order: today first, earlier last.
    expect(
      headers[0].compareDocumentPosition(headers[1]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      headers[1].compareDocumentPosition(headers[2]) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('uses created_at for grouping when last_message_at is missing', async () => {
    mockedGetConversations.mockResolvedValue([summary(99, null, new Date().toISOString())])

    renderSidebar()

    expect(await screen.findByTestId('conversation-item-99')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.historyToday')).toBeInTheDocument()
    expect(screen.queryByText('pages.aiAssistant.historyEarlier')).not.toBeInTheDocument()
  })

  it('highlights the active conversation', async () => {
    renderSidebar({ activeConversationId: 41 })

    const active = await screen.findByTestId('conversation-item-41')
    expect(active).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId('conversation-item-42')).not.toHaveAttribute('aria-current')
  })

  it('calls onSelectConversation when a conversation is clicked', async () => {
    const { props } = renderSidebar()

    fireEvent.click(await screen.findByTestId('conversation-item-41'))

    expect(props.onSelectConversation).toHaveBeenCalledWith(41)
  })

  it('calls onNewChat when the new-chat button is clicked', async () => {
    const { props } = renderSidebar()

    fireEvent.click(await screen.findByText('pages.aiAssistant.historyNewChat'))

    expect(props.onNewChat).toHaveBeenCalled()
  })

  it('filters conversations by the search query', async () => {
    renderSidebar()

    await screen.findByTestId('conversation-item-42')
    fireEvent.change(screen.getByPlaceholderText('pages.aiAssistant.historySearchPlaceholder'), {
      target: { value: '41' },
    })

    expect(screen.getByTestId('conversation-item-41')).toBeInTheDocument()
    expect(screen.queryByTestId('conversation-item-42')).not.toBeInTheDocument()
    expect(screen.queryByTestId('conversation-item-40')).not.toBeInTheDocument()
  })

  it('shows an empty state without conversations', async () => {
    mockedGetConversations.mockResolvedValue([])

    renderSidebar()

    expect(await screen.findByText('pages.aiAssistant.historyEmpty')).toBeInTheDocument()
  })

  it('collapses via the collapse button', async () => {
    const { props } = renderSidebar()

    fireEvent.click(await screen.findByLabelText('pages.aiAssistant.historyCollapseAria'))

    expect(props.onCollapsedChange).toHaveBeenCalledWith(true)
  })

  it('renders a narrow rail when collapsed and expands back', async () => {
    const { props } = renderSidebar({ collapsed: true })

    // No list, no search in the collapsed rail.
    expect(
      screen.queryByPlaceholderText('pages.aiAssistant.historySearchPlaceholder')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('conversation-item-42')).not.toBeInTheDocument()

    // New chat stays reachable from the rail.
    fireEvent.click(screen.getByLabelText('pages.aiAssistant.historyNewChat'))
    expect(props.onNewChat).toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('pages.aiAssistant.historyExpandAria'))
    expect(props.onCollapsedChange).toHaveBeenCalledWith(false)
  })

  it('renders a close button instead of collapse in drawer variant', async () => {
    const onClose = vi.fn()
    renderSidebar({ variant: 'drawer', onClose })

    await screen.findByTestId('conversation-item-42')
    expect(screen.queryByLabelText('pages.aiAssistant.historyCollapseAria')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('pages.aiAssistant.historyCloseAria'))
    expect(onClose).toHaveBeenCalled()
  })
})
