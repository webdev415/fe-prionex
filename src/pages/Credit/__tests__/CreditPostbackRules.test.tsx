/**
 * Настройки → Постбеки партнерам: список правил (18-13d-a1).
 *
 * Что держим (AC-a4, AC-a7, AC-a8, AC-a9):
 *  - пять исходов списка — данные, пусто, 403, сеть/5xx, загрузка — различимы;
 *    упавшая фоновая перечитка не прячет список, который уже на руках;
 *  - вкл/выкл — одним нажатием, на время запроса переключатель выключен, при
 *    отказе сразу (не после перечитки) возвращается в прежнее положение с
 *    сообщением;
 *  - удаление — только через подтверждение в опасном тоне, строка исчезает после
 *    ответа;
 *  - ключ идемпотентности — на нажатие: два нажатия — два ключа, повтор того же
 *    действия (те же переменные мутации) — тот же ключ; сетевой отказ сам не
 *    повторяется — повтор мутаций здесь боевой, как в `main.tsx`;
 *  - без права записи переключатели выключены, кнопок удаления нет;
 *  - адрес партнёра — под замазкой записи и не в атрибутах, полный — в
 *    подсказке (тоже под замазкой) и копированием;
 *  - неизвестный модулю триггер — сырым значением с пометкой.
 *
 * Хуки настоящие, QueryClient живой (`gcTime: Infinity` — без таймера сборки
 * кэша, который пережил бы jsdom), подменён только транспорт: проверяется
 * граница нажатия, которую держат хуки, а не заглушка хуков.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MutationObserver as QueryMutationObserver,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { CreditPostbacksSection } from '../components/CreditPostbacksSection'
import { CreditApiError, toCreditError } from '@/features/credit/api/creditApi'
import { creditPostbacksApi, type CreditPostbackRule } from '@/features/credit/api/postbacks'
import { expectObscured } from '@/test/piiHelpers'

vi.mock('@/features/credit/api/postbacks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credit/api/postbacks')>()
  return {
    ...actual,
    creditPostbacksApi: { rules: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn() },
  }
})

vi.mock('@/components/ui/TableSkeleton', () => ({
  TableSkeleton: () => <div data-testid="table-skeleton" />,
}))

const api = vi.mocked(creditPostbacksApi)

/** Синтетический токен партнёра: по нему ищем утечку адреса в атрибуты. */
const TOKEN = 'tok-synthetic-0000'
const LONG_URL = `https://partner.example/postback?clickid={click_id}&action_id={action_id}&goal={goal}&key=${TOKEN}`

function rule(patch: Partial<CreditPostbackRule> = {}): CreditPostbackRule {
  return {
    id: 'r-1',
    name: 'Partner one — lead',
    active: true,
    trigger: 'new_lead',
    utm_source: 'partner1',
    url_template: LONG_URL,
    goal: '1',
    currency: 'CAD',
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    created_by: 7,
    updated_by: 7,
    ...patch,
  }
}

/** «Сервер»: список живёт здесь, правка и удаление меняют его, как модуль. */
let server: CreditPostbackRule[] = []

function serveRules(rules: CreditPostbackRule[]): void {
  server = rules
  api.rules.mockImplementation(async () => ({
    items: server,
    triggers: [
      { code: 'new_lead', amount_allowed: false },
      { code: 'new_loan', amount_allowed: true },
    ],
    macros: ['click_id', 'action_id', 'goal', 'amount', 'currency'],
  }))
  api.updateRule.mockImplementation(async (id, patch) => {
    server = server.map((item) => (item.id === id ? { ...item, ...patch } : item))
    return server.find((item) => item.id === id) as CreditPostbackRule
  })
  api.deleteRule.mockImplementation(async (id) => {
    const gone = server.find((item) => item.id === id) as CreditPostbackRule
    server = server.filter((item) => item.id !== id)
    return gone
  })
}

/**
 * Повтор мутаций — боевой: копия предиката `main.tsx` (тот его не экспортирует и
 * при импорте монтирует приложение). Сцена «предикат — копия боевого» сверяет
 * эти строки с исходником, чтобы копия не разошлась с оригиналом молча.
 */
const MUTATION_NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])
const isMutationRetryable = (error: unknown): boolean => {
  const axiosError = error as AxiosError | undefined
  if (!axiosError || axiosError.response) return false
  return Boolean(axiosError.code && MUTATION_NETWORK_ERROR_CODES.has(axiosError.code))
}
const MAIN_PREDICATE_LINES = [
  "const MUTATION_NETWORK_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'])",
  '  if (!axiosError || axiosError.response) return false',
  '  return Boolean(axiosError.code && MUTATION_NETWORK_ERROR_CODES.has(axiosError.code))',
  'retry: (failureCount, error) => failureCount < 1 && isMutationRetryable(error),',
]

/** Исходник `main.tsx` — глобом Vite с `?raw`: модуль не исполняется. */
const MAIN_SOURCE = Object.values(
  import.meta.glob('../../../main.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

function renderSection(canWrite = true): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: {
        retry: (failureCount, error) => failureCount < 1 && isMutationRetryable(error),
        retryDelay: 0,
        gcTime: Infinity,
      },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <CreditPostbacksSection canWrite={canWrite} />
    </QueryClientProvider>
  )
  return client
}

const DELETE = 'credit.postbacks.rules.delete'

beforeEach(() => {
  vi.clearAllMocks()
  serveRules([rule()])
})

describe('список правил: пять исходов (AC-a4)', () => {
  it('данные: колонки по ТЗ, триггер словами, пустые goal/валюта — прочерком', async () => {
    serveRules([
      rule(),
      rule({ id: 'r-2', name: 'Loan rule', trigger: 'new_loan', goal: null, currency: null }),
    ])
    renderSection()

    expect(await screen.findByText('Partner one — lead')).toBeInTheDocument()
    expect(screen.getByText('credit.postbacks.trigger.new_lead')).toBeInTheDocument()
    expect(screen.getByText('credit.postbacks.trigger.new_loan')).toBeInTheDocument()
    expect(screen.getAllByText('partner1')).toHaveLength(2)
    expect(screen.getByText('CAD')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    for (const header of [
      'credit.postbacks.rules.name',
      'credit.postbacks.rules.trigger',
      'utm_source',
      'credit.postbacks.rules.url',
      'credit.postbacks.rules.goal',
      'credit.postbacks.rules.currency',
      'credit.postbacks.rules.active',
      'credit.postbacks.rules.updatedAt',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('пусто: «Правил ще немає», кнопки добавления в a1 нет', async () => {
    serveRules([])
    renderSection()
    expect(await screen.findByText('credit.postbacks.rules.empty')).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('403: своё объяснение, а не экран «модуль недоступен»', async () => {
    api.rules.mockRejectedValue(new CreditApiError('Forbidden', 403, 'forbidden'))
    renderSection()
    expect(await screen.findByText('credit.postbacks.forbidden')).toBeInTheDocument()
    expect(screen.queryByText('credit.unavailable.title')).not.toBeInTheDocument()
  })

  it('5xx: экран «модуль недоступен», а не пустой список', async () => {
    api.rules.mockRejectedValue(new CreditApiError('Bad gateway', 502))
    renderSection()
    expect(await screen.findByText('credit.unavailable.title')).toBeInTheDocument()
    expect(screen.queryByText('credit.postbacks.rules.empty')).not.toBeInTheDocument()
  })

  it('загрузка: скелет таблицы, ни пустого списка, ни ошибки', () => {
    api.rules.mockImplementation(() => new Promise(() => {}))
    renderSection()
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('credit.postbacks.rules.empty')).not.toBeInTheDocument()
  })

  it.each([
    [503, 'credit.postbacks.refreshFailed'],
    [403, 'credit.postbacks.forbidden'],
  ])(
    'перечитка после вкл/выкл упала (%i) — список на месте, над ним предупреждение',
    async (status, message) => {
      renderSection()
      const toggle = await screen.findByRole('switch')
      api.rules.mockRejectedValue(new CreditApiError('Refresh failed', status))
      fireEvent.click(toggle)

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(screen.getByText('Partner one — lead')).toBeInTheDocument()
      // Действие удалось: в списке — положение из ответа двери.
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
      expect(screen.queryByText('credit.unavailable.title')).not.toBeInTheDocument()
    }
  )
})

describe('адрес партнёра (AC-a4, AC-a9, Р-18-13d-11)', () => {
  it('ячейка адреса под замазкой записи, адрес обрезан', async () => {
    renderSection()
    const shown = await screen.findByText(/^https:\/\/partner\.example\/postback/)
    expectObscured(shown)
    expect(shown.textContent).toMatch(/…$/)
    expect(shown.textContent?.length).toBeLessThan(LONG_URL.length)
  })

  it('полный адрес — кнопкой копирования, но ни в одном атрибуте', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderSection()
    await screen.findByText('Partner one — lead')

    fireEvent.click(screen.getByRole('button', { name: 'credit.postbacks.rules.copyUrl' }))
    expect(writeText).toHaveBeenCalledWith(LONG_URL)

    const leaks = [...document.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].filter((attribute) => attribute.value.includes(TOKEN))
    )
    expect(leaks.map((attribute) => attribute.name)).toEqual([])
  })

  it('полный адрес — в подсказке при наведении, и она под замазкой', async () => {
    const user = userEvent.setup()
    renderSection()
    await user.hover(await screen.findByText(/^https:\/\/partner\.example\/postback.*…$/))

    const revealed = await screen.findAllByText(LONG_URL)
    expect(revealed.length).toBeGreaterThan(0)
    for (const node of revealed) expectObscured(node)
  })
})

describe('перечни — открытые строки (AC-a8)', () => {
  it('неизвестный модулю триггер — сырым значением с пометкой, экран не падает', async () => {
    serveRules([rule({ trigger: 'loan_repaid' })])
    renderSection()
    expect(await screen.findByText('loan_repaid')).toBeInTheDocument()
    expect(screen.getByText('(credit.postbacks.unknownValue)')).toBeInTheDocument()
    expect(screen.queryByText('credit.postbacks.trigger.loan_repaid')).not.toBeInTheDocument()
  })
})

describe('вкл/выкл (AC-a7)', () => {
  it('одно нажатие — PATCH {active} с ключом; на время запроса выключен', async () => {
    let finish: (value: CreditPostbackRule) => void = () => {}
    api.updateRule.mockImplementation(
      () => new Promise<CreditPostbackRule>((resolve) => (finish = resolve))
    )
    renderSection()
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)

    await waitFor(() => expect(api.updateRule).toHaveBeenCalledTimes(1))
    const [id, patch, key] = api.updateRule.mock.calls[0]
    expect(id).toBe('r-1')
    expect(patch).toEqual({ active: false })
    expect(key).toMatch(/^fe-postback-rule:/)
    await waitFor(() => expect(screen.getByRole('switch')).toBeDisabled())
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')

    // Модуль принял правку: перечитанный после ответа список несёт новое положение.
    server = [rule({ active: false })]
    finish(rule({ active: false }))
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled())
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('отказ — переключатель в прежнем положении и сообщение', async () => {
    api.updateRule.mockRejectedValue(new CreditApiError('Boom', 500))
    renderSection()
    fireEvent.click(await screen.findByRole('switch'))

    expect(await screen.findByText('credit.postbacks.rules.toggleFailed')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch')).toBeEnabled()
  })

  it('отказ при зависшей перечитке — прежнее положение и сообщение сразу, не после GET', async () => {
    renderSection()
    const toggle = await screen.findByRole('switch')
    // Список больше не отвечает: перечитка после отказа повиснет.
    api.rules.mockImplementation(() => new Promise(() => {}))
    api.updateRule.mockRejectedValue(new CreditApiError('Boom', 500))
    fireEvent.click(toggle)

    expect(await screen.findByText('credit.postbacks.rules.toggleFailed')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch')).toBeEnabled()
    // Перечитка действительно ушла и висит — сообщение пришло не после неё.
    await waitFor(() => expect(api.rules.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('два нажатия — два разных ключа', async () => {
    renderSection()
    fireEvent.click(await screen.findByRole('switch'))
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'))
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled())
    fireEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(api.updateRule).toHaveBeenCalledTimes(2))

    const [first, second] = api.updateRule.mock.calls.map((call) => call[2])
    expect(first).not.toBe(second)
    expect(api.updateRule.mock.calls[1][1]).toEqual({ active: true })
  })

  it('сетевой отказ сам не повторяется; повтор того же действия несёт тот же ключ', async () => {
    // Так транспорт раздела отдаёт сетевой отказ: `toCreditError` без `code` axios.
    const networkError = toCreditError(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(networkError).toBeInstanceOf(CreditApiError)
    api.updateRule.mockRejectedValueOnce(networkError)
    const client = renderSection()
    fireEvent.click(await screen.findByRole('switch'))

    // Боевой предикат повтора такой отказ не повторяет: один запрос и сообщение.
    expect(await screen.findByText('credit.postbacks.rules.toggleFailed')).toBeInTheDocument()
    expect(api.updateRule).toHaveBeenCalledTimes(1)

    // Повтор того же действия — ручной `mutate` с теми же переменными мутации
    // (так же пошёл бы любой будущий автоповтор): ключ прежний, модуль не
    // выполнит действие дважды (Р-18-13d-9).
    const [failed] = client.getMutationCache().getAll()
    await act(async () => {
      await new QueryMutationObserver(client, failed.options).mutate(failed.state.variables)
    })
    expect(api.updateRule).toHaveBeenCalledTimes(2)
    const [first, repeated] = api.updateRule.mock.calls.map((call) => call[2])
    expect(repeated).toBe(first)
    expect(api.updateRule.mock.calls[1][1]).toEqual({ active: false })
  })

  it('предикат повтора сцен — копия боевого из main.tsx', () => {
    for (const line of MAIN_PREDICATE_LINES) expect(MAIN_SOURCE).toContain(line)
  })
})

describe('удаление (AC-a7, Р-18-13d-8)', () => {
  it('сначала подтверждение — запрос не уходит, пока не подтвердили', async () => {
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: DELETE }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('credit.postbacks.rules.deleteTitle')).toBeInTheDocument()
    expect(within(dialog).getByText('credit.postbacks.rules.deleteMessage')).toBeInTheDocument()
    // Необратимое действие — опасный тон: красная кнопка подтверждения (`tone="danger"`).
    const confirm = within(dialog).getByRole('button', { name: DELETE })
    expect(confirm).toHaveClass('bg-error-500')
    expect(confirm).not.toHaveClass('bg-primary-300')
    expect(api.deleteRule).not.toHaveBeenCalled()

    // Подпись отмены — общий словарь кита (`actions.cancel`, в моке — «Cancel»).
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.deleteRule).not.toHaveBeenCalled()
  })

  it('подтверждено — DELETE с ключом, строка исчезает, соседняя на месте', async () => {
    serveRules([rule(), rule({ id: 'r-2', name: 'Loan rule', trigger: 'new_loan' })])
    renderSection()
    await screen.findByText('Loan rule')
    fireEvent.click(screen.getAllByRole('button', { name: DELETE })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: DELETE }))

    await waitFor(() => expect(screen.queryByText('Partner one — lead')).not.toBeInTheDocument())
    expect(api.deleteRule).toHaveBeenCalledTimes(1)
    const [id, key] = api.deleteRule.mock.calls[0]
    expect(id).toBe('r-1')
    expect(key).toMatch(/^fe-postback-rule:/)
    expect(screen.getByText('Loan rule')).toBeInTheDocument()
  })

  it('отказ удаления — строка на месте и сообщение', async () => {
    api.deleteRule.mockRejectedValue(new CreditApiError('Boom', 500))
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: DELETE }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: DELETE }))

    expect(await screen.findByText('credit.postbacks.rules.deleteFailed')).toBeInTheDocument()
    expect(screen.getByText('Partner one — lead')).toBeInTheDocument()
  })
})

describe('без права записи (AC-a7, Р-18-13d-8)', () => {
  it('переключатели выключены, кнопок удаления в разметке нет', async () => {
    serveRules([rule(), rule({ id: 'r-2', name: 'Loan rule', active: false })])
    renderSection(false)
    await screen.findByText('Loan rule')

    const toggles = screen.getAllByRole('switch')
    expect(toggles).toHaveLength(2)
    for (const toggle of toggles) expect(toggle).toBeDisabled()
    expect(screen.queryByRole('button', { name: DELETE })).not.toBeInTheDocument()

    fireEvent.click(toggles[0])
    expect(api.updateRule).not.toHaveBeenCalled()
  })

  it('контроль: с правом записи те же правила дают кнопки и рабочие переключатели', async () => {
    serveRules([rule(), rule({ id: 'r-2', name: 'Loan rule', active: false })])
    renderSection(true)
    await screen.findByText('Loan rule')
    expect(screen.getAllByRole('button', { name: DELETE })).toHaveLength(2)
    for (const toggle of screen.getAllByRole('switch')) expect(toggle).toBeEnabled()
  })
})
