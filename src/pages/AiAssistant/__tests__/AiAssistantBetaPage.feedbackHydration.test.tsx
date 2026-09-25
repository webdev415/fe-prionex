import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type {
  AssistantConversationDetail,
  AssistantConversationSummary,
  AssistantMessageFeedback,
} from '@/features/aiAssistant/api'
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

import { getConversation, getConversations, sendFeedback } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)
const mockedGetConversations = vi.mocked(getConversations)
const mockedSendFeedback = vi.mocked(sendFeedback)

function summary(id: number): AssistantConversationSummary {
  return {
    id,
    user_id: 7,
    project_id: 1,
    channel: 'web',
    status: 'active',
    title: null,
    pinned: false,
    archived: false,
    created_at: '2026-09-25T10:00:00Z',
    last_message_at: '2026-09-25T10:01:00Z',
  }
}

function conversation(
  feedback: AssistantConversationDetail['messages'][number]['feedback']
): AssistantConversationDetail {
  return {
    ...summary(42),
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
  }
}

/** Второй диалог — чтобы уйти из первого и вернуться в той же сессии. */
function otherConversation(): AssistantConversationDetail {
  return {
    ...summary(43),
    messages: [
      {
        id: 431,
        conversation_id: 43,
        role: 'assistant',
        content: 'Інший діалог',
        model: 'rosh',
        latency_ms: 900,
        tokens: 50,
        created_at: '2026-09-25T09:00:00Z',
        feedback: null,
      },
    ],
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...render(<AiAssistantBetaPage />, { wrapper }) }
}

/** Кнопки оценки ОДНОГО ответа — не все aria-pressed страницы (TTS, голос, сайдбар). */
function feedbackButtons(messageId: number) {
  const controls = within(screen.getByTestId(`message-feedback-${messageId}`))
  return {
    useful: controls.getByLabelText('pages.aiAssistant.feedbackUseful'),
    notUseful: controls.getByLabelText('pages.aiAssistant.feedbackNotUseful'),
    clear: controls.getByRole('button', { name: 'pages.aiAssistant.feedbackClear' }),
    unclear: controls.getByRole('button', { name: 'pages.aiAssistant.feedbackUnclear' }),
  }
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
      historySidebarCollapsed: false,
      reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
    })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    useAiAssistantStore.getState().setActiveConversation('7', 42)
  })

  it('saved 👍 and «clear» stay highlighted and locked after reload', async () => {
    mockedGetConversation.mockResolvedValue(
      conversation({ rating: 'useful', comprehension: 'clear' })
    )

    renderPage()
    await screen.findByText(/12 обещаний/)

    const { useful, notUseful, clear, unclear } = feedbackButtons(102)
    expect(useful).toHaveAttribute('aria-pressed', 'true')
    expect(notUseful).toHaveAttribute('aria-pressed', 'false')
    expect(clear).toHaveAttribute('aria-pressed', 'true')
    expect(unclear).toHaveAttribute('aria-pressed', 'false')
    // Обе пары заблокированы, как сразу после клика: вторую оценку не поставить.
    for (const button of [useful, notUseful, clear, unclear]) expect(button).toBeDisabled()
  })

  it('an answer without a saved mark shows grey, clickable buttons (control)', async () => {
    mockedGetConversation.mockResolvedValue(conversation(null))

    renderPage()
    await screen.findByText(/12 обещаний/)

    for (const button of Object.values(feedbackButtons(102))) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(button).toBeEnabled()
    }
  })

  it('one field saved: a click on the other pair sends both, the saved one survives', async () => {
    mockedGetConversation.mockResolvedValue(conversation({ rating: 'useful', comprehension: null }))

    renderPage()
    await screen.findByText(/12 обещаний/)

    const { useful, unclear } = feedbackButtons(102)
    expect(useful).toHaveAttribute('aria-pressed', 'true')
    expect(useful).toBeDisabled()
    expect(unclear).toBeEnabled()

    fireEvent.click(unclear)

    await waitFor(() =>
      expect(mockedSendFeedback).toHaveBeenCalledWith({
        message_id: 102,
        rating: 'useful',
        comprehension: 'unclear',
      })
    )
  })

  it('an unrecognised saved value locks its pair and is never sent back', async () => {
    mockedGetConversation.mockResolvedValue(conversation({ rating: 'meh', comprehension: null }))

    renderPage()
    await screen.findByText(/12 обещаний/)

    const { useful, notUseful, unclear } = feedbackButtons(102)
    // Не подсвечена (кнопки для значения нет), но заперта: клик не затрёт сохранённое.
    expect(useful).toHaveAttribute('aria-pressed', 'false')
    expect(useful).toBeDisabled()
    expect(notUseful).toBeDisabled()

    fireEvent.click(unclear)

    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(1))
    // Поле пропущено (не null): по контракту сервер оставляет его как было.
    expect(mockedSendFeedback.mock.calls[0]?.[0]).toStrictEqual({
      message_id: 102,
      comprehension: 'unclear',
    })
  })

  it('rate → switch conversation → come back: the mark stays shown and locked', async () => {
    // Сервер с памятью: что сохранил POST, то отдаёт GET.
    let saved: AssistantMessageFeedback | null = null
    mockedSendFeedback.mockImplementation(async (body) => {
      saved = {
        rating: body.rating ?? saved?.rating ?? null,
        comprehension: body.comprehension ?? saved?.comprehension ?? null,
      }
    })
    mockedGetConversation.mockImplementation(async (id: number) =>
      id === 42 ? conversation(saved) : otherConversation()
    )
    mockedGetConversations.mockResolvedValue([summary(42), summary(43)])

    const { queryClient } = renderPage()
    await screen.findByText(/12 обещаний/)

    fireEvent.click(feedbackButtons(102).useful)
    await waitFor(() =>
      expect(mockedSendFeedback).toHaveBeenCalledWith({ message_id: 102, rating: 'useful' })
    )
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))

    // Уходим в другой диалог и возвращаемся — в пределах staleTime кэша (30 с).
    fireEvent.click(await screen.findByTestId('conversation-item-43'))
    await screen.findByText('Інший діалог')
    fireEvent.click(await screen.findByTestId('conversation-item-42'))
    await screen.findByText(/12 обещаний/)

    const { useful, notUseful, unclear } = feedbackButtons(102)
    expect(useful).toHaveAttribute('aria-pressed', 'true')
    expect(useful).toBeDisabled()
    expect(notUseful).toBeDisabled()

    fireEvent.click(unclear)

    await waitFor(() =>
      expect(mockedSendFeedback).toHaveBeenLastCalledWith({
        message_id: 102,
        rating: 'useful',
        comprehension: 'unclear',
      })
    )
  })
})
