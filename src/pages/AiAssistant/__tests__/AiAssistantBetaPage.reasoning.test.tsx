import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import type { AssistantChatResponse, SendChatMessageCallbacks } from '@/features/aiAssistant/api'
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

import { sendChatMessage } from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText('pages.aiAssistant.inputPlaceholder') as HTMLTextAreaElement
}

function send(text: string) {
  fireEvent.change(getTextarea(), { target: { value: text } })
  fireEvent.keyDown(getTextarea(), { key: 'Enter' })
}

function enableThinkingMode() {
  fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.modeThinking' }))
}

/**
 * Give a scroll node a non-zero scrollable geometry (jsdom has no layout): tall
 * content, short viewport, parked at the bottom by default. `scrollTop` is a
 * writable property so the auto-scroll assignment is observable.
 */
function stubScrollGeometry(
  node: HTMLElement,
  { scrollHeight = 1000, clientHeight = 200, scrollTop = 800 } = {}
) {
  Object.defineProperty(node, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => clientHeight })
  let current = scrollTop
  Object.defineProperty(node, 'scrollTop', {
    configurable: true,
    get: () => current,
    set: (value: number) => {
      current = value
    },
  })
  return {
    get scrollTop() {
      return current
    },
  }
}

describe('AiAssistantBetaPage reasoning UX (Grok-style thinking window)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps reasoning in a fixed-height, internally-scrolled box (does not stretch the chat)', async () => {
    let resolveTurn: (r: AssistantChatResponse) => void = () => {}
    mockedSendChatMessage.mockImplementation(
      (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onReasoning?.('Очень длинная мысль…')
        return new Promise<AssistantChatResponse>((resolve) => {
          resolveTurn = resolve
        })
      }
    )

    renderPage()
    send('думай долго')

    const scrollBox = await screen.findByTestId('assistant-reasoning-scroll')
    // The reasoning lives in its own bounded scroll window, not an unbounded
    // block that pushes the dialog down.
    expect(scrollBox.className).toMatch(/max-h-\[200px\]/)
    expect(scrollBox.className).toMatch(/overflow-y-auto/)

    resolveTurn({
      conversation_id: 1,
      message_id: 5,
      response: 'Финал',
      coverage_flag: null,
      tool_calls: [],
    })
    await screen.findByText('Финал')
  })

  it('auto-scrolls the reasoning box to the bottom on each new delta while streaming', async () => {
    let onReasoning: ((d: string) => void) | undefined
    let resolveTurn: (r: AssistantChatResponse) => void = () => {}
    mockedSendChatMessage.mockImplementation(
      (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        onReasoning = callbacks?.onReasoning
        onReasoning?.('Шаг 1. ')
        return new Promise<AssistantChatResponse>((resolve) => {
          resolveTurn = resolve
        })
      }
    )

    renderPage()
    send('думай')

    const scrollBox = await screen.findByTestId('assistant-reasoning-scroll')
    // Parked at the bottom — the stream should be "stuck".
    const geom = stubScrollGeometry(scrollBox, { scrollHeight: 1000, clientHeight: 200 })
    fireEvent.scroll(scrollBox)

    // A new reasoning delta arrives → the box is pinned to the latest line.
    onReasoning?.('Шаг 2.')
    await waitFor(() => expect(geom.scrollTop).toBe(1000))

    resolveTurn({
      conversation_id: 1,
      message_id: 5,
      response: 'Финал',
      coverage_flag: null,
      tool_calls: [],
    })
    await screen.findByText('Финал')
  })

  it('does not yank the box back to the bottom when the user has scrolled up to read', async () => {
    let onReasoning: ((d: string) => void) | undefined
    let resolveTurn: (r: AssistantChatResponse) => void = () => {}
    mockedSendChatMessage.mockImplementation(
      (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        onReasoning = callbacks?.onReasoning
        onReasoning?.('Начало. ')
        return new Promise<AssistantChatResponse>((resolve) => {
          resolveTurn = resolve
        })
      }
    )

    renderPage()
    send('думай')

    const scrollBox = await screen.findByTestId('assistant-reasoning-scroll')
    // User scrolled up (far from the bottom) → sticky must release.
    const geom = stubScrollGeometry(scrollBox, {
      scrollHeight: 1000,
      clientHeight: 200,
      scrollTop: 0,
    })
    fireEvent.scroll(scrollBox)

    // A new delta arrives, but the reading position is preserved (not 1000).
    onReasoning?.('Ещё мысль.')
    await screen.findByText(/Ещё мысль\./)
    expect(geom.scrollTop).toBe(0)

    resolveTurn({
      conversation_id: 1,
      message_id: 5,
      response: 'Финал',
      coverage_flag: null,
      tool_calls: [],
    })
    await screen.findByText('Финал')
  })

  it('collapses the panel into a thin header once the turn is done (no leftover wall of text)', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onReasoning?.('Размышления модели.')
        callbacks?.onText?.('Готово')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'Готово',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    send('подумай и ответь')

    expect(await screen.findByText('Готово')).toBeInTheDocument()
    const panel = await screen.findByTestId('assistant-reasoning')
    const toggle = panel.querySelector('button') as HTMLButtonElement
    // Settled → collapsed: header shows the resting title, the scroll box (and
    // its wall of text) is gone from the DOM until re-expanded.
    expect(toggle).toHaveTextContent('pages.aiAssistant.reasoningTitle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()

    // Re-expanding brings back the same fixed-height scroll window.
    fireEvent.click(toggle)
    const reopened = await screen.findByTestId('assistant-reasoning-scroll')
    expect(reopened).toHaveTextContent('Размышления модели.')
    expect(reopened.className).toMatch(/max-h-\[200px\]/)
  })
})

describe('AiAssistantBetaPage reasoning window opens instantly (thinking mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the reasoning window with a spinner + placeholder on submit, before any reasoning delta', async () => {
    // The turn stays in flight and never emits a reasoning delta.
    mockedSendChatMessage.mockImplementation(
      (_payload, _callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> =>
        new Promise<AssistantChatResponse>(() => {})
    )

    renderPage()
    enableThinkingMode()
    send('подумай как следует')

    // The fixed-height reasoning window is already mounted (placeholder phase),
    // even though no reasoning has streamed yet.
    const scrollBox = await screen.findByTestId('assistant-reasoning-scroll')
    expect(scrollBox.className).toMatch(/max-h-\[200px\]/)
    const placeholder = await screen.findByTestId('reasoning-placeholder')
    expect(placeholder).toHaveTextContent('pages.aiAssistant.reasoningAnalyzing')
    // The panel is auto-expanded with the streaming spinner in its header.
    const panel = screen.getByTestId('assistant-reasoning')
    expect(panel.querySelector('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('reasoning-spinner')).toBeInTheDocument()
    // Generic "думаю…" typing dots must not also show — the window is the
    // single live indicator for thinking mode.
    expect(screen.queryByText('pages.aiAssistant.assistantThinking')).not.toBeInTheDocument()
  })

  it('flows the first reasoning delta into the same window (placeholder gone, no duplicate box)', async () => {
    let onReasoning: ((d: string) => void) | undefined
    let resolveTurn: (r: AssistantChatResponse) => void = () => {}
    mockedSendChatMessage.mockImplementation(
      (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        onReasoning = callbacks?.onReasoning
        // No reasoning yet — window opens in the placeholder phase.
        return new Promise<AssistantChatResponse>((resolve) => {
          resolveTurn = resolve
        })
      }
    )

    renderPage()
    enableThinkingMode()
    send('думай молча, потом вслух')

    // Placeholder window first.
    const boxBefore = await screen.findByTestId('assistant-reasoning-scroll')
    expect(await screen.findByTestId('reasoning-placeholder')).toBeInTheDocument()

    // First delta lands → it fills the SAME box; placeholder is replaced by the
    // streamed reasoning, and there is still exactly one scroll window.
    onReasoning?.('Первая мысль.')
    await screen.findByText('Первая мысль.')
    expect(screen.queryByTestId('reasoning-placeholder')).not.toBeInTheDocument()
    const boxes = screen.getAllByTestId('assistant-reasoning-scroll')
    expect(boxes).toHaveLength(1)
    // Same persistent node — deltas flowed in seamlessly (no remount).
    expect(boxes[0]).toBe(boxBefore)
    expect(boxes[0]).toHaveTextContent('Первая мысль.')

    resolveTurn({
      conversation_id: 1,
      message_id: 5,
      response: 'Финал',
      coverage_flag: null,
      tool_calls: [],
    })
    await screen.findByText('Финал')
  })

  it('collapses the window after done when reasoning streamed (thinking mode)', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onReasoning?.('Поразмышлял.')
        callbacks?.onText?.('Ответ готов')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'Ответ готов',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    enableThinkingMode()
    send('подумай и ответь')

    expect(await screen.findByText('Ответ готов')).toBeInTheDocument()
    const panel = await screen.findByTestId('assistant-reasoning')
    const toggle = panel.querySelector('button') as HTMLButtonElement
    expect(toggle).toHaveTextContent('pages.aiAssistant.reasoningTitle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reasoning-placeholder')).not.toBeInTheDocument()
  })

  it('leaves no empty reasoning window if thinking finishes without any reasoning', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        // Thinking mode but the model answered without emitting reasoning.
        callbacks?.onText?.('Короткий ответ')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'Короткий ответ',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    enableThinkingMode()
    send('быстрый вопрос в thinking')

    expect(await screen.findByText('Короткий ответ')).toBeInTheDocument()
    // Placeholder window must not linger as an empty box once settled.
    expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reasoning-placeholder')).not.toBeInTheDocument()
  })

  it('does not open a reasoning window in fast mode when no reasoning streams', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onText?.('Быстрый ответ')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'Быстрый ответ',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    // Default mode is fast — no placeholder window must appear.
    send('быстрый вопрос')

    expect(await screen.findByText('Быстрый ответ')).toBeInTheDocument()
    expect(screen.queryByTestId('reasoning-placeholder')).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
  })
})
