/**
 * ConversationSidebar — третий режим панели «Персоналізація».
 *
 * Проверяется именно переключение режимов: память открывается из подвала рядом
 * с архивом, список чатов при этом не подгружается, а возврат «до чатів»
 * восстанавливает исходный вид. Содержимое самой панели покрыто в
 * MemoryPanel.test.tsx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { ConversationSidebar } from '../ConversationSidebar'
import type { AssistantConversationSummary, AssistantMemoryItem } from '@/features/aiAssistant/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    getConversation: vi.fn(),
    getConversations: vi.fn(),
    updateConversation: vi.fn(),
    getMemoryItems: vi.fn(),
    createMemoryItem: vi.fn(),
    deleteMemoryItem: vi.fn(),
  }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { getConversations, getMemoryItems } from '@/features/aiAssistant/api'

const mockedGetConversations = vi.mocked(getConversations)
const mockedGetMemoryItems = vi.mocked(getMemoryItems)

const CONVERSATION: AssistantConversationSummary = {
  id: 41,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: 'Платежи за месяц',
  pinned: false,
  archived: false,
  created_at: new Date().toISOString(),
  last_message_at: new Date().toISOString(),
}

const MEMORY_ITEM: AssistantMemoryItem = {
  id: 5,
  kind: 'note',
  title: 'Портфель Alfa',
  content: 'Веду портфель Alfa',
  source: 'user',
  created_at: '2026-08-01T10:00:00Z',
}

function renderSidebar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(
    <ConversationSidebar
      activeConversationId={null}
      onSelectConversation={vi.fn()}
      onNewChat={vi.fn()}
      collapsed={false}
      onCollapsedChange={vi.fn()}
    />,
    { wrapper }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedGetConversations.mockResolvedValue([CONVERSATION])
  mockedGetMemoryItems.mockResolvedValue({ items: [MEMORY_ITEM], total: 1 })
})

describe('ConversationSidebar — «Персоналізація»', () => {
  it('opens the memory panel from the footer and comes back to the chats', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    const callsBeforeMemory = mockedGetConversations.mock.calls.length

    await user.click(screen.getByTestId('memory-toggle'))

    expect(await screen.findByTestId('memory-item-5')).toBeInTheDocument()
    expect(screen.queryByTestId('conversation-item-41')).not.toBeInTheDocument()
    expect(screen.getByTestId('memory-toggle')).toHaveAttribute('aria-pressed', 'true')
    // Список чатов в этом режиме не нужен — запрос выключен, а не повторён.
    expect(mockedGetConversations.mock.calls.length).toBe(callsBeforeMemory)

    await user.click(screen.getByTestId('memory-back'))

    expect(await screen.findByTestId('conversation-item-41')).toBeInTheDocument()
    expect(screen.queryByTestId('memory-item-5')).not.toBeInTheDocument()
    expect(screen.getByTestId('memory-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the archive a separate mode', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await user.click(screen.getByTestId('memory-toggle'))
    await screen.findByTestId('memory-item-5')

    await user.click(screen.getByTestId('archive-toggle'))

    await waitFor(() =>
      expect(mockedGetConversations).toHaveBeenCalledWith(
        expect.objectContaining({ archived: true })
      )
    )
    expect(screen.queryByTestId('memory-item-5')).not.toBeInTheDocument()
    expect(screen.getByTestId('archive-toggle')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('memory-toggle')).toHaveAttribute('aria-pressed', 'false')
  })
})
