/**
 * Экспертный режим в окне ассистента: кто его видит, что уходит на бэкенд,
 * что показывается после ответа и что — вместо ответа при отказе.
 *
 * Тексты сравниваются по ключам i18n (в тестах `t` возвращает ключ), кроме
 * отказов: там на экран обязан попасть текст сервера, а не наш ключ.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_ASSISTANT_SETTINGS, useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import type { AssistantCapabilities } from '@/features/aiAssistant/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    getAssistantCapabilities: vi.fn(),
    getConversation: vi.fn(),
    getConversations: vi.fn().mockResolvedValue([]),
    sendChatMessage: vi.fn(),
    sendFeedback: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import {
  AssistantChatStreamError,
  getAssistantCapabilities,
  sendChatMessage,
} from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)
const mockedGetCapabilities = vi.mocked(getAssistantCapabilities)

/** Capabilities разрешают экспертный режим с двумя моделями и бюджетом $5. */
function allowedCapabilities(
  overrides: Partial<AssistantCapabilities['expert']> = {}
): AssistantCapabilities {
  return {
    expert: {
      enabled: true,
      allowed: true,
      models: ['claude-sonnet-5', 'claude-opus-5'],
      dailyLimitUsd: 5,
      spentTodayUsd: 1.2,
      reason: null,
      reasonCode: null,
      ...overrides,
    },
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { ...render(<AiAssistantBetaPage />, { wrapper }), queryClient }
}

/**
 * Дождаться, пока запрос capabilities ОТВЕТИТ.
 *
 * Без этого «пункта нет» доказывает лишь то, что ответ ещё не пришёл: пока
 * запрос висит, экспертной секции нет при любых правах, и тест на скрытие
 * проходил бы даже с выломанной проверкой доступа (проверено мутацией).
 */
async function waitForCapabilitiesSettled(queryClient: QueryClient) {
  await waitFor(() => {
    const state = queryClient.getQueryState(['aiAssistantCapabilities'])
    expect(state?.status === 'success' || state?.status === 'error').toBe(true)
  })
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText('pages.aiAssistant.inputPlaceholder') as HTMLTextAreaElement
}

function openModeMenu(): HTMLElement {
  fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
  return screen.getByTestId('assistant-mode-menu')
}

/** Открыть меню и выбрать экспертную модель. */
async function selectExpertModel(model: string) {
  const menu = openModeMenu()
  const option = await within(menu).findByTestId(`assistant-expert-model-${model}`)
  fireEvent.click(option)
}

function send(text: string) {
  fireEvent.change(getTextarea(), { target: { value: text } })
  fireEvent.keyDown(getTextarea(), { key: 'Enter' })
}

describe('AiAssistantBetaPage expert (Claude) mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    mockedGetCapabilities.mockResolvedValue(allowedCapabilities())
    mockedSendChatMessage.mockResolvedValue({
      conversation_id: 1,
      message_id: 5,
      response: 'Готово',
      coverage_flag: null,
      tool_calls: [],
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('offers the expert models and the remaining daily budget to an allowed user', async () => {
    renderPage()
    const menu = openModeMenu()

    expect(await within(menu).findByTestId('assistant-expert-section')).toBeInTheDocument()
    expect(within(menu).getByTestId('assistant-expert-model-claude-sonnet-5')).toBeInTheDocument()
    expect(within(menu).getByTestId('assistant-expert-model-claude-opus-5')).toBeInTheDocument()
    // Куда уходит запрос — рядом с выбором, а не в мелком шрифте настроек.
    expect(within(menu).getByTestId('assistant-expert-external')).toBeInTheDocument()
    expect(within(menu).getByTestId('assistant-expert-budget')).toBeInTheDocument()
  })

  it('keeps the entry visible with the reason when the daily budget is spent', async () => {
    // Прятать пункт при исчерпанном лимите нельзя: он молча исчез бы у
    // руководителя вместо честного «ліміт вичерпано».
    mockedGetCapabilities.mockResolvedValue(
      allowedCapabilities({
        allowed: false,
        reasonCode: 'limit',
        reason: 'денний ліміт витрат вичерпано (5.00 з 5.00 $)',
        spentTodayUsd: 5,
      })
    )
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    const menu = openModeMenu()
    expect(within(menu).getByTestId('assistant-expert-section')).toBeInTheDocument()
    expect(within(menu).getByTestId('assistant-expert-reason')).toHaveTextContent(
      'денний ліміт витрат вичерпано (5.00 з 5.00 $)'
    )
    // Видно, но выбрать нельзя — ход упёрся бы в 429.
    const option = within(menu).getByTestId('assistant-expert-model-claude-sonnet-5')
    expect(option).toBeDisabled()

    fireEvent.click(option)
    send('вопрос')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ expert: undefined }),
      expect.anything()
    )
  })

  it('keeps the entry visible when spend accounting is unavailable', async () => {
    mockedGetCapabilities.mockResolvedValue(
      allowedCapabilities({
        allowed: false,
        reasonCode: 'unavailable',
        reason: 'експертний режим тимчасово недоступний',
      })
    )
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    const menu = openModeMenu()
    expect(within(menu).getByTestId('assistant-expert-section')).toBeInTheDocument()
    expect(within(menu).getByTestId('assistant-expert-reason')).toBeInTheDocument()
  })

  it('hides the entry on an unfamiliar reason code instead of guessing', async () => {
    // Незнакомый код — прячем: показать пункт, смысла которого мы не понимаем,
    // хуже, чем не показать.
    mockedGetCapabilities.mockResolvedValue(
      allowedCapabilities({ allowed: false, reasonCode: 'quantum_flux', reason: 'щось нове' })
    )
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    expect(within(openModeMenu()).queryByTestId('assistant-expert-section')).not.toBeInTheDocument()
  })

  it('hides the expert entry from a user the backend does not allow (an operator)', async () => {
    mockedGetCapabilities.mockResolvedValue(
      allowedCapabilities({
        allowed: false,
        reasonCode: 'role',
        reason: 'експертний режим недоступний для вашої ролі',
      })
    )
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    const menu = openModeMenu()
    expect(within(menu).queryByTestId('assistant-expert-section')).not.toBeInTheDocument()
    // Обычные режимы на месте — скрыт только экспертный пункт.
    expect(within(menu).getByText('pages.aiAssistant.modeThinkingShort')).toBeInTheDocument()
  })

  it('hides the expert entry when the mode is switched off backend-side', async () => {
    mockedGetCapabilities.mockResolvedValue(allowedCapabilities({ enabled: false }))
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    expect(within(openModeMenu()).queryByTestId('assistant-expert-section')).not.toBeInTheDocument()
  })

  it('hides the expert entry when the backend offers no models', async () => {
    mockedGetCapabilities.mockResolvedValue(allowedCapabilities({ models: [] }))
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    expect(within(openModeMenu()).queryByTestId('assistant-expert-section')).not.toBeInTheDocument()
  })

  it('keeps the page usable when the capabilities call fails', async () => {
    mockedGetCapabilities.mockRejectedValue(new Error('network'))
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    expect(within(openModeMenu()).queryByTestId('assistant-expert-section')).not.toBeInTheDocument()
    send('привет')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ expert: undefined }),
      expect.anything()
    )
  })

  it('sends the picked model in the chat payload and marks the outgoing turn as external', async () => {
    renderPage()
    await selectExpertModel('claude-sonnet-5')

    // До отправки видно, что вопрос уйдёт наружу.
    expect(screen.getByTestId('assistant-expert-external-notice')).toBeInTheDocument()

    send('разбери падение сборов')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ expert: { model: 'claude-sonnet-5' } }),
      expect.anything()
    )
  })

  it('drops the expert block again once an ordinary mode is picked', async () => {
    renderPage()
    await selectExpertModel('claude-opus-5')

    const menu = openModeMenu()
    fireEvent.click(within(menu).getByText('pages.aiAssistant.modeThinkingShort'))

    expect(screen.queryByTestId('assistant-expert-external-notice')).not.toBeInTheDocument()
    send('обычный вопрос')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ expert: undefined, mode: 'thinking' }),
      expect.anything()
    )
  })

  it('hides the reasoning toggle while the turn is expert', async () => {
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    // В «Думаючому» тумблер раздумий на месте…
    fireEvent.click(within(openModeMenu()).getByText('pages.aiAssistant.modeThinkingShort'))
    expect(within(openModeMenu()).getByTestId('assistant-show-reasoning-row')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('assistant-mode-trigger'))

    // …а экспертный ход уходит во внешний Claude — прятать нечего.
    await selectExpertModel('claude-sonnet-5')
    expect(
      within(openModeMenu()).queryByTestId('assistant-show-reasoning-row')
    ).not.toBeInTheDocument()
  })

  it('hides the reasoning toggle for a stored thinking+expert combination', async () => {
    // Выбор экспертной модели через меню сбрасывает режим в fast, но пара
    // «думаючий + експерт» может прийти из localStorage прошлой сессии.
    useAiAssistantStore.setState({
      userId: '7',
      conversationId: null,
      settings: { ...DEFAULT_ASSISTANT_SETTINGS, mode: 'thinking', expertModel: 'claude-opus-5' },
    })
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    const menu = openModeMenu()
    expect(within(menu).getByTestId('assistant-expert-section')).toBeInTheDocument()
    expect(within(menu).queryByTestId('assistant-show-reasoning-row')).not.toBeInTheDocument()
  })

  it('ignores a stored expert model once the backend stops allowing the mode', async () => {
    // Право снято, но выбор ещё лежит в localStorage прошлой сессии.
    useAiAssistantStore.setState({
      userId: '7',
      conversationId: null,
      settings: {
        ...useAiAssistantStore.getState().settings,
        mode: 'fast',
        expertModel: 'claude-opus-5',
      } as never,
    })
    mockedGetCapabilities.mockResolvedValue(allowedCapabilities({ allowed: false }))
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)

    send('вопрос')
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ expert: undefined }),
      expect.anything()
    )
  })

  it('shows what the turn cost once the result frame arrives', async () => {
    mockedSendChatMessage.mockImplementation(async (_payload, callbacks) => {
      callbacks?.onExpert?.({
        model: 'claude-sonnet-5',
        costUsd: 0.05,
        inputTokens: 900,
        outputTokens: 120,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        spentTodayUsd: 1.25,
        dailyLimitUsd: 5,
      })
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Готово',
        coverage_flag: null,
        tool_calls: [],
        expert: {
          model: 'claude-sonnet-5',
          costUsd: 0.05,
          inputTokens: 900,
          outputTokens: 120,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          spentTodayUsd: 1.25,
          dailyLimitUsd: 5,
        },
      }
    })

    renderPage()
    await selectExpertModel('claude-sonnet-5')
    send('разбери падение сборов')

    const badge = await screen.findByTestId('assistant-expert-cost')
    expect(badge).toHaveTextContent('Sonnet · $0.05')
  })

  it('counts the cached context in the tokens tooltip, not just the fresh input', async () => {
    // Живой ход: input_tokens = 4 при 32 442 из кэша. «4 токена на вхід»
    // читалось бы как поломка счётчика — показываем полный вход и долю кэша.
    mockedSendChatMessage.mockResolvedValue({
      conversation_id: 1,
      message_id: 5,
      response: 'Готово',
      coverage_flag: null,
      tool_calls: [],
      expert: {
        model: 'claude-sonnet-5',
        costUsd: 0.1026,
        inputTokens: 4,
        outputTokens: 945,
        cacheReadTokens: 32442,
        cacheWriteTokens: 34671,
        spentTodayUsd: null,
        dailyLimitUsd: null,
      },
    })

    renderPage()
    await selectExpertModel('claude-sonnet-5')
    send('вопрос с длинным контекстом')

    const badge = await screen.findByTestId('assistant-expert-cost')
    expect(badge).toHaveAttribute('title', 'pages.aiAssistant.expertTokensCached')
  })

  it('shows the daily-limit refusal wording from the backend on a 429', async () => {
    mockedSendChatMessage.mockRejectedValueOnce(
      new AssistantChatStreamError({
        status: 429,
        message: 'Денний ліміт експертного режиму вичерпано.',
      })
    )

    renderPage()
    await selectExpertModel('claude-opus-5')
    send('дорогой вопрос')

    expect(
      await screen.findByText('Денний ліміт експертного режиму вичерпано.')
    ).toBeInTheDocument()
    // Отказ по бюджету не отбирает у руководителя сам режим.
    expect(screen.getByTestId('assistant-expert-external-notice')).toBeInTheDocument()
  })

  it('falls back to its own wording when a 429 carries no server text', async () => {
    mockedSendChatMessage.mockRejectedValueOnce(new AssistantChatStreamError({ status: 429 }))

    renderPage()
    await selectExpertModel('claude-opus-5')
    send('дорогой вопрос')

    expect(await screen.findByText('pages.aiAssistant.expertLimitReached')).toBeInTheDocument()
  })

  it('speaks about the external service on a 503, not about the thinking mode', async () => {
    // Прокси CRM подменяет текст мозга на 503 своим — про «думающий режим»
    // (на нём держится откат thinking → fast). Экспертному ходу эта
    // формулировка не подходит: показываем свою.
    mockedSendChatMessage.mockRejectedValueOnce(
      new AssistantChatStreamError({
        status: 503,
        message: 'Думающий режим сейчас недоступен. Повторите запрос в обычном режиме.',
      })
    )

    renderPage()
    await selectExpertModel('claude-sonnet-5')
    send('вопрос')

    expect(await screen.findByText('pages.aiAssistant.expertUnavailable')).toBeInTheDocument()
    expect(screen.queryByText(/Думающий режим/)).not.toBeInTheDocument()
    // Временный отказ не отбирает выбранный режим.
    expect(screen.getByTestId('assistant-expert-external-notice')).toBeInTheDocument()
  })

  it('clears the expert selection when the role loses access mid-session (403)', async () => {
    mockedSendChatMessage.mockRejectedValueOnce(
      new AssistantChatStreamError({
        status: 403,
        message: 'Експертний режим недоступний для вашої ролі.',
      })
    )

    renderPage()
    await selectExpertModel('claude-sonnet-5')
    send('вопрос')

    expect(
      await screen.findByText('Експертний режим недоступний для вашої ролі.')
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByTestId('assistant-expert-external-notice')).not.toBeInTheDocument()
    )
  })

  it('refreshes the budget after an expert turn, but leaves ordinary turns alone', async () => {
    const { queryClient } = renderPage()
    await waitForCapabilitiesSettled(queryClient)
    const afterMount = mockedGetCapabilities.mock.calls.length

    // Обычный ход инвалидирует списки диалогов — денег он не тратил, и
    // перезапрашивать бюджет на каждое сообщение каждого сотрудника незачем.
    send('обычный вопрос')
    // Ответ в ленте = мутация завершилась и её инвалидация уже отработала.
    await screen.findByText('Готово')
    expect(mockedGetCapabilities.mock.calls.length).toBe(afterMount)

    // Экспертный ход потратил деньги — остаток обязан обновиться.
    await selectExpertModel('claude-sonnet-5')
    send('дорогой вопрос')
    await waitFor(() => expect(mockedGetCapabilities.mock.calls.length).toBeGreaterThan(afterMount))
  })

  it('names the expert turn in the settings summary instead of calling it "fast"', async () => {
    renderPage()
    await selectExpertModel('claude-sonnet-5')

    fireEvent.click(screen.getByLabelText('pages.aiAssistant.settings'))
    const summary = await screen.findByTestId('assistant-settings-mode-summary')

    expect(summary).toHaveTextContent('pages.aiAssistant.expertTrigger')
    expect(summary).not.toHaveTextContent('pages.aiAssistant.modeFastShort')
  })

  it('keeps the wait readable while the external model thinks', async () => {
    // Ход, который ещё не ответил: в пузыре стоит подпись со своим таймером.
    mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))

    renderPage()
    await selectExpertModel('claude-sonnet-5')
    send('долгий вопрос')

    expect(await screen.findByTestId('assistant-expert-waiting')).toBeInTheDocument()
  })
})
