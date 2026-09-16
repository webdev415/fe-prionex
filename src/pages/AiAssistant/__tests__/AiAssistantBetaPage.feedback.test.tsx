/**
 * Оценка ответа оператором — кнопки «корисно / не корисно» и «зрозуміло».
 *
 * Дефект, ради которого написаны эти тесты (замер прода 11.09.2026): строка оценки
 * рисовалась ТОЛЬКО при известном серверном id сообщения, а потоковый ход его не
 * получал вовсе. Кнопок не было, оператор не видел ни оценки, ни причины, и в бою
 * за 23 дня хранения Loki не ушло ни одного запроса `feedback` при 34 ходах.
 */
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

import { toast } from 'sonner'
import { sendChatMessage, sendFeedback } from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)
const mockedSendFeedback = vi.mocked(sendFeedback)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

function send(text: string) {
  const textarea = screen.getByLabelText(
    'pages.aiAssistant.inputPlaceholder'
  ) as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: text } })
  fireEvent.keyDown(textarea, { key: 'Enter' })
}

/** Ход, который вернул (или не вернул) серверный id сообщения. */
function answerWith(messageId: number) {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onText?.('Відповідь')
      return {
        conversation_id: 7,
        message_id: messageId,
        response: 'Відповідь',
        coverage_flag: null,
        tool_calls: [],
      }
    }
  )
}

describe('AiAssistantBetaPage: оценка ответа', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('шлёт оценку сразу после хода, не дожидаясь перезагрузки диалога', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')

    const notUseful = await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful')
    fireEvent.click(notUseful)

    await waitFor(() =>
      expect(mockedSendFeedback).toHaveBeenCalledWith({
        message_id: 42,
        rating: 'not_useful',
      })
    )
  })

  it('без серверного id кнопка ВИДНА и вслух говорит, что оценка не ушла', async () => {
    // message_id === 0 — «неизвестен»: прокси не прислал `persisted`.
    answerWith(0)
    renderPage()
    send('скільки боргу')

    const notUseful = await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful')
    fireEvent.click(notUseful)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.feedbackUnavailable')
    )
    expect(mockedSendFeedback).not.toHaveBeenCalled()
  })

  it('отказ сервера показывает СВОЙ текст и снимает подсветку', async () => {
    answerWith(42)
    mockedSendFeedback.mockRejectedValue(new Error('boom'))
    renderPage()
    send('скільки боргу')

    const notUseful = await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful')
    fireEvent.click(notUseful)

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.feedbackFailed')
    )
    // Откат: кнопка снова доступна, а не заперта неправдой про сохранённую оценку.
    await waitFor(() =>
      expect(
        (screen.getByLabelText('pages.aiAssistant.feedbackNotUseful') as HTMLButtonElement).disabled
      ).toBe(false)
    )
  })
})
