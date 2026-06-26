import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { AssistantChatStreamError } from '@/features/aiAssistant/api'
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

import { toast } from 'sonner'
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

describe('AiAssistantBetaPage SSE streaming render', () => {
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

  it('streams text deltas into the assistant bubble as they arrive', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onText?.('У вас ')
        callbacks?.onText?.('378K клиентов')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'У вас 378K клиентов',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    send('сколько клиентов?')

    // The streamed answer is composed from the deltas.
    expect(await screen.findByText('У вас 378K клиентов')).toBeInTheDocument()
  })

  it('renders the sources block (tables + tools) streamed after the answer', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onText?.('Ответ готов')
        callbacks?.onSources?.({
          tables: ['client_db.payments', 'client_db.debts'],
          tools: ['sql_query'],
        })
        return {
          conversation_id: 1,
          message_id: 0,
          response: 'Ответ готов',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    send('дай отчёт')

    const block = await screen.findByTestId('assistant-sources')
    expect(block).toHaveTextContent('client_db.payments')
    expect(block).toHaveTextContent('client_db.debts')
    expect(block).toHaveTextContent('sql_query')
  })

  it('renders clickable follow-up chips and sends the chip text on click', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onText?.('Готово')
        callbacks?.onFollowups?.(['Показать за месяц'])
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
    send('первый вопрос')

    const chips = await screen.findByTestId('assistant-followups')
    const chip = chips.querySelector('button') as HTMLButtonElement
    expect(chip).toHaveTextContent('Показать за месяц')

    fireEvent.click(chip)

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(2))
    expect(mockedSendChatMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'Показать за месяц' }),
      expect.anything()
    )
  })

  it('accumulates reasoning deltas into a collapsible "Ход рассуждения" panel', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onReasoning?.('Сначала проверю ')
        callbacks?.onReasoning?.('таблицу платежей.')
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
    send('подумай')

    // The answer renders…
    expect(await screen.findByText('Готово')).toBeInTheDocument()
    // …and the reasoning panel exists, collapsed (re-expandable) once settled.
    const panel = await screen.findByTestId('assistant-reasoning')
    const toggle = panel.querySelector('button') as HTMLButtonElement
    expect(toggle).toHaveTextContent('pages.aiAssistant.reasoningTitle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    // Expanding it reveals the accumulated reasoning text.
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveTextContent('Сначала проверю таблицу платежей.')
  })

  it('shows live reasoning (auto-expanded + spinner) while the turn is streaming', async () => {
    // Defer resolution so the turn stays "in flight" during the assertion.
    let resolveTurn: (r: AssistantChatResponse) => void = () => {}
    mockedSendChatMessage.mockImplementation(
      (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onReasoning?.('Думаю вслух…')
        return new Promise<AssistantChatResponse>((resolve) => {
          resolveTurn = resolve
        })
      }
    )

    renderPage()
    send('думай')

    // While streaming: the panel is open and shows the live reasoning + spinner.
    const reasoning = await screen.findByText('Думаю вслух…')
    expect(reasoning).toBeInTheDocument()
    const panel = screen.getByTestId('assistant-reasoning')
    expect(panel.querySelector('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('reasoning-spinner')).toBeInTheDocument()

    // Settle the turn so no act() warning leaks.
    resolveTurn({
      conversation_id: 1,
      message_id: 5,
      response: 'Финал',
      coverage_flag: null,
      tool_calls: [],
    })
    await screen.findByText('Финал')
  })

  it('renders tool steps with a success result preview (tool_start → tool_end ok)', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onToolStart?.({ name: 'sql_query', label: 'SQL' })
        callbacks?.onToolEnd?.({ tool_use_id: 't1', ok: true, result_preview: '12 строк' })
        callbacks?.onText?.('Ответ')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'Ответ',
          coverage_flag: null,
          tool_calls: [{ tool_name: 'sql_query', success: true }],
        }
      }
    )

    renderPage()
    send('запусти инструмент')

    const panel = await screen.findByTestId('assistant-reasoning')
    fireEvent.click(panel.querySelector('button') as HTMLButtonElement)
    const steps = await screen.findByTestId('assistant-tool-steps')
    expect(steps).toHaveTextContent('SQL')
    expect(steps).toHaveTextContent('12 строк')
  })

  it('marks a failed tool step (tool_end ok=false) without breaking the answer', async () => {
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onToolStart?.({ name: 'sql_query', label: 'SQL' })
        callbacks?.onToolEnd?.({ tool_use_id: 't1', ok: false, result_preview: 'timeout' })
        callbacks?.onText?.('Частичный ответ')
        return {
          conversation_id: 1,
          message_id: 5,
          response: 'Частичный ответ',
          coverage_flag: null,
          tool_calls: [{ tool_name: 'sql_query', success: false }],
        }
      }
    )

    renderPage()
    send('сломайся')

    // The answer still renders even though a tool failed.
    expect(await screen.findByText('Частичный ответ')).toBeInTheDocument()
    const panel = await screen.findByTestId('assistant-reasoning')
    fireEvent.click(panel.querySelector('button') as HTMLButtonElement)
    expect(screen.getByTestId('assistant-tool-steps')).toHaveTextContent('timeout')
  })

  it('keeps the generic typing dots when no reasoning/tool events stream (fast mode)', async () => {
    // A turn with only a text answer must not show the reasoning panel.
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
    send('быстрый вопрос')

    expect(await screen.findByText('Быстрый ответ')).toBeInTheDocument()
    expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
  })

  it('shows an error toast and inline error when the stream errors', async () => {
    mockedSendChatMessage.mockRejectedValueOnce(new AssistantChatStreamError({ message: 'boom' }))

    renderPage()
    send('падение')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.apiError'))
    expect(await screen.findByText('pages.aiAssistant.apiError')).toBeInTheDocument()
  })

  it('falls back to fast mode when the thinking stream errors in-band with 503', async () => {
    // First call (thinking) errors with an in-band 503; the next call must be fast.
    mockedSendChatMessage.mockRejectedValueOnce(
      new AssistantChatStreamError({ status: 503, message: 'thinking busy' })
    )
    mockedSendChatMessage.mockImplementation(
      async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onText?.('ok')
        return {
          conversation_id: 1,
          message_id: 6,
          response: 'ok',
          coverage_flag: null,
          tool_calls: [],
        }
      }
    )

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.modeThinking' }))

    send('глубокий вопрос')
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.thinkingUnavailable')
    )

    send('ещё раз')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(2))
    expect(mockedSendChatMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'ещё раз', mode: 'fast' }),
      expect.anything()
    )
  })
})
