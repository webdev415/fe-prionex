/**
 * ConversationSidebar — per-item actions (sidebar v2).
 *
 * Covers the hover kebab / right-click context menu and the PATCH-backed
 * actions behind it: pin/unpin (with optimistic regrouping), inline rename
 * (happy path, ≤120 validation, Escape cancel, error rollback + toast) and
 * archive / restore including the footer toggle between the active and
 * archived lists. The "archive the open dialog" path must close it via
 * onNewChat.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ConversationSidebar } from '../ConversationSidebar'
import type {
  AssistantConversationsFilters,
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
    updateConversation: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { getConversations, updateConversation } from '@/features/aiAssistant/api'
import { toast } from 'sonner'

const mockedGetConversations = vi.mocked(getConversations)
const mockedUpdateConversation = vi.mocked(updateConversation)
const mockedToastError = vi.mocked(toast.error)

// Radix DropdownMenu relies on pointer-capture APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const DAY = 24 * 60 * 60 * 1000

function summary(
  id: number,
  extra: Partial<AssistantConversationSummary> = {}
): AssistantConversationSummary {
  return {
    id,
    user_id: 7,
    project_id: 1,
    channel: 'web',
    status: 'active',
    title: null,
    pinned: false,
    archived: false,
    created_at: new Date(Date.now() - 10 * DAY).toISOString(),
    last_message_at: new Date().toISOString(),
    ...extra,
  }
}

const ACTIVE_LIST = [summary(41, { title: 'Платежи за месяц' }), summary(42)]
const ARCHIVED_LIST = [summary(90, { title: 'Старый разбор', archived: true })]

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

/** Right-click the conversation row and wait for the context menu. */
async function openContextMenu(id: number, expectedItemKey: string) {
  fireEvent.contextMenu(screen.getByTestId(`conversation-item-${id}`))
  await waitFor(() => expect(screen.getByText(expectedItemKey)).toBeInTheDocument())
}

/** Click the hover kebab and wait for the dropdown menu. */
async function openKebabMenu(id: number, expectedItemKey: string) {
  await screen.findByTestId(`conversation-item-${id}`)
  const kebab = screen.getByTestId(`conversation-menu-${id}`)
  // Radix DropdownMenuTrigger listens for pointer events; a bare click is flaky in jsdom.
  fireEvent.pointerDown(kebab, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.pointerUp(kebab, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
  fireEvent.click(kebab)
  await waitFor(() => expect(screen.getByText(expectedItemKey)).toBeInTheDocument())
}

describe('ConversationSidebar — item actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGetConversations.mockImplementation((filters?: AssistantConversationsFilters) =>
      Promise.resolve(filters?.archived ? ARCHIVED_LIST : ACTIVE_LIST)
    )
    // Keep the PATCH pending by default so optimistic state stays observable
    // (a settled mutation invalidates and refetches the untouched list mock).
    mockedUpdateConversation.mockImplementation(() => new Promise(() => {}))
  })

  it('opens the menu from the kebab button', async () => {
    renderSidebar()

    await openKebabMenu(41, 'pages.aiAssistant.historyPin')

    expect(screen.getByText('pages.aiAssistant.historyRename')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.historyArchiveAction')).toBeInTheDocument()
  })

  it('pins a conversation via the context menu with an optimistic top group', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyPin')
    await user.click(screen.getByText('pages.aiAssistant.historyPin'))

    expect(mockedUpdateConversation).toHaveBeenCalledWith(41, { pinned: true })
    // Optimistic update regroups the item under "Pinned" before the response.
    expect(await screen.findByText('pages.aiAssistant.historyPinned')).toBeInTheDocument()
  })

  it('unpins a pinned conversation', async () => {
    mockedGetConversations.mockResolvedValue([summary(41, { pinned: true }), summary(42)])
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByText('pages.aiAssistant.historyPinned')
    await openContextMenu(41, 'pages.aiAssistant.historyUnpin')
    await user.click(screen.getByText('pages.aiAssistant.historyUnpin'))

    expect(mockedUpdateConversation).toHaveBeenCalledWith(41, { pinned: false })
    await waitFor(() =>
      expect(screen.queryByText('pages.aiAssistant.historyPinned')).not.toBeInTheDocument()
    )
  })

  it('renames a conversation inline (Enter commits, optimistic title)', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyRename')
    await user.click(screen.getByText('pages.aiAssistant.historyRename'))

    const input = await screen.findByTestId('conversation-rename-input')
    expect(input).toHaveValue('Платежи за месяц')

    fireEvent.change(input, { target: { value: '  Просрочка 90+  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(mockedUpdateConversation).toHaveBeenCalledWith(41, { title: 'Просрочка 90+' })
    )
    // The input closes and the optimistic title is visible immediately.
    expect(screen.queryByTestId('conversation-rename-input')).not.toBeInTheDocument()
    expect(await screen.findByText('Просрочка 90+')).toBeInTheDocument()
  })

  it('seeds the rename input with the title as shown, without the dock context block', async () => {
    // A chat auto-titled from a dock turn carries the page-context envelope in
    // its stored title; the operator edits what they see, not the machine text.
    mockedGetConversations.mockResolvedValue([
      summary(43, { title: 'Що йому запропонувати? <дані-сторінки джерело=ненадій' }),
    ])
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-43')
    await openContextMenu(43, 'pages.aiAssistant.historyRename')
    await user.click(screen.getByText('pages.aiAssistant.historyRename'))

    expect(await screen.findByTestId('conversation-rename-input')).toHaveValue(
      'Що йому запропонувати?'
    )
  })

  it('blocks renaming beyond 120 characters and shows a validation hint', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyRename')
    await user.click(screen.getByText('pages.aiAssistant.historyRename'))

    const input = await screen.findByTestId('conversation-rename-input')
    fireEvent.change(input, { target: { value: 'x'.repeat(121) } })

    expect(screen.getByText('pages.aiAssistant.historyRenameTooLong')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockedUpdateConversation).not.toHaveBeenCalled()
    // The editor stays open so the user can shorten the name.
    expect(screen.getByTestId('conversation-rename-input')).toBeInTheDocument()
  })

  it('cancels renaming on Escape without a PATCH', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyRename')
    await user.click(screen.getByText('pages.aiAssistant.historyRename'))

    const input = await screen.findByTestId('conversation-rename-input')
    fireEvent.change(input, { target: { value: 'Черновик' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(mockedUpdateConversation).not.toHaveBeenCalled()
    expect(screen.queryByTestId('conversation-rename-input')).not.toBeInTheDocument()
    expect(screen.getByText('Платежи за месяц')).toBeInTheDocument()
  })

  it('rolls the title back and toasts when the rename PATCH fails', async () => {
    mockedUpdateConversation.mockRejectedValue(new Error('422'))
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyRename')
    await user.click(screen.getByText('pages.aiAssistant.historyRename'))

    const input = await screen.findByTestId('conversation-rename-input')
    fireEvent.change(input, { target: { value: 'Сломанное имя' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(mockedToastError).toHaveBeenCalled())
    // Rollback restores the previous title.
    await waitFor(() => expect(screen.getByText('Платежи за месяц')).toBeInTheDocument())
    expect(screen.queryByText('Сломанное имя')).not.toBeInTheDocument()
  })

  it('archives a conversation and removes it from the list optimistically', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyArchiveAction')
    await user.click(screen.getByText('pages.aiAssistant.historyArchiveAction'))

    expect(mockedUpdateConversation).toHaveBeenCalledWith(41, { archived: true })
    await waitFor(() =>
      expect(screen.queryByTestId('conversation-item-41')).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('conversation-item-42')).toBeInTheDocument()
  })

  it('closes the open dialog (new chat) when it gets archived', async () => {
    const user = userEvent.setup()
    const { props } = renderSidebar({ activeConversationId: 41 })

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyArchiveAction')
    await user.click(screen.getByText('pages.aiAssistant.historyArchiveAction'))

    expect(props.onNewChat).toHaveBeenCalled()
  })

  it('does not start a new chat when archiving a background conversation', async () => {
    const user = userEvent.setup()
    const { props } = renderSidebar({ activeConversationId: 42 })

    await screen.findByTestId('conversation-item-41')
    await openContextMenu(41, 'pages.aiAssistant.historyArchiveAction')
    await user.click(screen.getByText('pages.aiAssistant.historyArchiveAction'))

    expect(props.onNewChat).not.toHaveBeenCalled()
  })

  it('switches to the archived list and back via the footer toggle', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await user.click(screen.getByTestId('archive-toggle'))

    // Archived list is a separate request with archived=true.
    expect(await screen.findByTestId('conversation-item-90')).toBeInTheDocument()
    expect(mockedGetConversations).toHaveBeenCalledWith(expect.objectContaining({ archived: true }))
    expect(screen.queryByTestId('conversation-item-41')).not.toBeInTheDocument()
    // The mode is highlighted and offers an explicit way back.
    expect(screen.getByTestId('archive-toggle')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByTestId('archive-back'))
    expect(await screen.findByTestId('conversation-item-41')).toBeInTheDocument()
    expect(screen.queryByTestId('conversation-item-90')).not.toBeInTheDocument()
  })

  it('restores a conversation from the archive', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await screen.findByTestId('conversation-item-41')
    await user.click(screen.getByTestId('archive-toggle'))
    await screen.findByTestId('conversation-item-90')

    await openContextMenu(90, 'pages.aiAssistant.historyUnarchiveAction')
    // Pinning is not offered inside the archive view.
    expect(screen.queryByText('pages.aiAssistant.historyPin')).not.toBeInTheDocument()
    await user.click(screen.getByText('pages.aiAssistant.historyUnarchiveAction'))

    expect(mockedUpdateConversation).toHaveBeenCalledWith(90, { archived: false })
    await waitFor(() =>
      expect(screen.queryByTestId('conversation-item-90')).not.toBeInTheDocument()
    )
  })
})
