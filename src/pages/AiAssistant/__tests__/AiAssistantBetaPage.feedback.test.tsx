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
    // clearAllMocks не снимает реализацию: отказ из одного теста не должен
    // протекать в следующий.
    mockedSendFeedback.mockResolvedValue(undefined)
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

/**
 * «Що не так?» под 👎 (fb28-feedback-comment, замер 28.09.2026): прокси и мозг
 * поле `comment` принимали, но интерфейс его не слал — в журнале мозга было
 * ноль комментариев, замечания операторов терялись.
 */
describe('AiAssistantBetaPage: комментарий к 👎', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedSendFeedback.mockResolvedValue(undefined)
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

  /** 👎 и ожидание, пока сервер его подтвердит: до этого «Надіслати» заперта. */
  async function dislike() {
    const notUseful = await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful')
    fireEvent.click(notUseful)
    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByTestId('feedback-comment-42').getAttribute('data-state')).toBe('open')
    )
  }

  /** Промис, которым тест управляет сам: POST «висит», пока его не отпустят. */
  function deferred() {
    let resolve!: () => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<void>((res, rej) => {
      resolve = () => res()
      reject = rej
    })
    return { promise, resolve, reject }
  }

  function commentInput() {
    return screen.getByLabelText('pages.aiAssistant.feedbackCommentLabel') as HTMLTextAreaElement
  }

  function button(key: string) {
    return screen.getByRole('button', { name: key }) as HTMLButtonElement
  }

  it('👎 открывает поле «Що не так?» под этим ответом', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')

    await dislike()

    expect(screen.getByTestId('feedback-comment-42')).toBeTruthy()
    expect(commentInput().placeholder).toBe('pages.aiAssistant.feedbackCommentPlaceholder')
    expect(button('pages.aiAssistant.feedbackCommentSubmit')).toBeTruthy()
    expect(button('pages.aiAssistant.feedbackCommentSkip')).toBeTruthy()
  })

  it('👍 поле не открывает', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')

    fireEvent.click(await screen.findByLabelText('pages.aiAssistant.feedbackUseful'))
    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(1))

    expect(screen.queryByTestId('feedback-comment-42')).toBeNull()
  })

  it('«Надіслати» повторно шлёт оценку с тем же rating и comment, затем «Дякуємо, передано»', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')
    await dislike()

    fireEvent.change(commentInput(), { target: { value: '  не той відділ, не та дата ' } })
    fireEvent.click(button('pages.aiAssistant.feedbackCommentSubmit'))

    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(2))
    expect(mockedSendFeedback).toHaveBeenLastCalledWith({
      message_id: 42,
      rating: 'not_useful',
      comment: 'не той відділ, не та дата',
    })

    const sent = await screen.findByTestId('feedback-comment-sent-42')
    expect(sent.textContent).toBe('pages.aiAssistant.feedbackCommentSent')
    // Отправлено — формы и кнопки повторной отправки больше нет.
    expect(screen.queryByTestId('feedback-comment-42')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'pages.aiAssistant.feedbackCommentSubmit' })
    ).toBeNull()
  })

  it('комментарий длиннее 500 символов уходит обрезанным до 500', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')
    await dislike()

    fireEvent.change(commentInput(), { target: { value: 'б'.repeat(700) } })
    expect(commentInput().value).toHaveLength(500)
    fireEvent.click(button('pages.aiAssistant.feedbackCommentSubmit'))

    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(2))
    expect(mockedSendFeedback).toHaveBeenLastCalledWith({
      message_id: 42,
      rating: 'not_useful',
      comment: 'б'.repeat(500),
    })
  })

  it('«Пропустити» закрывает поле и ничего не шлёт', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')
    await dislike()

    fireEvent.change(commentInput(), { target: { value: 'не всі клієнти' } })
    fireEvent.click(button('pages.aiAssistant.feedbackCommentSkip'))

    expect(screen.queryByTestId('feedback-comment-42')).toBeNull()
    expect(screen.queryByTestId('feedback-comment-sent-42')).toBeNull()
    expect(mockedSendFeedback).toHaveBeenCalledTimes(1)
  })

  it('отказ сервера на комментарий — свой тост, поле и текст остаются', async () => {
    answerWith(42)
    mockedSendFeedback.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    send('скільки боргу')
    await dislike()

    fireEvent.change(commentInput(), { target: { value: 'не той відділ' } })
    fireEvent.click(button('pages.aiAssistant.feedbackCommentSubmit'))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.feedbackCommentFailed')
    )
    await waitFor(() => expect(commentInput().readOnly).toBe(false))
    expect(commentInput().value).toBe('не той відділ')
    expect(screen.queryByTestId('feedback-comment-sent-42')).toBeNull()
  })

  it('откат самой оценки 👎 закрывает ОТКРЫТОЕ поле', async () => {
    answerWith(42)
    const rating = deferred()
    mockedSendFeedback.mockReturnValueOnce(rating.promise)
    renderPage()
    send('скільки боргу')

    fireEvent.click(await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful'))

    // Поле открыто, пока 👎 ещё едет, — иначе закрывать было бы нечего.
    expect(await screen.findByTestId('feedback-comment-42')).toBeTruthy()
    fireEvent.change(commentInput(), { target: { value: 'не та дата' } })

    rating.reject(new Error('boom'))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.feedbackFailed')
    )
    await waitFor(() => expect(screen.queryByTestId('feedback-comment-42')).toBeNull())
    // Комментарий к неподтверждённой оценке так и не ушёл.
    expect(mockedSendFeedback).toHaveBeenCalledTimes(1)
  })

  it('пока 👎 не подтверждён, писать можно, а «Надіслати» заперта', async () => {
    answerWith(42)
    const rating = deferred()
    mockedSendFeedback.mockReturnValueOnce(rating.promise)
    renderPage()
    send('скільки боргу')

    fireEvent.click(await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful'))
    const form = await screen.findByTestId('feedback-comment-42')
    expect(form.getAttribute('data-state')).toBe('pending')

    fireEvent.change(commentInput(), { target: { value: 'не той відділ' } })
    expect(commentInput().value).toBe('не той відділ')
    expect(button('pages.aiAssistant.feedbackCommentSubmit').disabled).toBe(true)

    rating.resolve()

    await waitFor(() =>
      expect(button('pages.aiAssistant.feedbackCommentSubmit').disabled).toBe(false)
    )
    expect(form.getAttribute('data-state')).toBe('open')
  })

  it('«Незрозуміло» после 👎 уходит и в теле комментария', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')
    await dislike()

    fireEvent.click(button('pages.aiAssistant.feedbackUnclear'))
    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(2))

    fireEvent.change(commentInput(), { target: { value: 'не всі клієнти' } })
    fireEvent.click(button('pages.aiAssistant.feedbackCommentSubmit'))

    await waitFor(() => expect(mockedSendFeedback).toHaveBeenCalledTimes(3))
    expect(mockedSendFeedback).toHaveBeenLastCalledWith({
      message_id: 42,
      rating: 'not_useful',
      comprehension: 'unclear',
      comment: 'не всі клієнти',
    })
  })

  it('открытое поле прокручивается в видимую область над панелью ввода', async () => {
    answerWith(42)
    renderPage()
    send('скільки боргу')

    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView)
    fireEvent.click(await screen.findByLabelText('pages.aiAssistant.feedbackNotUseful'))
    const form = await screen.findByTestId('feedback-comment-42')

    // Прокручивается именно форма и «ближайшим» способом — лента не уезжает
    // к началу ответа, форма лишь выходит из-под панели.
    const formCall = scrollIntoView.mock.contexts.findIndex((context) => context === form)
    expect(formCall).toBeGreaterThanOrEqual(0)
    expect(scrollIntoView.mock.calls[formCall]?.[0]).toEqual({
      block: 'nearest',
      behavior: 'smooth',
    })
  })
})
