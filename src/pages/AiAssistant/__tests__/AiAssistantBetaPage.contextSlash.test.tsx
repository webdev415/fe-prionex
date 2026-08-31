/**
 * Кружок контекста (usage из done-кадра) и меню слеш-команд композера.
 * Харнес — как в AiAssistantBetaPage.hydration/expert тестах.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
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

import { sendChatMessage } from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

const typeAndSend = async (text: string) => {
  const input = screen.getByRole('textbox', {
    name: 'pages.aiAssistant.inputPlaceholder',
  })
  await userEvent.type(input, text)
  await userEvent.keyboard('{Enter}')
  return input
}

describe('AiAssistantBetaPage: кружок контекста и слеш-команды', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('после хода с usage появляется кружок с процентом; ход без usage его не затирает', async () => {
    mockedSendChatMessage.mockImplementation(async (_payload, callbacks) => {
      callbacks?.onDone?.({
        session_id: 'abc',
        usage: { input_tokens: 26_214, cache_read_input_tokens: 0 },
      })
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Готово',
        coverage_flag: null,
        tool_calls: [],
      }
    })
    renderPage()
    expect(screen.queryByTestId('context-usage-ring')).not.toBeInTheDocument()

    await typeAndSend('скільки обіцянок')

    const ring = await screen.findByTestId('context-usage-ring')
    expect(ring).toHaveTextContent('10%') // 26214 / 262144
    expect(ring.getAttribute('data-level')).toBe('ok')

    // Второй ход завершился done без usage (слеш-команда/уточнение) —
    // показание остаётся прежним.
    mockedSendChatMessage.mockImplementation(async (_payload, callbacks) => {
      callbacks?.onDone?.({ session_id: 'abc' })
      return {
        conversation_id: 1,
        message_id: 6,
        response: 'Сесія: abc',
        coverage_flag: null,
        tool_calls: [],
      }
    })
    await typeAndSend('ще питання')
    expect(screen.getByTestId('context-usage-ring')).toHaveTextContent('10%')
  })

  it('«/» открывает меню, стрелка и Enter подставляют команду, второй Enter отправляет', async () => {
    mockedSendChatMessage.mockResolvedValue({
      conversation_id: 1,
      message_id: 7,
      response: 'Сесія: abc — нова.',
      coverage_flag: null,
      tool_calls: [],
    })
    renderPage()
    const input = screen.getByRole('textbox', {
      name: 'pages.aiAssistant.inputPlaceholder',
    })

    await userEvent.type(input, '/')
    const menu = await screen.findByTestId('slash-command-menu')
    expect(menu).toBeInTheDocument()
    // Первая строка — /статус; Enter подставляет её, не отправляя сообщение.
    await userEvent.keyboard('{Enter}')
    expect(mockedSendChatMessage).not.toHaveBeenCalled()
    expect(input).toHaveValue('/статус')
    expect(screen.queryByTestId('slash-command-menu')).not.toBeInTheDocument()

    // Второй Enter — обычная отправка: команда уходит мозгу.
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    const [payload] = mockedSendChatMessage.mock.calls[0]
    expect(payload.message).toBe('/статус')
  })

  it('фильтр по префиксу и Escape; обычный текст меню не открывает', async () => {
    renderPage()
    const input = screen.getByRole('textbox', {
      name: 'pages.aiAssistant.inputPlaceholder',
    })

    await userEvent.type(input, '/по')
    const menu = await screen.findByTestId('slash-command-menu')
    expect(menu.textContent).toContain('/помощь')
    expect(menu.textContent).not.toContain('/статус')

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('slash-command-menu')).not.toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, 'довідка 24/7')
    expect(screen.queryByTestId('slash-command-menu')).not.toBeInTheDocument()
  })

  it('/новий — клиентская команда: чистит чат локально, в мозг не уходит', async () => {
    renderPage()
    const input = screen.getByRole('textbox', {
      name: 'pages.aiAssistant.inputPlaceholder',
    })

    await userEvent.type(input, '/новий')
    // Меню показывает единственную команду; Enter применяет её.
    await screen.findByTestId('slash-command-menu')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(input).toHaveValue(''))
    expect(mockedSendChatMessage).not.toHaveBeenCalled()
  })
})
