/**
 * MemoryPanel — панель «Персоналізація» (память ассистента о сотруднике).
 *
 * Замокан транспортный слой `@/features/aiAssistant/api`, хуки React Query
 * настоящие: удаление обязано дойти до DELETE и пережить последующий refetch,
 * а не просто спрятать строку в локальном стейте. Мок списка читает изменяемый
 * массив — так инвалидация после мутации возвращает уже реальный результат.
 *
 * i18n-мок из src/test/setup.ts отдаёт ключи, поэтому проверки идут по ключам;
 * исключение — текст сервера в 409/422, который обязан вытеснить локализованную
 * формулировку.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { MemoryPanel } from '../MemoryPanel'
import type { AssistantMemoryItem } from '@/features/aiAssistant/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    getMemoryItems: vi.fn(),
    createMemoryItem: vi.fn(),
    deleteMemoryItem: vi.fn(),
  }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { createMemoryItem, deleteMemoryItem, getMemoryItems } from '@/features/aiAssistant/api'
import { toast } from 'sonner'

const mockedGetMemoryItems = vi.mocked(getMemoryItems)
const mockedCreateMemoryItem = vi.mocked(createMemoryItem)
const mockedDeleteMemoryItem = vi.mocked(deleteMemoryItem)
const mockedToastError = vi.mocked(toast.error)

function memoryItem(id: number, extra: Partial<AssistantMemoryItem> = {}): AssistantMemoryItem {
  return {
    id,
    kind: 'note',
    title: `Факт ${id}`,
    content: `Содержимое факта ${id}`,
    source: 'user',
    created_at: '2026-08-01T10:00:00Z',
    ...extra,
  }
}

/** Серверное состояние памяти — мок списка читает его при каждом запросе. */
let store: AssistantMemoryItem[] = []
/** Потолок скоупа и объём памяти на сервере: `total` не обязан равняться длине
 * выдачи (в ответ уходит страница), а `limit` может не прийти вовсе. */
let storeLimit: number | null = null
let storeTotal: number | null = null

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<MemoryPanel />, { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  store = [
    memoryItem(1, { content: 'Веду портфель Alfa', source: 'user' }),
    memoryItem(2, { content: 'Просит суммы без копеек', source: 'agent' }),
    memoryItem(3, { content: 'Смена с 9 до 18', source: 'seed' }),
  ]
  storeLimit = null
  storeTotal = null
  mockedGetMemoryItems.mockImplementation(async () => ({
    items: store,
    total: storeTotal ?? store.length,
    limit: storeLimit,
  }))
  mockedDeleteMemoryItem.mockImplementation(async (id: number) => {
    store = store.filter((item) => item.id !== id)
  })
  mockedCreateMemoryItem.mockImplementation(async ({ title, content }) => {
    const created = memoryItem(99, { title, content, source: 'user' })
    store = [...store, created]
    return created
  })
})

describe('MemoryPanel', () => {
  it('renders the facts with their origin badge', async () => {
    renderPanel()

    expect(await screen.findByTestId('memory-item-1')).toBeInTheDocument()
    expect(screen.getByText('Веду портфель Alfa')).toBeInTheDocument()
    // user / agent / seed ложатся на три разные подписи происхождения.
    expect(screen.getByText('pages.aiAssistant.memory.sources.user')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.memory.sources.agent')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.memory.sources.observation')).toBeInTheDocument()
  })

  it('explains what the memory is when it is empty', async () => {
    store = []
    renderPanel()

    expect(await screen.findByTestId('memory-empty')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.memory.empty')).toBeInTheDocument()
  })

  it('deletes a fact through DELETE and keeps it gone after the refetch', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByTestId('memory-item-2')
    await user.click(screen.getByTestId('memory-delete-2'))

    expect(mockedDeleteMemoryItem).toHaveBeenCalledWith(2)
    await waitFor(() => expect(screen.queryByTestId('memory-item-2')).not.toBeInTheDocument())
    expect(screen.getByTestId('memory-item-1')).toBeInTheDocument()
  })

  it('rolls the row back and explains the failure when DELETE fails', async () => {
    const user = userEvent.setup()
    mockedDeleteMemoryItem.mockRejectedValue(new Error('boom'))
    renderPanel()

    await screen.findByTestId('memory-item-2')
    await user.click(screen.getByTestId('memory-delete-2'))

    await waitFor(() => expect(mockedToastError).toHaveBeenCalled())
    expect(await screen.findByTestId('memory-item-2')).toBeInTheDocument()
  })

  it('adds a fact and derives its title from the text', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByTestId('memory-item-1')
    await user.type(screen.getByTestId('memory-input'), 'Клиент Петров платит по вторникам')
    await user.click(screen.getByTestId('memory-submit'))

    await waitFor(() =>
      expect(mockedCreateMemoryItem).toHaveBeenCalledWith({
        title: 'Клиент Петров платит по вторникам',
        content: 'Клиент Петров платит по вторникам',
      })
    )
    // Поле очищается только после успеха — иначе текст пропадёт вместе с отказом.
    await waitFor(() => expect(screen.getByTestId('memory-input')).toHaveValue(''))
  })

  it('shows the server wording when the fact is a duplicate (409)', async () => {
    const user = userEvent.setup()
    mockedCreateMemoryItem.mockRejectedValue({
      response: { status: 409, data: { detail: 'Схожий факт уже є в пам’яті' } },
    })
    renderPanel()

    await screen.findByTestId('memory-item-1')
    await user.type(screen.getByTestId('memory-input'), 'Веду портфель Alfa')
    await user.click(screen.getByTestId('memory-submit'))

    expect(await screen.findByTestId('memory-form-error')).toHaveTextContent(
      'Схожий факт уже є в пам’яті'
    )
    // Текст остаётся в поле, чтобы оператор мог его поправить.
    expect(screen.getByTestId('memory-input')).toHaveValue('Веду портфель Alfa')
  })

  it('shows how full the memory is when the server sends a cap', async () => {
    storeLimit = 50
    storeTotal = 12
    renderPanel()

    expect(await screen.findByTestId('memory-usage')).toHaveTextContent('12 / 50')
    // Место ещё есть — подсказки о вытеснении быть не должно.
    expect(screen.queryByTestId('memory-limit-hint')).not.toBeInTheDocument()
  })

  it('draws no counter when the backend sends no cap yet', async () => {
    // Фронт может выкатиться раньше бэкенда: ответ без `limit` обязан дать
    // прежний экран, а не пустой счётчик и не падение.
    storeLimit = null
    renderPanel()

    expect(await screen.findByTestId('memory-item-1')).toBeInTheDocument()
    expect(screen.queryByTestId('memory-usage')).not.toBeInTheDocument()
    expect(screen.queryByTestId('memory-limit-hint')).not.toBeInTheDocument()
  })

  it('explains the eviction once the memory is full', async () => {
    storeLimit = 50
    storeTotal = 65
    renderPanel()

    expect(await screen.findByTestId('memory-usage')).toHaveTextContent('65 / 50')
    expect(screen.getByTestId('memory-limit-hint')).toHaveTextContent(
      'pages.aiAssistant.memory.limitHint'
    )
  })

  it('labels a consolidated fact with its own origin', async () => {
    store = [memoryItem(4, { content: 'Сводный факт о смене', source: 'consolidated' })]
    renderPanel()

    expect(await screen.findByTestId('memory-item-4')).toBeInTheDocument()
    expect(screen.getByText('pages.aiAssistant.memory.sources.consolidated')).toBeInTheDocument()
  })

  it('falls back to a localized message when a 422 carries no detail', async () => {
    const user = userEvent.setup()
    mockedCreateMemoryItem.mockRejectedValue({ response: { status: 422, data: {} } })
    renderPanel()

    await screen.findByTestId('memory-item-1')
    await user.type(screen.getByTestId('memory-input'), '+380501112233')
    await user.click(screen.getByTestId('memory-submit'))

    expect(await screen.findByTestId('memory-form-error')).toHaveTextContent(
      'pages.aiAssistant.memory.errors.validation'
    )
  })
})
