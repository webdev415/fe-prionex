/**
 * Переключатель «Міркування 31B» (в меню выбора режима у поля ввода) — три
 * позиции: «Сервер» (не выбирали, режим решает сервер), «Увімк.», «Вимк.».
 *
 * Здесь — видимость переключателя, его дефолт и то, как выбор гасит поверхности
 * раздумий: «Вимк.» убирает ход рассуждения (плашку в бабле и одноимённую
 * секцию панели «Активность»), но НЕ источники факт-сносок — по ним оператор
 * проверяет числа в ответе. Что уходит в тело запроса — в
 * AiAssistantBetaPage.thinkingFlag.test.tsx.
 *
 * Сам переключатель показывается только в режиме «Думаючий»: на fast раздумий
 * не бывает, поэтому настройке там нечем управлять.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type { AssistantChatResponse, SendChatMessageCallbacks } from '@/features/aiAssistant/api'
import type { AssistantCitation } from '@/features/aiAssistant/sse'
import {
  AI_ASSISTANT_STORAGE_KEY,
  DEFAULT_ASSISTANT_SETTINGS,
  useAiAssistantStore,
} from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    // Гидратация подменила бы live-сообщение серверным (без citations) — гонка с
    // проверками текущего хода. Держим её вечно pending, как в sourceDetails.
    getConversation: vi.fn(() => new Promise(() => {})),
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

/** Открыть меню режима (там же живёт тумблер раздумий) и вернуть его узел. */
function openModeMenu(): HTMLElement {
  fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
  return screen.getByTestId('assistant-mode-menu')
}

/**
 * Закрыть меню режима повторным кликом по триггеру. Именно кликом, не Esc: Esc
 * слушает и открытая панель «Активность» — она бы закрылась заодно и тест мерил
 * бы не то.
 */
function closeModeMenu() {
  fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
}

/** Переключатель «Міркування 31B» в открытом меню режима. */
function getThinkingChoice(): HTMLElement {
  return within(openModeMenu()).getByTestId('assistant-thinking-choice')
}

function setThinkingChoice(choice: 'server' | 'on' | 'off') {
  fireEvent.click(within(getThinkingChoice()).getByTestId(`assistant-thinking-choice-${choice}`))
  closeModeMenu()
}

function selectThinkingMode() {
  const menu = openModeMenu()
  fireEvent.click(within(menu).getByText('pages.aiAssistant.modeThinkingShort'))
}

/** Раскрыть панель «Активность» кликом по плашке в бабле. */
async function openActivityPanel() {
  const chip = await screen.findByTestId('assistant-reasoning')
  fireEvent.click(chip.querySelector('button') as HTMLButtonElement)
}

/** Свежий DOM-узел факт-сноски по номеру (не сохранённая ссылка — против flaky). */
function getFact(n: number): HTMLElement {
  const node = screen
    .getAllByTestId('markdown-fact')
    .find((el) => el.getAttribute('data-fact-n') === String(n))
  if (!node) throw new Error(`fact [[${n}]] not found`)
  return node
}

const FAST_CITATIONS: AssistantCitation[] = [
  {
    id: 1,
    kind: 'sql',
    ref: 'debts:remaining_debt_amount',
    query: 'SELECT remaining_debt_amount FROM debts WHERE client_id = 42',
    columns: ['client_id', 'remaining_debt_amount'],
    rows: [[42, 48750]],
  },
]

/** Ход «Думает» с рассуждением И источниками факт-сносок одновременно. */
function mockThinkingTurnWithCitations(reasoning = 'Сверяю таблицу долгов.') {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onReasoning?.(reasoning)
      callbacks?.onCitations?.(FAST_CITATIONS)
      callbacks?.onText?.('Остаток долга 48 750 ₴[[1]]')
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Остаток долга 48 750 ₴[[1]]',
        coverage_flag: null,
        tool_calls: [],
        citations: FAST_CITATIONS,
      }
    }
  )
}

/** Ход с рассуждением (режим «Думает») и коротким ответом. */
function mockThinkingTurn(reasoning = 'Сверяю таблицу долгов.') {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onReasoning?.(reasoning)
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
}

/** Быстрый ход: раздумий нет, но есть источники факт-сносок. */
function mockFastTurnWithCitations() {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      callbacks?.onCitations?.(FAST_CITATIONS)
      callbacks?.onText?.('Остаток долга 48 750 ₴[[1]]')
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Остаток долга 48 750 ₴[[1]]',
        coverage_flag: null,
        tool_calls: [],
        citations: FAST_CITATIONS,
      }
    }
  )
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

  it('переключатель есть только в «Думаючому» и по умолчанию стоит на «Сервер»', async () => {
    renderPage()

    // Быстрый режим: раздумий не бывает — настройки в меню нет вовсе.
    const fastMenu = openModeMenu()
    expect(within(fastMenu).queryByTestId('assistant-show-reasoning-row')).not.toBeInTheDocument()
    expect(within(fastMenu).queryByTestId('assistant-thinking-choice')).not.toBeInTheDocument()
    closeModeMenu()

    selectThinkingMode()

    // «Думаючий»: переключатель появился, позиция — «Сервер»: оператор ничего
    // не выбирал, поле `thinking` в запрос не уходит, режим решает сервер.
    const thinkingMenu = openModeMenu()
    expect(within(thinkingMenu).getByTestId('assistant-show-reasoning-row')).toBeInTheDocument()
    const choice = within(thinkingMenu).getByTestId('assistant-thinking-choice')
    expect(choice).toHaveAttribute('data-choice', 'server')
    expect(
      within(choice).getByRole('radiogroup', { name: 'pages.aiAssistant.showReasoning' })
    ).toBeInTheDocument()
    expect(
      within(choice).getByRole('radio', { name: 'pages.aiAssistant.thinkingChoiceServer' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(useAiAssistantStore.getState().settingsFor(USER_ID)?.thinkingChoice).toBeNull()
    // Прежняя настройка видимости при этом — как и была: показывать.
    expect(useAiAssistantStore.getState().settingsFor(USER_ID)?.showReasoning).toBe(true)
  })

  it('по умолчанию раздумья показываются: позиция «Сервер», плашка и окно рассуждения на месте', async () => {
    mockThinkingTurn('Сверяю таблицу долгов.')
    renderPage()
    selectThinkingMode()
    send('думай')
    await screen.findByText('Готово')

    // Дефолт — «показывать, если пришло», привычное поведение не меняется молча.
    expect(getThinkingChoice()).toHaveAttribute('data-choice', 'server')
    closeModeMenu()

    await openActivityPanel()
    expect(await screen.findByTestId('assistant-reasoning-text')).toHaveTextContent(
      'Сверяю таблицу долгов.'
    )
  })

  it('«Вимк.» убирает и плашку, и окно рассуждения', async () => {
    mockThinkingTurn('Внутренняя мысль модели.')
    renderPage()
    selectThinkingMode()
    send('думай')
    await screen.findByText('Готово')

    await openActivityPanel()
    await screen.findByTestId('assistant-reasoning-text')

    setThinkingChoice('off')

    // У этого хода нет ни шагов, ни источников — вся поверхность раздумий уходит.
    await waitFor(() => expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument())
    expect(screen.queryByTestId('assistant-reasoning-text')).not.toBeInTheDocument()
    expect(screen.queryByText('Внутренняя мысль модели.')).not.toBeInTheDocument()
    // Сам ответ остаётся — скрываются только раздумья.
    expect(screen.getByText('Готово')).toBeInTheDocument()
  })

  it('выбор переживает перезагрузку: читается из localStorage и пишется обратно', async () => {
    localStorage.setItem(
      AI_ASSISTANT_STORAGE_KEY,
      JSON.stringify({
        state: {
          userId: USER_ID,
          conversationId: null,
          settings: { ...DEFAULT_ASSISTANT_SETTINGS, mode: 'thinking', thinkingChoice: 'off' },
          historySidebarCollapsed: false,
          reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
        },
        version: 0,
      })
    )
    await useAiAssistantStore.persist.rehydrate()

    mockThinkingTurn('Мысль, которую оператор видеть не хочет.')
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    // Настройка поднялась из хранилища — раздумья скрыты сразу, без клика.
    expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
    expect(getThinkingChoice()).toHaveAttribute('data-choice', 'off')
    closeModeMenu()

    // Обратное переключение сохраняется в тот же стор (переживёт перезагрузку).
    setThinkingChoice('on')
    await waitFor(() =>
      expect(useAiAssistantStore.getState().settingsFor(USER_ID)?.thinkingChoice).toBe('on')
    )
    expect(useAiAssistantStore.getState().settingsFor(USER_ID)?.showReasoning).toBe(true)
    expect(await screen.findByTestId('assistant-reasoning')).toBeInTheDocument()
  })

  it('запись старого фронта с «не показывать» уважается: раздумья скрыты, но выбора по серверу нет', async () => {
    // Старый тумблер «Показувати міркування» прятал ход рассуждения — это
    // клиентская настройка, она поднимается как была. Позиция переключателя
    // при этом «Сервер»: просьбы «не думай» оператор не делал.
    localStorage.setItem(
      AI_ASSISTANT_STORAGE_KEY,
      JSON.stringify({
        state: {
          userId: USER_ID,
          conversationId: null,
          settings: (({ thinkingChoice: _omit, ...legacy }) => ({
            ...legacy,
            mode: 'thinking',
            showReasoning: false,
          }))(DEFAULT_ASSISTANT_SETTINGS),
          historySidebarCollapsed: false,
          reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
        },
        version: 0,
      })
    )
    await useAiAssistantStore.persist.rehydrate()

    mockThinkingTurn('Мысль, которую оператор видеть не хочет.')
    renderPage()
    send('думай')
    await screen.findByText('Готово')

    expect(screen.queryByTestId('assistant-reasoning')).not.toBeInTheDocument()
    expect(screen.queryByText('Мысль, которую оператор видеть не хочет.')).not.toBeInTheDocument()
    expect(getThinkingChoice()).toHaveAttribute('data-choice', 'server')
    closeModeMenu()
  })

  it('в открытой панели скрывается только «Ход рассуждения» — источники остаются', async () => {
    mockThinkingTurnWithCitations('Мысль, которую оператор видеть не хочет.')
    renderPage()
    selectThinkingMode()
    send('думай и считай')
    await screen.findByText(/Остаток долга/)

    await openActivityPanel()
    await screen.findByTestId('assistant-reasoning-text')
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })

    setThinkingChoice('off')

    // Панель остаётся открытой (в ней есть источники), но окно рассуждения ушло.
    await waitFor(() =>
      expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()
    )
    expect(screen.queryByText('Мысль, которую оператор видеть не хочет.')).not.toBeInTheDocument()
    expect(screen.getByTestId('assistant-citations')).toBeInTheDocument()
  })

  it('на fast переключателя нет, а «Вимк.» не трогает источники факт-сносок', async () => {
    // Оператор выбрал «Вимк.» раньше, в «Думаючому»; сохранённое значение уважаем.
    localStorage.setItem(
      AI_ASSISTANT_STORAGE_KEY,
      JSON.stringify({
        state: {
          userId: USER_ID,
          conversationId: null,
          settings: {
            ...DEFAULT_ASSISTANT_SETTINGS,
            mode: 'fast',
            thinkingChoice: 'off',
            showReasoning: false,
          },
          historySidebarCollapsed: false,
          reasoningPanelWidth: DEFAULT_REASONING_PANEL_WIDTH,
        },
        version: 0,
      })
    )
    await useAiAssistantStore.persist.rehydrate()

    mockFastTurnWithCitations()
    renderPage()

    // Быстрый режим раздумий не присылает — переключателя в меню нет.
    const fastMenu = openModeMenu()
    expect(within(fastMenu).queryByTestId('assistant-show-reasoning-row')).not.toBeInTheDocument()
    expect(within(fastMenu).queryByTestId('assistant-thinking-choice')).not.toBeInTheDocument()
    closeModeMenu()

    send('быстрый ответ')
    await screen.findByText(/Остаток долга/)

    // Плашка осталась: у fast-хода она ведёт к источникам, а не к раздумьям.
    expect(await screen.findByTestId('assistant-reasoning')).toBeInTheDocument()

    fireEvent.click(getFact(1))
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()
  })
})
