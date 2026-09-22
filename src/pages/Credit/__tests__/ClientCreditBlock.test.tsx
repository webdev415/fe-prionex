/**
 * Блок «Кредит (наш)» карточки клиента — сцены S-1…S-4, S-7, S-8, S-12, S-13.
 *
 * Мок двери построен ПО ФОРМЕ КОНТРАКТА дословно: двадцать четыре ключа и
 * обёртка `{items, next_cursor}`. Выдуманный вход проверяет только себя, а
 * поле, которое мок отдаёт иногда, учит потребителя писать обход.
 *
 * 🔴 Клиент запросов НЕ подменяется целиком: подменена одна функция
 * `creditApi.clientLoans`, а `CreditApiError`, хук и его настройки — настоящие.
 * Иначе сцена «повторов нет» мерила бы поведение мока.
 *
 * 🔴 `QueryClient` здесь собран С ТЕМИ ЖЕ дефолтами, что в приложении
 * (`main.tsx`): повтор разрешён, и правило «`isQueryRetryable` не видит
 * `CreditApiError`» действует ровно так же, как в бою. `QueryClient` с
 * `retry: false` в дефолтах сделал бы сцену S-12 зелёной при любом хуке.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ClientCreditBlock } from '../components/ClientCreditBlock'
import { CreditApiError, creditApi } from '@/features/credit/api/creditApi'
import { creditKeys } from '@/features/credit/hooks/useCredit'
import { clientKeys } from '@/features/clients/hooks/useClients'
import type { ClientLoanCard } from '@/features/credit/api/types'
import type { DebtDetail } from '@/features/clients/api/types'
import { useHasPermission } from '@/hooks/usePermissions'
// Статический импорт модуля хука — по тому же доводу, что в тесте карточки:
// `await import(...)` внутри сцены кладёт холодную загрузку в бюджет теста.
import * as creditHooks from '@/features/credit/hooks/useCredit'

vi.mock('@/features/credit/api/creditApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credit/api/creditApi')>()
  return {
    ...actual,
    creditApi: { ...actual.creditApi, clientLoans: vi.fn() },
  }
})

vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: vi.fn(() => true),
  useHasAnyPermission: vi.fn(() => true),
  useHasAllPermissions: vi.fn(() => true),
}))

const clientLoans = vi.mocked(creditApi.clientLoans)
const hasPermission = vi.mocked(useHasPermission)

/** Кредит класса А — все двадцать четыре ключа контракта, ни одним больше. */
const LOAN: ClientLoanCard = {
  loan_id: '11111111-1111-4111-8111-111111111111',
  contract_number: 'FB-000088',
  product_code: 'PDL-UA-30',
  status: 'delinquent',
  currency: 'UAH',
  jurisdiction: 'UA',
  principal_minor: 500000,
  balance_total_minor: 612300,
  paid_minor: 120000,
  overdue_minor: 98700,
  delinquency_days: 41,
  arrears_flag: true,
  no_contact_flag: false,
  default_reported_at: '2026-08-14',
  disbursed_at: '2026-06-01T09:15:00Z',
  maturity_date: '2026-07-01',
  next_payment: { due_date: '2026-09-25', amount_minor: 45600 },
  closed_at: null,
  close_reason: null,
  cancelled_at: null,
  return_pending: false,
  as_of: '2026-09-22',
  closed_through: '2026-09-21',
  module_url: '/dashboard/credit/loans/11111111-1111-4111-8111-111111111111',
}

/** Строка проекции `debts`, какой её кладёт в CRM кредитный модуль. */
const PROJECTION = {
  id: 9001,
  seller_company: '',
  contract_number: 'FB-000088',
  original_debt_amount: '5000.00',
  remaining_debt_amount: '6123.00',
  days_past_due: 41,
  status: 'active',
  origin: 'credit_module',
  loan_id: LOAN.loan_id,
  currency: 'UAH',
  lifecycle_detail: 'delinquent',
  lifecycle_updated_at: '2026-09-21T23:10:00Z',
} as unknown as DebtDetail

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Ровно то, что стоит в `main.tsx`: один повтор, кроме 401/403,
        // и статус читается у `AxiosError` — а `CreditApiError` им не является.
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } } | undefined)?.response?.status
          return failureCount < 1 && status !== 401 && status !== 403
        },
        refetchOnWindowFocus: false,
        // Пауза перед повтором сжата до мгновения намеренно: предмет сцены
        // S-12 — САМ ФАКТ повтора, а не его расписание. С умолчанием (первая
        // пауза около секунды) «повтора нет» зеленело бы просто потому, что
        // второй запрос ещё не успел уйти — ровно так эта сцена и промолчала
        // на мутации M3, пока её не поймал соседний случай.
        retryDelay: 5,
      },
    },
    // Молчим о ловленых отказах: предмет сцен — экран, а не вывод консоли.
    logger: undefined,
  } as ConstructorParameters<typeof QueryClient>[0])
}

function renderBlock(
  ui: { projections?: DebtDetail[]; enabled?: boolean } = {},
  client: QueryClient = makeClient()
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  const result = render(
    <ClientCreditBlock
      clientId={42}
      projections={ui.projections ?? []}
      enabled={ui.enabled ?? true}
    />,
    { wrapper }
  )
  return { ...result, client }
}

/** Форма ответа хука — подменяется в сценах «ответа ещё нет» и «сеть пропала». */
type CreditLoansResult = ReturnType<
  (typeof import('@/features/credit/hooks/useCredit'))['useClientCreditLoans']
>

/**
 * Значение поля по его подписи.
 *
 * Читает пару «подпись → значение» в разметке блока, а не ищет подстроку в
 * тексте всей карточки: `toContain('UA')` выполняется внутри «5,000.00 UAH», и
 * такая проверка не может покраснеть за своё поле.
 */
function fieldValue(container: HTMLElement, label: string): string | null {
  for (const row of container.querySelectorAll('div')) {
    const [labelNode, valueNode] = Array.from(row.children)
    if (labelNode?.textContent?.trim() === label && valueNode) {
      return valueNode.textContent?.trim() ?? null
    }
  }
  return null
}

beforeEach(() => {
  vi.clearAllMocks()
  hasPermission.mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

describe('S-1: класс А рисуется целиком', () => {
  it('показывает договор, статус, деньги, просрочку, даты и ссылку', async () => {
    clientLoans.mockResolvedValue({ items: [LOAN], next_cursor: null })
    const { container } = renderBlock()

    await screen.findByText('FB-000088')
    const text = container.textContent ?? ''

    // договор и статус
    expect(text).toContain('FB-000088')
    expect(text).toContain('PDL-UA-30')
    expect(text).toContain('credit.loanStatus.delinquent')
    // Юрисдикция — ЗНАЧЕНИЕМ рядом со своей подписью, а не подстрокой «UA»:
    // она содержится и в «5,000.00 UAH», то есть проверка `toContain('UA')`
    // выполнялась бы и при удалённом поле.
    expect(fieldValue(container, 'credit.clientBlock.jurisdiction')).toBe('UA')
    // деньги — через форматтер модуля, то есть с валютой строки и из минорных
    expect(fieldValue(container, 'credit.clientBlock.issued')).toBe('5,000.00 UAH')
    expect(fieldValue(container, 'credit.clientBlock.outstanding')).toBe('6,123.00 UAH')
    expect(fieldValue(container, 'credit.clientBlock.paid')).toBe('1,200.00 UAH')
    expect(fieldValue(container, 'credit.clientBlock.overdue')).toBe('987.00 UAH')
    // просрочка: DPD и три её атрибута — со ЗНАЧЕНИЯМИ, иначе перевёрнутые
    // флаги («недоимки нет» вместо «есть») не покраснели бы ничем
    expect(fieldValue(container, 'credit.clientBlock.dpd')).toBe('41')
    expect(fieldValue(container, 'credit.clientBlock.arrears')).toBe('common.yes')
    expect(fieldValue(container, 'credit.clientBlock.noContact')).toBe('common.no')
    expect(fieldValue(container, 'credit.clientBlock.defaultReported')).toBe('14-08-2026')
    // даты: момент зачисления — в зоне юрисдикции (UA, +03 к метке 09:15Z)
    expect(fieldValue(container, 'credit.clientBlock.disbursed')).toBe('01-06-2026 12:15')
    expect(fieldValue(container, 'credit.clientBlock.maturity')).toBe('01-07-2026')
    // следующий платёж: дата И сумма (минорные единицы на экране = «45600 грн»
    // в разговоре с человеком)
    expect(fieldValue(container, 'credit.clientBlock.nextPayment')).toBe('25-09-2026 · 456.00 UAH')
    expect(fieldValue(container, 'credit.clientBlock.closed')).toBe('—')
    expect(fieldValue(container, 'credit.clientBlock.cancelled')).toBe('—')
    // «станом на» — рядом с деньгами, ДНЁМ, а не ключом
    expect(text).toContain('As of 22-09-2026')
    expect(text).toContain('credit.clientBlock.closedThrough')
    expect(text).toContain('21-09-2026')
    // ссылка в модуль — относительным путём внутри CRM
    expect(screen.getByRole('link', { name: 'credit.clientBlock.openInModule' })).toHaveAttribute(
      'href',
      '/dashboard/credit/loans/11111111-1111-4111-8111-111111111111'
    )
  })

  it('без права credit.loans.read ссылки в модуль нет, а данные остаются', async () => {
    // Локальное право решает РОВНО ссылку: дверь ответила 200, значит модуль
    // человека пустил, и прятать от него цифры было бы вторым, чужим замером.
    hasPermission.mockReturnValue(false)
    clientLoans.mockResolvedValue({ items: [LOAN], next_cursor: null })
    renderBlock()

    await screen.findByText('FB-000088')
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('S-2: класс Б не рисуется', () => {
  it('ни одно поле класса Б не доезжает до экрана', async () => {
    // Маркеры уникальны намеренно: случайное совпадение с версткой исключено,
    // а «ничего не найдено» на пустом экране ловится положительным контролем.
    const withClassB = {
      ...LOAN,
      portal_events: ['ZZ-portal-events'],
      disbursement: { provider: 'ZZ-disbursement' },
      schedule_version: 'ZZ-schedule-version',
      advance_refund_excess_minor: 777777,
      balances: { total_due_minor: 888888 },
      client_email: 'ZZ-client-email@example.org',
    }
    clientLoans.mockResolvedValue({ items: [withClassB], next_cursor: null })
    const { container } = renderBlock()

    await screen.findByText('FB-000088')
    const text = container.textContent ?? ''

    // положительный контроль: класс А на экране ЕСТЬ
    expect(text).toContain('FB-000088')
    expect(text).toContain('6,123.00 UAH')

    for (const marker of [
      'ZZ-portal-events',
      'ZZ-disbursement',
      'ZZ-schedule-version',
      '777777',
      '7,777.77',
      '888888',
      '8,888.88',
      'ZZ-client-email',
    ]) {
      expect(text, `поле класса Б доехало до карточки клиента: ${marker}`).not.toContain(marker)
    }
  })
})

describe('S-3: кредитов нет — это норма, а не ошибка', () => {
  it('говорит «кредитів немає», без алерта и без console.error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    clientLoans.mockResolvedValue({ items: [], next_cursor: null })
    const { container } = renderBlock()

    await screen.findByText('credit.clientBlock.noLoans')
    // положительный контроль: блок отрисован (иначе «алерта нет» зеленело бы
    // на пустом экране)
    expect(screen.getByText('credit.clientBlock.title')).toBeInTheDocument()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('S-4: 403 — блок показывает проекцию, а не ошибку', () => {
  it('рисует строку из debts, валюту, стадию и пометки — без ссылки в модуль', async () => {
    clientLoans.mockRejectedValue(new CreditApiError('forbidden', 403, 'forbidden'))
    const { container } = renderBlock({ projections: [PROJECTION] })

    await screen.findByText('FB-000088')
    // Значения по подписям, а не подстроки: `delinquent` встречается в тексте
    // и сам по себе (`lifecycle_detail`), то есть склейка со статусом не
    // проверялась бы ничем.
    expect(fieldValue(container, 'credit.clientBlock.issued')).toBe('5000.00 UAH')
    expect(fieldValue(container, 'credit.clientBlock.outstanding')).toBe('6123.00 UAH')
    expect(fieldValue(container, 'credit.clientBlock.dpd')).toBe('41')
    expect(fieldValue(container, 'credit.clientBlock.status')).toBe('active · delinquent')
    const text = container.textContent ?? ''
    expect(text).toContain('credit.clientBlock.projectionAsOf')
    expect(text).toContain('credit.clientBlock.projectionOnly')
    // Плашка называет ПРИЧИНУ, по которой живых данных нет.
    expect(screen.getByText('credit.access.noRights')).toBeInTheDocument()
    // ссылки в модуль нет: права нет
    expect(screen.queryByRole('link')).toBeNull()
    // и это НЕ состояние «модуль недоступен»
    expect(screen.queryByText('credit.clientBlock.moduleUnavailable')).toBeNull()
  })

  it('🔴 день проекции считается в зоне юрисдикции, а не браузера', async () => {
    // `2026-09-21T23:10:00Z` — это 21 сентября в Лондоне и уже 22-е в Киеве.
    // Печатая метку в зоне машины, экран показал бы киевскому оператору
    // вчерашний день, и он спорил бы о нём с клиентом. Час и дата видны обе.
    clientLoans.mockRejectedValue(new CreditApiError('forbidden', 403, 'forbidden'))
    const { container } = renderBlock({ projections: [PROJECTION] })
    await screen.findByText('FB-000088')
    expect(container.textContent).toContain('22-09-2026 02:10')
    expect(container.textContent).not.toContain('21-09-2026 23:10')
  })

  it('403 без проекций — «нет доступа», а не «кредитів немає»', async () => {
    // «Кредитів немає» — уверенное отрицание. Оператору, которому в данных
    // отказано, сказать его нельзя: кредит может быть, просто он его не видит.
    clientLoans.mockRejectedValue(new CreditApiError('forbidden', 403, 'forbidden'))
    renderBlock({ projections: [] })
    await screen.findByText('credit.access.noRights')
    expect(screen.queryByText('credit.clientBlock.noLoans')).toBeNull()
    expect(screen.queryByText('credit.clientBlock.moduleUnavailable')).toBeNull()
  })
})

describe('P-4: четыре состояния отказа различены, и долг виден при каждом', () => {
  it.each([
    ['401 — пропуск истёк', 401, 'credit.access.notAuthenticated'],
    ['403 — прав не хватило', 403, 'credit.access.noRights'],
    ['404 — модуля нет на контуре', 404, 'credit.clientBlock.moduleUnavailable'],
    ['500 — временный сбой', 500, 'credit.clientBlock.temporaryFailure'],
    ['503 — временный сбой', 503, 'credit.clientBlock.temporaryFailure'],
  ])('%s', async (_name, status, noticeKey) => {
    clientLoans.mockRejectedValue(new CreditApiError('denied', status, undefined))
    const { container } = renderBlock({ projections: [PROJECTION] })

    await screen.findByText(noticeKey)
    // 🔴 Главное утверждение: долг на экране ЕСТЬ. Строку уже убрали из
    // «Позики», и блок — единственное место, где человек её увидит.
    expect(screen.getByText('FB-000088')).toBeInTheDocument()
    // и ни одна чужая плашка рядом не висит
    for (const other of [
      'credit.access.notAuthenticated',
      'credit.access.noRights',
      'credit.clientBlock.moduleUnavailable',
      'credit.clientBlock.temporaryFailure',
    ].filter((key) => key !== noticeKey)) {
      expect(screen.queryByText(other), `рядом с ${noticeKey} висит ${other}`).toBeNull()
    }
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('сетевой отказ (не CreditApiError) — плашка временного сбоя и долг на экране', async () => {
    // Второй объявленный вход состояния D: у такой ошибки статуса нет вовсе.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    clientLoans.mockRejectedValue(new Error('Network Error'))
    const { container } = renderBlock({ projections: [PROJECTION] })

    await screen.findByText('credit.clientBlock.temporaryFailure')
    expect(screen.getByText('FB-000088')).toBeInTheDocument()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).not.toContain('Network Error')
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('P-22: 200 с пустым списком при непустой проекции — расхождение связи', () => {
  it('говорит о неподтверждённой связи и показывает проекцию', async () => {
    clientLoans.mockResolvedValue({ items: [], next_cursor: null })
    renderBlock({ projections: [PROJECTION] })

    await screen.findByText('credit.clientBlock.linkNotFound')
    // Долг на экране — и это НЕ «кредитів немає»: отрицать кредит, который
    // CRM сама же хранит, нельзя.
    expect(screen.getByText('FB-000088')).toBeInTheDocument()
    expect(screen.queryByText('credit.clientBlock.noLoans')).toBeNull()
  })

  it('контрольная половина: пусто и в модуле, и в проекции — «кредитів немає»', async () => {
    clientLoans.mockResolvedValue({ items: [], next_cursor: null })
    renderBlock({ projections: [] })
    await screen.findByText('credit.clientBlock.noLoans')
    expect(screen.queryByText('credit.clientBlock.linkNotFound')).toBeNull()
  })
})

describe('P-9: ДЕНЬ поля карточки считается по юрисдикции, а не по зоне машины', () => {
  it.each([
    ['UK — Лондон, летом +01: ещё 21-е', 'UK', '21-09-2026 23:30'],
    ['UA — Киев, +03: уже 22-е', 'UA', '22-09-2026 01:30'],
  ])('%s', async (_name, jurisdiction, expected) => {
    // Один и тот же момент `2026-09-21T22:30:00Z` — и РАЗНЫЕ дни у двух
    // юрисдикций. Спорить с клиентом оператор будет о дне, а прежние сцены
    // держали только час: все метки фикстуры лежали внутри суток.
    clientLoans.mockResolvedValue({
      items: [{ ...LOAN, jurisdiction, closed_at: '2026-09-21T22:30:00Z' }],
      next_cursor: null,
    })
    const { container } = renderBlock()

    await screen.findByText('FB-000088')
    expect(fieldValue(container, 'credit.clientBlock.closed')).toBe(expected)
  })

  it('передача дефолта в бюро — тоже момент, а не календарная дата', async () => {
    // P-5 назвал это поле моментом, а печаталось оно календарём браузера:
    // метка за час до полуночи давала оператору вчерашний день.
    clientLoans.mockResolvedValue({
      items: [{ ...LOAN, jurisdiction: 'UA', default_reported_at: '2026-08-14T23:10:00Z' }],
      next_cursor: null,
    })
    const { container } = renderBlock()

    await screen.findByText('FB-000088')
    expect(fieldValue(container, 'credit.clientBlock.defaultReported')).toBe('15-08-2026 02:10')
  })
})

describe('P-3: приостановленный запрос — это не «кредитов нет»', () => {
  it('без сети показывает временный сбой и долг из проекции', async () => {
    // Оффлайн react-query держит запрос в `paused`: ошибки нет, данных нет,
    // ответа не было. Прежняя ветка читала это как «200 с пустым списком» и
    // уверенно отрицала долг, которого дверь не подтверждала.
    const spy = vi.spyOn(creditHooks, 'useClientCreditLoans')
    spy.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      isPaused: true,
      isLoading: false,
    } as unknown as CreditLoansResult)

    renderBlock({ projections: [PROJECTION] })

    await screen.findByText('credit.clientBlock.temporaryFailure')
    expect(screen.getByText('FB-000088')).toBeInTheDocument()
    expect(screen.queryByText('credit.clientBlock.noLoans')).toBeNull()
    expect(screen.queryByText('credit.clientBlock.linkNotFound')).toBeNull()
    spy.mockRestore()
  })

  it('ответ ещё не пришёл — скелет, а не утверждение о долге', async () => {
    const spy = vi.spyOn(creditHooks, 'useClientCreditLoans')
    spy.mockReturnValue({
      data: undefined,
      error: null,
      isPending: true,
      isPaused: false,
      isLoading: true,
    } as unknown as CreditLoansResult)

    const { container } = renderBlock({ projections: [PROJECTION] })
    expect(container.querySelector('[data-testid="client-credit-block-loading"]')).toBeTruthy()
    expect(screen.queryByText('credit.clientBlock.noLoans')).toBeNull()
    spy.mockRestore()
  })
})

describe('P-8: суммы форматируются валютой строки, а не гривной карточки', () => {
  it('канадский кредит показан в CAD', async () => {
    clientLoans.mockResolvedValue({
      items: [{ ...LOAN, currency: 'CAD', jurisdiction: 'CA-AB' }],
      next_cursor: null,
    })
    const { container } = renderBlock()

    await screen.findByText('FB-000088')
    expect(fieldValue(container, 'credit.clientBlock.outstanding')).toBe('6,123.00 CAD')
    expect(fieldValue(container, 'credit.clientBlock.issued')).toBe('5,000.00 CAD')
    expect(fieldValue(container, 'credit.clientBlock.jurisdiction')).toBe('CA-AB')
    expect(container.textContent).not.toContain('UAH')
    // Момент зачисления — по календарю ТОЙ юрисдикции: 09:15Z в Эдмонтоне это
    // 03:15 того же дня, а не 12:15 киевского.
    expect(fieldValue(container, 'credit.clientBlock.disbursed')).toBe('01-06-2026 03:15')
  })
})

describe('S-7: 404 шлюза — нейтральная плашка', () => {
  it('объясняет состояние словами, без алерта и без консоли', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    clientLoans.mockRejectedValue(new CreditApiError('no Route matched', 404, undefined))
    const { container } = renderBlock()

    await screen.findByText('credit.clientBlock.moduleUnavailable')
    // положительный контроль: заголовок блока на месте
    expect(screen.getByText('credit.clientBlock.title')).toBeInTheDocument()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).not.toContain('no Route matched')
    expect(consoleError).not.toHaveBeenCalled()
    expect(clientLoans).toHaveBeenCalledTimes(1)
  })
})

describe('S-8: return_pending — кредит не называется погашенным', () => {
  it('при нулевом остатке и дате закрытия показывает ожидание возврата', async () => {
    clientLoans.mockResolvedValue({
      items: [
        {
          ...LOAN,
          balance_total_minor: 0,
          closed_at: '2026-09-10T12:00:00Z',
          close_reason: 'cancelled',
          cancelled_at: '2026-09-09T08:00:00Z',
          return_pending: true,
        },
      ],
      next_cursor: null,
    })
    const { container } = renderBlock()

    await screen.findByText('FB-000088')
    const text = container.textContent ?? ''
    expect(text).toContain('credit.clientBlock.returnPending')
    // положительный контроль: блок отрисовал карточку, а не пустоту
    expect(text).toContain('0.00 UAH')
    // и ни одного слова о погашении
    expect(text).not.toContain('credit.closeReason.')
    // Дата закрытия и дата отказа — РАЗНЫЕ юридические факты, и перепутать их
    // местами нельзя: здесь они разведены на сутки и читаются каждая под своей
    // подписью, в зоне юрисдикции (метки 12:00Z и 08:00Z, UA = +03).
    expect(fieldValue(container, 'credit.clientBlock.closed')).toBe('10-09-2026 15:00')
    expect(fieldValue(container, 'credit.clientBlock.cancelled')).toBe('09-09-2026 11:00')
  })

  it('без return_pending погашенный кредит называет причину закрытия', async () => {
    // Контрольный случай: без него проверка выше зеленела бы на экране, где
    // причину закрытия не рисуют никогда.
    clientLoans.mockResolvedValue({
      items: [
        {
          ...LOAN,
          balance_total_minor: 0,
          closed_at: '2026-09-10T12:00:00Z',
          close_reason: 'repaid',
          return_pending: false,
        },
      ],
      next_cursor: null,
    })
    const { container } = renderBlock()
    await screen.findByText('FB-000088')
    expect(container.textContent).toContain('credit.closeReason.repaid')
  })
})

describe('S-12: отказ двери не повторяется', () => {
  it.each([
    ['403', 403],
    ['404', 404],
  ])('%s — ровно один запрос', async (_name, status) => {
    clientLoans.mockRejectedValue(new CreditApiError('denied', status, undefined))
    renderBlock({ projections: [PROJECTION] })

    await waitFor(() => expect(clientLoans).toHaveBeenCalled())
    // Даём повтору шанс случиться: без паузы проверка «повтора нет» зеленела
    // бы просто потому, что второй запрос ещё не успел уйти. Пауза — с запасом
    // к `retryDelay: 5` тестового клиента.
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(clientLoans).toHaveBeenCalledTimes(1)
  })

  it('положительный контроль: у соседа с теми же дефолтами повтор происходит', async () => {
    // Тот же QueryClient, тот же класс ошибки — и без `retry: false` запрос
    // уходит ДВАЖДЫ. Значит сцены выше меряют настройку хука, а не дефолты
    // тестового клиента.
    const client = makeClient()
    const queryFn = vi.fn().mockRejectedValue(new CreditApiError('denied', 404, undefined))
    function Probe() {
      useQuery({ queryKey: ['probe'], queryFn, retry: undefined })
      return null
    }
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    )
    // «Больше одного», а не ровно два: предмет контроля — что повтор при этих
    // дефолтах ВООБЩЕ происходит. Точное число зависит от числа подписчиков и
    // к настройке хука отношения не имеет.
    await waitFor(() => expect(queryFn.mock.calls.length).toBeGreaterThan(1), { timeout: 2000 })
  })
})

describe('r4: холодная загрузка страницы вне бюджета теста', () => {
  it('🔴 тест карточки импортирует ClientDetailPage статически', () => {
    // Страж возврата дефекта, из-за которого CI краснел дважды подряд (прогоны
    // 80788 и 80918): `await import('../ClientDetailPage')` внутри `renderCard`
    // клал холодную загрузку страницы со всем её деревом зависимостей в бюджет
    // ПЕРВОГО теста файла. Под покрытием и пятьюдесятью двумя форками она не
    // укладывалась в двадцать секунд, и сгорали пять первых сцен подряд, ожидая
    // один и тот же незавершённый промис; шестая проходила за секунду.
    //
    // Замер на перегруженной машине (24 ядра, `--coverage --maxWorkers=52`):
    // первый тест 20396 мс с таймаутом против 235 мс после правки.
    //
    // Проверка живёт ЗДЕСЬ, а не в самом карточном тесте: глоб сборщика не
    // отдаёт модулю его собственный исходник, и страж там читал бы пустоту.
    const sources = import.meta.glob('../../ClientManagement/__tests__/*.test.tsx', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const card = Object.entries(sources).find(([path]) =>
      path.endsWith('clientCardCreditBlock.test.tsx')
    )?.[1]
    expect(card, 'исходник теста карточки не прочитан — проверять нечего').toBeTruthy()

    // Положительный контроль: статический импорт в файле ЕСТЬ.
    expect(card).toMatch(/^import ClientDetailPage from '\.\.\/ClientDetailPage'$/m)
    // Исполняемой формы динамического импорта страницы быть не должно
    // (упоминание в комментарии шапки не считается — ищем присваивание).
    expect(card).not.toMatch(/=\s*await import\(['"]\.\.\/ClientDetailPage['"]\)/)
  })
})

describe('S-13: ключи кэша не пересекаются', () => {
  it('кредиты модуля и купленные долги лежат под разными ключами', async () => {
    const client = makeClient()
    clientLoans.mockResolvedValue({ items: [LOAN], next_cursor: null })
    // Купленные долги кладёт в кэш сосед — тем ключом, который у клиентов
    // занят с KAN-993.
    client.setQueryData(clientKeys.loans(42), [PROJECTION])

    renderBlock({}, client)
    await screen.findByText('FB-000088')

    const debts = client.getQueryData(clientKeys.loans(42))
    const credit = client.getQueryData(creditKeys.clientLoans(42))
    expect(Array.isArray(debts), 'ключ клиентов перезаписан ответом модуля').toBe(true)
    expect((debts as DebtDetail[])[0].contract_number).toBe('FB-000088')
    expect(credit).toEqual({ items: [LOAN], next_cursor: null })
    // Ключи действительно разные — и это утверждение о ФОРМЕ, а не о совпадении
    // содержимого.
    expect(creditKeys.clientLoans(42)).not.toEqual(clientKeys.loans(42))
    expect(creditKeys.clientLoans(42)[0]).toBe('credit')
  })
})
