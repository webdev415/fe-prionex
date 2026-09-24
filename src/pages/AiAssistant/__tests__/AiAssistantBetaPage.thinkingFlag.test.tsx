/**
 * Переключатель «Міркування 31B» — трёхпозиционный выбор оператора по контракту
 * шлюза (`thinking: true | false | null`): «Сервер» (не выбирали — поля в теле
 * нет, режим решает сервер), «Увімк.» (`thinking: true`), «Вимк.»
 * (`thinking: false`, 31B отвечает без хода рассуждения — быстрее).
 *
 * Здесь проверяется всё, что видно снаружи страницы: тело запроса, панель
 * раздумий, чип факта хода из кадра `done`, то, как позиция «Сервер» отражает
 * факт последнего хода, и мягкая деградация на прокси, ещё не знающем поля.
 * Видимость самого переключателя и его дефолт живут в
 * AiAssistantBetaPage.showReasoning.test.tsx — там же, где остальная логика
 * меню режима.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  SendChatMessageCallbacks,
} from '@/features/aiAssistant/api'
import type { SseDonePayload } from '@/features/aiAssistant/sse'
import {
  AI_ASSISTANT_STORAGE_KEY,
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
  type AssistantThinkingChoice,
} from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    // Гидратация подменила бы live-сообщение серверным — держим её вечно
    // pending, как в соседних тестах страницы.
    getConversation: vi.fn(() => new Promise(() => {})),
    getConversations: vi.fn().mockResolvedValue([]),
    sendChatMessage: vi.fn(),
    sendFeedback: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { AssistantChatStreamError, sendChatMessage } from '@/features/aiAssistant/api'
import { toast } from 'sonner'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

const USER_ID = '7'

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
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
 * Поднять сохранённые настройки до рендера страницы. Запись — всегда схемы
 * версии 0: другой у хранилища нет и быть не должно (откат фронта обязан
 * читать запись новой сборки как свою). `thinkingChoice` не задан — запись
 * старого фронта, где поля ещё не было.
 */
async function withStoredSettings(settings: {
  mode: 'fast' | 'thinking'
  thinkingChoice?: AssistantThinkingChoice | null
  showReasoning?: boolean
}) {
  const stored: Record<string, unknown> = { ...DEFAULT_ASSISTANT_SETTINGS, ...settings }
  if (!('thinkingChoice' in settings)) delete stored.thinkingChoice
  localStorage.setItem(
    AI_ASSISTANT_STORAGE_KEY,
    JSON.stringify({
      state: {
        userId: USER_ID,
        conversationId: null,
        settings: stored,
        historySidebarCollapsed: false,
        reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
      },
      version: 0,
    })
  )
  await useAiAssistantStore.persist.rehydrate()
}

/** Ключ `thinking` физически отсутствует в теле (не просто `undefined`). */
function expectNoThinkingKey(payload: AssistantChatRequest) {
  expect(payload.thinking).toBeUndefined()
  // Искать надо КЛЮЧ: значение `"mode":"thinking"` в теле законно.
  expect(JSON.stringify(payload)).not.toContain('"thinking":')
}

/** Ход, который отвечает текстом и (опционально) фактом хода в кадре `done`. */
function mockTurn(done?: SseDonePayload) {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onText?.('Готово')
      if (done) callbacks?.onDone?.(done)
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Готово',
        coverage_flag: null,
        tool_calls: [],
      }
    }
  )
}

function sentPayload(call = 0): AssistantChatRequest {
  return mockedSendChatMessage.mock.calls[call][0]
}

function openModeMenu(): HTMLElement {
  fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
  return screen.getByTestId('assistant-mode-menu')
}

function closeModeMenu() {
  fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
}

/** Переключатель в открытом меню режима. */
function getThinkingChoice(menu: HTMLElement): HTMLElement {
  return within(menu).getByTestId('assistant-thinking-choice')
}

function pickThinkingChoice(choice: 'server' | 'on' | 'off') {
  const menu = openModeMenu()
  fireEvent.click(within(menu).getByTestId(`assistant-thinking-choice-${choice}`))
  closeModeMenu()
}

function storedSettings() {
  return useAiAssistantStore.getState().settingsFor(USER_ID)
}

describe('AiAssistantBetaPage — переключатель «Міркування 31B»', () => {
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
    useAuthStore.setState({ user: { id: USER_ID } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('тело запроса', () => {
    it('не выбирали: поля thinking в теле нет — режим решает сервер', async () => {
      // Свежий оператор: настроек в хранилище нет вовсе, переключатель стоит
      // на «Сервер», выбора он не делал.
      mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))
      renderPage()
      fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
      fireEvent.click(screen.getByText('pages.aiAssistant.modeThinkingShort'))
      send('думай')

      await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalled())
      expect(sentPayload().mode).toBe('thinking')
      expectNoThinkingKey(sentPayload())
      // Факт сервера ещё не известен — ждём раздумий, как и раньше: окно
      // открывается сразу.
      expect(await screen.findByTestId('assistant-reasoning')).toBeInTheDocument()
      // В хранилище выбор так и не появился — поле не пришпилено к дефолту.
      expect(storedSettings()?.thinkingChoice).toBeNull()
    })

    it('сохранённое «не выбирали» (null) тоже уходит без поля', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: null })
      mockTurn()
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      expectNoThinkingKey(sentPayload())
    })

    it('«Увімк.» просит раздумья: в теле thinking: true', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'on' })
      mockTurn()
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      expect(sentPayload().thinking).toBe(true)
    })

    it('«Вимк.» уходит как thinking: false и не открывает панель раздумий', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'off' })
      // Ход, который не отвечает: проверяем состояние страницы, пока он идёт.
      mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))
      renderPage()
      send('думай')

      await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalled())
      expect(sentPayload().thinking).toBe(false)
      // Раздумий не будет вовсе — окно ждать нечего, плашки нет.
      expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
    })

    it('«Увімк.», наоборот, открывает окно раздумий сразу', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'on' })
      mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))
      renderPage()
      send('думай')

      await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalled())
      expect(await screen.findByTestId('assistant-reasoning')).toBeInTheDocument()
    })

    it('в быстром режиме поля thinking в теле нет даже при явном выборе', async () => {
      await withStoredSettings({ mode: 'fast', thinkingChoice: 'off' })
      mockTurn()
      renderPage()
      send('быстро')
      await screen.findByText('Готово')

      // Не только «undefined», но и физически не уходит на провод: прокси старой
      // версии отвергает незнакомое поле, и fast-ход обязан остаться прежним.
      expectNoThinkingKey(sentPayload())
    })
  })

  describe('запись старого фронта (поля thinkingChoice ещё не было)', () => {
    it('showReasoning: true — выбора нет, поля нет', async () => {
      await withStoredSettings({ mode: 'thinking', showReasoning: true })
      mockTurn()
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      expectNoThinkingKey(sentPayload())
      expect(storedSettings()?.thinkingChoice).toBeNull()
    })

    it('showReasoning: false — прежняя настройка видимости, а не просьба к серверу: поля нет, раздумья скрыты', async () => {
      // Старый тумблер «Показувати міркування» был чисто клиентским: оператор
      // прятал ход рассуждения, сервер при этом думал. Домысливать из этого
      // «выключи раздумья» нельзя — поле уходит только по явному выбору.
      await withStoredSettings({ mode: 'thinking', showReasoning: false })
      mockTurn()
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      expectNoThinkingKey(sentPayload())
      expect(storedSettings()?.thinkingChoice).toBeNull()
      expect(storedSettings()?.showReasoning).toBe(false)
      expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
    })
  })

  describe('явный выбор в меню', () => {
    it('«Вимк.» → false, «Увімк.» → true; выбор и прежний showReasoning ложатся в хранилище схемы 0', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: null })
      mockTurn()
      renderPage()

      pickThinkingChoice('off')
      send('раз')
      await screen.findByText('Готово')
      expect(sentPayload(0).thinking).toBe(false)
      await waitFor(() => expect(storedSettings()?.thinkingChoice).toBe('off'))
      // Прежний boolean-тумблер видимости идёт следом: откат фронта увидит
      // «раздумья скрыты», а не сброс настроек.
      expect(storedSettings()?.showReasoning).toBe(false)

      pickThinkingChoice('on')
      send('два')
      await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(2))
      expect(sentPayload(1).thinking).toBe(true)
      await waitFor(() => expect(storedSettings()?.thinkingChoice).toBe('on'))
      expect(storedSettings()?.showReasoning).toBe(true)

      // Запись в localStorage — та же схема, что у сборки до этой правки.
      const record = JSON.parse(localStorage.getItem(AI_ASSISTANT_STORAGE_KEY) as string) as {
        state: { settings: { thinkingChoice: unknown; showReasoning: unknown } }
        version: number
      }
      expect(record.version).toBe(0)
      expect(record.state.settings.thinkingChoice).toBe('on')
      expect(record.state.settings.showReasoning).toBe(true)
    })

    it('«Сервер» снимает выбор: поля снова нет, раздумья показываются, если придут', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'off' })
      mockTurn()
      renderPage()

      pickThinkingChoice('server')
      send('думай')
      await screen.findByText('Готово')

      expectNoThinkingKey(sentPayload())
      await waitFor(() => expect(storedSettings()?.thinkingChoice).toBeNull())
      expect(storedSettings()?.showReasoning).toBe(true)
    })
  })

  describe('позиция «Сервер» показывает факт последнего хода', () => {
    it('до первого ответа факт неизвестен: нейтрально', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: null })
      renderPage()

      const choice = getThinkingChoice(openModeMenu())
      expect(choice).toHaveAttribute('data-choice', 'server')
      expect(choice).toHaveAttribute('data-server-fact', 'unknown')
      expect(
        within(choice).getByRole('radio', { name: 'pages.aiAssistant.thinkingChoiceServer' })
      ).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('assistant-thinking-choice-status')).toHaveTextContent(
        'pages.aiAssistant.thinkingChoiceServerHint'
      )
    })

    it('сервер ответил без раздумий: «Сервер» показывает это и следующий ход окна раздумий не ждёт', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: null })
      mockTurn({ thinking_requested: false, thinking_used: false })
      renderPage()
      send('раз')
      await screen.findByText('Готово')

      const choice = getThinkingChoice(openModeMenu())
      expect(choice).toHaveAttribute('data-choice', 'server')
      expect(choice).toHaveAttribute('data-server-fact', 'off')
      expect(screen.getByTestId('assistant-thinking-choice-status')).toHaveTextContent(
        'pages.aiAssistant.thinkingChoiceFactOff'
      )
      closeModeMenu()

      // Второй ход: поля по-прежнему нет, а окно раздумий не открываем —
      // сервер их не производит.
      mockedSendChatMessage.mockImplementation(() => new Promise(() => {}))
      send('два')
      await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(2))
      expectNoThinkingKey(sentPayload(1))
      expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
    })

    it('сервер ответил с раздумьями: «Сервер» показывает это', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: null })
      mockTurn({ thinking_requested: true, thinking_used: true })
      renderPage()
      send('раз')
      await screen.findByText('Готово')

      const choice = getThinkingChoice(openModeMenu())
      expect(choice).toHaveAttribute('data-server-fact', 'on')
      expect(screen.getByTestId('assistant-thinking-choice-status')).toHaveTextContent(
        'pages.aiAssistant.thinkingChoiceFactOn'
      )
    })

    it('при явном выборе факт сервера позицию не подменяет', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'on' })
      mockTurn({ thinking_requested: true, thinking_used: false })
      renderPage()
      send('раз')
      await screen.findByText('Готово')

      const choice = getThinkingChoice(openModeMenu())
      expect(choice).toHaveAttribute('data-choice', 'on')
      expect(
        within(choice).getByRole('radio', { name: 'pages.aiAssistant.thinkingChoiceOn' })
      ).toHaveAttribute('aria-checked', 'true')
      expect(screen.queryByTestId('assistant-thinking-choice-status')).not.toBeInTheDocument()
    })
  })

  describe('чип факта хода', () => {
    it('после ответа чип говорит, чем ход шёл на самом деле', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'off' })
      mockTurn({ thinking_requested: false, thinking_used: false })
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      const chip = await screen.findByTestId('assistant-thinking-fact')
      expect(chip).toHaveTextContent('pages.aiAssistant.thinkingUsedOff')
      expect(chip).toHaveAttribute('data-mismatch', 'false')
      expect(chip).not.toHaveAttribute('title')
    })

    it('ответ с раздумьями показывает свой чип', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'on' })
      mockTurn({ thinking_requested: true, thinking_used: true })
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      expect(await screen.findByTestId('assistant-thinking-fact')).toHaveTextContent(
        'pages.aiAssistant.thinkingUsedOn'
      )
    })

    it('сервер ответил иначе, чем просили — чип предупреждает', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'off' })
      // Просили без раздумий, а сервер всё равно думал.
      mockTurn({ thinking_requested: false, thinking_used: true })
      renderPage()
      send('думай')
      await screen.findByText('Готово')

      const chip = await screen.findByTestId('assistant-thinking-fact')
      expect(chip).toHaveTextContent('pages.aiAssistant.thinkingUsedOn')
      expect(chip).toHaveAttribute('data-mismatch', 'true')
      expect(chip).toHaveAttribute('title', 'pages.aiAssistant.thinkingUsedMismatch')
    })

    it('у быстрого хода чипа нет, даже если сервер прислал факт', async () => {
      await withStoredSettings({ mode: 'fast', thinkingChoice: 'on' })
      mockTurn({ thinking_requested: false, thinking_used: false })
      renderPage()
      send('быстро')
      await screen.findByText('Готово')

      expect(screen.queryByTestId('assistant-thinking-fact')).not.toBeInTheDocument()
    })
  })

  describe('прокси, не знающий поля', () => {
    it('старый шлюз не знает поля: ход повторяется без него и оператора предупреждают', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'off' })
      mockedSendChatMessage
        .mockRejectedValueOnce(
          new AssistantChatStreamError({
            status: 422,
            message: 'Extra inputs are not permitted',
            fields: ['thinking'],
          })
        )
        .mockImplementation(
          async (
            _payload,
            callbacks?: SendChatMessageCallbacks
          ): Promise<AssistantChatResponse> => {
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
      send('думай')

      // Оператор получает ответ, а не отказ: повтор ушёл тем же телом минус поле.
      await screen.findByText('Готово')
      expect(mockedSendChatMessage).toHaveBeenCalledTimes(2)
      expect(sentPayload(0).thinking).toBe(false)
      expect(JSON.stringify(sentPayload(1))).not.toContain('"thinking":')
      expect(toast.info).toHaveBeenCalledWith('pages.aiAssistant.thinkingFlagUnsupported')
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('чужой отказ 422 не превращается в повтор', async () => {
      await withStoredSettings({ mode: 'thinking', thinkingChoice: 'off' })
      // 422 про вложение — поле `thinking` тут ни при чём, повторять нечего.
      mockedSendChatMessage.mockRejectedValue(
        new AssistantChatStreamError({ status: 422, message: 'Файл не підходить' })
      )
      renderPage()
      send('думай')

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Файл не підходить'))
      expect(mockedSendChatMessage).toHaveBeenCalledTimes(1)
      expect(toast.info).not.toHaveBeenCalled()
    })
  })
})
