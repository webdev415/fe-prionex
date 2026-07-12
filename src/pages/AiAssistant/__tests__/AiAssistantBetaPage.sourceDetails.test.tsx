import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_REASONING_PANEL_WIDTH } from '../reasoningPanelConfig'
import type { AssistantChatResponse, SendChatMessageCallbacks } from '@/features/aiAssistant/api'
import type { AssistantCitation } from '@/features/aiAssistant/sse'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    // Гидратация заменила бы live-сообщение серверным БЕЗ citations (эфемерны до
    // Слоя 5) — гонка с кликом факта. Держим getConversation вечно pending, чтобы
    // проверять именно источники текущего хода.
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

/** Свежий DOM-узел факт-сноски по номеру (не сохранённая ссылка — против flaky). */
function getFact(n: number): HTMLElement {
  const node = screen
    .getAllByTestId('markdown-fact')
    .find((el) => el.getAttribute('data-fact-n') === String(n))
  if (!node) throw new Error(`fact [[${n}]] not found`)
  return node
}

/** Свежий DOM-узел источника по номеру (data-citation-id). */
function getSource(n: number): HTMLElement {
  const node = screen
    .getAllByTestId('citation-source')
    .find((el) => el.getAttribute('data-citation-id') === String(n))
  if (!node) throw new Error(`source #${n} not found`)
  return node
}

/**
 * Ход, который стримит два источника с деталями (Слой 2): SQL (query + таблица)
 * и расчёт (code + result), плюс один источник без деталей (только ref), и ответ
 * со сносками `[[1]]`/`[[2]]`.
 */
const DETAILED_CITATIONS: AssistantCitation[] = [
  {
    id: 1,
    kind: 'sql',
    ref: 'debts:remaining_debt_amount',
    query: 'SELECT remaining_debt_amount FROM debts WHERE client_id = 42',
    columns: ['client_id', 'remaining_debt_amount'],
    rows: [
      [42, 48750],
      [43, 0],
    ],
  },
  {
    id: 2,
    kind: 'calc',
    ref: 'sum(payments)',
    code: 'total = sum(p.amount for p in payments)',
    result: '129 400 ₴',
  },
  { id: 3, kind: 'tool', ref: 'get_client_card' },
]

function mockDetailedTurn(
  citations: AssistantCitation[] = DETAILED_CITATIONS,
  withReasoning = true
) {
  mockedSendChatMessage.mockImplementation(
    async (_payload, callbacks?: SendChatMessageCallbacks): Promise<AssistantChatResponse> => {
      if (withReasoning) callbacks?.onReasoning?.('Проверяю таблицу долгов.')
      callbacks?.onCitations?.(citations)
      callbacks?.onText?.('Остаток долга 48 750 ₴[[1]], всего оплачено 129 400 ₴[[2]]')
      return {
        conversation_id: 1,
        message_id: 5,
        response: 'Остаток долга 48 750 ₴[[1]], всего оплачено 129 400 ₴[[2]]',
        coverage_flag: null,
        tool_calls: [],
        citations,
      }
    }
  )
}

describe('AiAssistantBetaPage — детали источника в панели «Активность» (Слой 2)', () => {
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

  it('клик по факту разворачивает SQL-источник: запрос + таблица строк, фокус на нём', async () => {
    mockDetailedTurn()
    renderPage()
    send('сколько остаток долга?')
    await screen.findByText(/Остаток долга/)

    // Панель ещё закрыта.
    expect(screen.queryByTestId('assistant-citations')).not.toBeInTheDocument()

    // Клик по сноске ① открывает панель и разворачивает КОНКРЕТНЫЙ источник №1.
    fireEvent.click(getFact(1))
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })

    // Секция «Источники» показывает все три источника хода.
    expect(screen.getAllByTestId('citation-source')).toHaveLength(3)

    // Источник №1 (sql) — моно-блок запроса + компактная таблица.
    const source1 = getSource(1)
    const sql = within(source1).getByTestId('citation-sql')
    expect(sql).toHaveTextContent('SELECT remaining_debt_amount FROM debts WHERE client_id = 42')
    expect(sql).toHaveTextContent('remaining_debt_amount')
    expect(sql).toHaveTextContent('48750')

    // Фокус на источнике №1: акцент-рамка + авто-скролл.
    expect(source1).toHaveClass('border-primary-400')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('клик по другому факту переносит фокус на источник-расчёт (code + result)', async () => {
    mockDetailedTurn()
    renderPage()
    send('сколько оплачено?')
    await screen.findByText(/Остаток долга/)

    fireEvent.click(getFact(1))
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })
    expect(getSource(1)).toHaveClass('border-primary-400')

    // Свежий узел сноски ② в момент клика (не сохранённая ссылка — против flaky).
    fireEvent.click(getFact(2))

    // Фокус ушёл на источник №2, снялся с №1.
    expect(getSource(2)).toHaveClass('border-primary-400')
    expect(getSource(1)).not.toHaveClass('border-primary-400')

    // Источник №2 (calc) — моно-код + callout результата.
    const code = within(getSource(2)).getByTestId('citation-code')
    expect(code).toHaveTextContent('total = sum(p.amount for p in payments)')
    expect(code).toHaveTextContent('129 400 ₴')
  })

  it('источник без деталей деградирует до ref (нет sql/code блоков)', async () => {
    mockDetailedTurn()
    renderPage()
    send('покажи источники')
    await screen.findByText(/Остаток долга/)

    fireEvent.click(getFact(1))
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })

    // Источник №3 без query/rows/code — только ref, без блоков деталей.
    const source3 = getSource(3)
    expect(source3).toHaveTextContent('get_client_card')
    expect(within(source3).queryByTestId('citation-sql')).not.toBeInTheDocument()
    expect(within(source3).queryByTestId('citation-code')).not.toBeInTheDocument()
  })

  it('SQL-источник с пустыми columns/rows: показывает запрос, без таблицы и без «0»', async () => {
    mockDetailedTurn([{ id: 1, kind: 'sql', ref: 'x', query: 'SELECT 1', columns: [], rows: [] }])
    renderPage()
    send('пустая таблица')
    await screen.findByText(/Остаток долга/)

    fireEvent.click(getFact(1))
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })

    const sql = within(getSource(1)).getByTestId('citation-sql')
    // Ровно запрос — без таблицы и без «0» от числового falsy-рендера.
    expect(sql).toHaveTextContent('SELECT 1')
    expect(within(sql).queryByRole('table')).not.toBeInTheDocument()
    expect(sql.textContent).toBe('SELECT 1')
  })

  it('fast-ход с источниками, но без рассуждения: клик по факту всё равно открывает панель', async () => {
    // Без onReasoning: messageHasReasoning=false, но citations → messageHasActivity.
    mockDetailedTurn(DETAILED_CITATIONS, false)
    renderPage()
    send('быстрый ответ')
    await screen.findByText(/Остаток долга/)

    fireEvent.click(getFact(1))

    // Панель открылась и показывает источники, хотя блока рассуждения нет.
    await screen.findByTestId('assistant-citations', undefined, { timeout: 5000 })
    expect(screen.queryByTestId('assistant-reasoning-scroll')).not.toBeInTheDocument()
    expect(getSource(1)).toHaveClass('border-primary-400')
  })
})
