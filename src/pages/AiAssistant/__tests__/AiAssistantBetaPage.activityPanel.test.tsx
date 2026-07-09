import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import {
  DEFAULT_REASONING_PANEL_WIDTH,
  MAX_REASONING_PANEL_WIDTH,
  REASONING_PANEL_RESIZE_STEP,
} from '../reasoningPanelConfig'
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

/**
 * Панель раздумий больше НЕ выезжает автоматически — открываем её кликом по
 * плашке «Ход рассуждения». Узел плашки берём свежим (против flaky при
 * перерисовке во время стрима), клик — по вложенной кнопке-тоглу.
 */
async function openReasoningPanel() {
  const chip = await screen.findByTestId('assistant-reasoning')
  fireEvent.click(chip.querySelector('button') as HTMLButtonElement)
}

/** A settled turn that streamed reasoning + one tool step. */
function mockReasoningTurn() {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onReasoning?.('Проверяю таблицу платежей.')
      callbacks?.onToolStart?.({ name: 'sql_query', label: 'SQL' })
      callbacks?.onToolEnd?.({ tool_use_id: 't1', ok: true, result_preview: '12 строк' })
      callbacks?.onText?.('Готово')
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Готово',
        coverage_flag: null,
        tool_calls: [{ tool_name: 'sql_query', success: true }],
      }
    }
  )
}

describe('AiAssistantBetaPage — «Активность» side panel (Layer 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({
      userId: null,
      conversationId: null,
      settings: null,
      reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
    })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the side panel from the bubble chip and renders both sections', async () => {
    mockReasoningTurn()
    renderPage()
    send('подумай')

    // Settled → the chip is collapsed and the side panel window is not mounted.
    expect(await screen.findByText('Готово')).toBeInTheDocument()
    const chip = await screen.findByTestId('assistant-reasoning')
    const toggle = chip.querySelector('button') as HTMLButtonElement
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()

    // Chip is a toggle → opens the activity panel (steps + reasoning stream).
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const steps = await screen.findByTestId('assistant-tool-steps')
    expect(steps).toHaveTextContent('SQL')
    expect(steps).toHaveTextContent('12 строк')
    expect(screen.getByText('pages.aiAssistant.activityStepsSection')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.activityReasoningSection')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-reasoning-scroll')).toHaveTextContent(
      'Проверяю таблицу платежей.'
    )
  })

  it('closes the panel from the header crest', async () => {
    mockReasoningTurn()
    renderPage()
    send('подумай')
    await screen.findByText('Готово')

    const toggle = (await screen.findByTestId('assistant-reasoning')).querySelector(
      'button'
    ) as HTMLButtonElement
    fireEvent.click(toggle)
    expect(await screen.findByTestId('assistant-reasoning-scroll')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.activityClose' }))
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the panel on Escape', async () => {
    mockReasoningTurn()
    renderPage()
    send('подумай')
    await screen.findByText('Готово')

    const toggle = (await screen.findByTestId('assistant-reasoning')).querySelector(
      'button'
    ) as HTMLButtonElement
    fireEvent.click(toggle)
    expect(await screen.findByTestId('assistant-reasoning-scroll')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()
  })

  it('resizes and persists the panel width via the keyboard handle', async () => {
    // Keep the turn in flight so the panel is open (streaming) while we resize.
    let resolveTurn: (r: AssistantChatResponse) => void = () => {}
    mockedSendChatMessage.mockImplementation(
      (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
        callbacks?.onReasoning?.('Думаю…')
        return new Promise<AssistantChatResponse>((resolve) => {
          resolveTurn = resolve
        })
      }
    )

    renderPage()
    send('думай')
    // Панель не выезжает сама во время стрима — открываем её кликом по плашке,
    // чтобы получить доступ к ручке ресайза.
    await openReasoningPanel()
    await screen.findByTestId('assistant-reasoning-scroll')

    const handle = screen.getByRole('button', { name: 'pages.aiAssistant.activityResize' })
    expect(useAiAssistantStore.getState().reasoningPanelWidth).toBe(DEFAULT_REASONING_PANEL_WIDTH)

    // Arrow-Left widens (handle sits on the panel's left edge); commit persists.
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(useAiAssistantStore.getState().reasoningPanelWidth).toBe(
      DEFAULT_REASONING_PANEL_WIDTH + REASONING_PANEL_RESIZE_STEP
    )

    resolveTurn({
      conversation_id: 1,
      message_id: 5,
      response: 'Финал',
      coverage_flag: null,
      tool_calls: [],
    })
    await screen.findByText('Финал')
  })

  it('clamps the persisted width to the maximum bound', () => {
    useAiAssistantStore.getState().setReasoningPanelWidth(9999)
    expect(useAiAssistantStore.getState().reasoningPanelWidth).toBe(MAX_REASONING_PANEL_WIDTH)
  })
})
