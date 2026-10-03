/**
 * Настройки → Постбеки партнерам → «Лог» (18-13d-b).
 *
 * Что держим (AC-b1…AC-b6, К-1…К-8):
 *  - подвкладка читается из URL (`pb_view`, по умолчанию «Правила»); лог не
 *    запрашивается, пока его не открыли; на «Правила» фильтры лога из ссылки
 *    снимаются (ревью бота, Б-3);
 *  - пять фильтров — серверные: каждый уходит параметром двери под её именем,
 *    состояние — из `pb_*` ссылки; мусор и недописанный UUID в запрос не уходят,
 *    перевёрнутый период — целиком; строки страницы на клиенте не отбираются;
 *  - таблица: подписи исходов, причин и кодов `last_error`, сырой код с пометкой
 *    у неизвестного; «сторновано» — по `reversed_at`, не по причине пропуска;
 *    ссылка на карточку заявки или кредита по триггеру — только зрителю с правом
 *    её маршрута, остальным номер и копирование ID (Б-1); правило вне списка —
 *    «видалено»;
 *  - итоговый URL — под замазкой записи, полный — копированием, не в атрибутах;
 *    у пропуска — «—»;
 *  - «Назад / Далі» по стеку курсоров, «Далі» выключена без `next_cursor`, смена
 *    фильтра (и возврат к прежнему набору) — снова первая страница; размер
 *    страницы 25; ввод, не меняющий запрос (недописанный UUID), страницу не
 *    сбрасывает (Б-2); прежняя страница держится только при листании тех же фильтров;
 *    после сбоя страницы «Назад» остаётся;
 *  - «Оновити» и возврат на вкладку браузера перечитывают, таймера нет;
 *  - 403, сеть/5xx, пусто (с фильтрами и без), сбой перечитки при данных.
 *
 * Хуки настоящие, QueryClient — с умолчаниями `main.tsx`, влияющими на лог
 * (`refetchOnWindowFocus: false`, `staleTime` 5 мин): так видно, что перечитку
 * при возврате включает сам хук. Подменён только транспорт.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { CreditPostbacksSection } from '../components/CreditPostbacksSection'
import { CreditApiError } from '@/features/credit/api/creditApi'
import {
  creditPostbacksApi,
  type CreditPostbackDelivery,
  type CreditPostbackDeliveryList,
  type CreditPostbackRule,
} from '@/features/credit/api/postbacks'
import { useAuthStore } from '@/stores/authStore'
import { expectObscured } from '@/test/piiHelpers'

vi.mock('@/features/credit/api/postbacks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credit/api/postbacks')>()
  return {
    ...actual,
    creditPostbacksApi: {
      rules: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      listDeliveries: vi.fn(),
    },
  }
})

vi.mock('@/components/ui/TableSkeleton', () => ({
  TableSkeleton: ({ columns }: { columns?: number }) => (
    <div data-testid="table-skeleton" data-columns={columns} />
  ),
}))

const api = vi.mocked(creditPostbacksApi)

const RULE_ID = '9b0f6a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b'
const GONE_RULE_ID = '0f0f0f0f-1111-4222-8333-444455556666'
const APP_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const LOAN_ID = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a'
/** Синтетический токен партнёра: по нему ищем утечку адреса в атрибуты. */
const TOKEN = 'tok-synthetic-0000'
const URL_SENT = `https://partner.example/postback?clickid=abc123&action_id=${APP_ID}&goal=1&key=${TOKEN}`

const RULE: CreditPostbackRule = {
  id: RULE_ID,
  name: 'Partner one — lead',
  active: true,
  trigger: 'new_lead',
  utm_source: 'partner1',
  url_template: 'https://partner.example/postback?clickid={click_id}',
  goal: '1',
  currency: 'CAD',
  created_at: '2026-10-02T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  created_by: 7,
  updated_by: 7,
}

function delivery(patch: Partial<CreditPostbackDelivery> = {}): CreditPostbackDelivery {
  return {
    id: 1,
    rule_id: RULE_ID,
    rule_name: 'Partner one — lead',
    trigger: 'new_lead',
    action_id: APP_ID,
    action_number: 'APP-0001',
    status: 'sent',
    skip_reason: null,
    url: URL_SENT,
    response_code: 200,
    attempts: 1,
    created_at: '2026-10-03T08:00:00Z',
    sent_at: '2026-10-03T08:00:05Z',
    next_attempt_at: null,
    reversed_at: null,
    last_error: null,
    ...patch,
  }
}

const page = (
  items: CreditPostbackDelivery[],
  next_cursor: string | null = null
): CreditPostbackDeliveryList => ({ items, next_cursor })

function serveRules(): void {
  api.rules.mockResolvedValue({
    items: [RULE],
    triggers: [
      { code: 'new_lead', amount_allowed: false },
      { code: 'new_loan', amount_allowed: true },
    ],
    macros: ['click_id', 'action_id', 'goal', 'amount', 'currency'],
  })
}

/** Права CRM зрителя (JWT активного проекта): по ним таблица решает ссылку на карточку. */
function signIn(permissions: string[]): void {
  useAuthStore.setState({
    user: { id: '1', username: 'u', projects: [], active_project_id: '7', permissions } as never,
  })
}

/** Строка запроса текущего адреса — по ней видно, что осталось в ссылке. */
function SearchProbe() {
  return <output data-testid="search">{useLocation().search}</output>
}

function renderLog(search = '?pb_view=log'): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      // Умолчания `main.tsx`, влияющие на лог: без них перечитку при возврате
      // включало бы умолчание TanStack, а не хук.
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
  render(
    <MemoryRouter initialEntries={[`/dashboard/credit/settings${search}`]}>
      <QueryClientProvider client={client}>
        <CreditPostbacksSection canWrite={false} />
        <SearchProbe />
      </QueryClientProvider>
    </MemoryRouter>
  )
  return client
}

/** Параметры последнего вызова двери лога. */
const lastCall = () => api.listDeliveries.mock.calls.at(-1)?.[0]

const LOG_TAB = 'credit.postbacks.log.tabs.log'
const RULES_TAB = 'credit.postbacks.log.tabs.rules'
const NEXT = 'credit.postbacks.log.next'
const PREV = 'credit.postbacks.log.prev'
const REFRESH = 'credit.postbacks.log.refresh'

beforeEach(() => {
  vi.clearAllMocks()
  serveRules()
  api.listDeliveries.mockResolvedValue(page([delivery()]))
})

afterEach(() => {
  focusManager.setFocused(undefined)
  useAuthStore.setState({ user: null })
})

describe('подвкладки «Правила / Лог» (AC-b1, К-1)', () => {
  it('без pb_view — правила; лог не запрашивается', async () => {
    renderLog('')
    expect(await screen.findByText('credit.postbacks.rules.name')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: RULES_TAB })).toHaveAttribute('aria-selected', 'true')
    expect(api.listDeliveries).not.toHaveBeenCalled()
  })

  it('pb_view=log — лог с первой страницы, 25 строк, без фильтров', async () => {
    renderLog()
    expect(await screen.findByText('APP-0001')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: LOG_TAB })).toHaveAttribute('aria-selected', 'true')
    expect(api.listDeliveries).toHaveBeenCalledTimes(1)
    expect(lastCall()).toEqual({
      rule_id: undefined,
      status: undefined,
      trigger: undefined,
      action_id: undefined,
      created_from: undefined,
      created_to: undefined,
      limit: 25,
      cursor: undefined,
    })
  })

  it('нажатие «Лог» открывает журнал', async () => {
    renderLog('')
    await screen.findByText('credit.postbacks.rules.name')
    fireEvent.click(screen.getByRole('tab', { name: LOG_TAB }))
    expect(await screen.findByText('APP-0001')).toBeInTheDocument()
  })

  it('на «Правила» фильтры лога уходят из ссылки; обратно в «Лог» — без фильтров', async () => {
    renderLog(`?pb_view=log&pb_rule=${RULE_ID}&pb_outcome=failed`)
    await waitFor(() => expect(lastCall()).toMatchObject({ status: 'failed', rule_id: RULE_ID }))

    fireEvent.click(screen.getByRole('tab', { name: RULES_TAB }))
    await screen.findByText('credit.postbacks.rules.name')
    const search = new URLSearchParams(screen.getByTestId('search').textContent ?? '')
    expect(search.get('pb_view')).toBe('rules')
    expect(search.has('pb_rule')).toBe(false)
    expect(search.has('pb_outcome')).toBe(false)

    fireEvent.click(screen.getByRole('tab', { name: LOG_TAB }))
    await screen.findByText('APP-0001')
    expect(screen.getByLabelText('credit.postbacks.log.filters.outcome')).toHaveValue('')
    expect(screen.getByLabelText('credit.postbacks.log.filters.rule')).toHaveValue('')
    expect(lastCall()).toMatchObject({ status: undefined, rule_id: undefined, cursor: undefined })
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
  })
})

describe('фильтры — серверные, из ссылки (AC-b3, К-2, К-8)', () => {
  it('пять фильтров ссылки уходят параметрами двери под её именами', async () => {
    renderLog(
      `?pb_view=log&pb_rule=${RULE_ID}&pb_outcome=skipped&pb_trigger=new_lead` +
        `&pb_action=${APP_ID}&pb_from=2026-10-01&pb_to=2026-10-03`
    )
    await waitFor(() => expect(api.listDeliveries).toHaveBeenCalled())
    expect(lastCall()).toMatchObject({
      rule_id: RULE_ID,
      status: 'skipped',
      trigger: 'new_lead',
      action_id: APP_ID,
      created_from: '2026-10-01',
      created_to: '2026-10-03',
      limit: 25,
    })
  })

  it.each([
    ['правило', 'credit.postbacks.log.filters.rule', RULE_ID, { rule_id: RULE_ID }],
    ['исход', 'credit.postbacks.log.filters.outcome', 'failed', { status: 'failed' }],
    ['триггер', 'credit.postbacks.log.filters.trigger', 'new_loan', { trigger: 'new_loan' }],
  ])('%s из списка уходит в запрос', async (_name, label, value, expected) => {
    renderLog()
    await screen.findByText('APP-0001')
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
    await waitFor(() => expect(lastCall()).toMatchObject(expected))
  })

  it('ID действия — только полный UUID; недописанный не уходит и подсвечен', async () => {
    renderLog()
    await screen.findByText('APP-0001')
    const field = screen.getByLabelText('credit.postbacks.log.filters.action')
    fireEvent.change(field, { target: { value: APP_ID.slice(0, 12) } })
    expect(
      await screen.findByText('credit.postbacks.log.filters.actionInvalid')
    ).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(lastCall()?.action_id).toBeUndefined()

    fireEvent.change(field, { target: { value: ` ${APP_ID} ` } })
    await waitFor(() => expect(lastCall()).toMatchObject({ action_id: APP_ID }))
  })

  it('период: «з» и «по» уходят как created_from / created_to, подписано UTC', async () => {
    renderLog()
    await screen.findByText('APP-0001')
    expect(screen.getByText('credit.postbacks.log.filters.utc')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('credit.postbacks.log.filters.from'), {
      target: { value: '2026-10-01' },
    })
    await waitFor(() => expect(lastCall()).toMatchObject({ created_from: '2026-10-01' }))
    fireEvent.change(screen.getByLabelText('credit.postbacks.log.filters.to'), {
      target: { value: '2026-10-02' },
    })
    await waitFor(() =>
      expect(lastCall()).toMatchObject({ created_from: '2026-10-01', created_to: '2026-10-02' })
    )
  })

  it('мусор ссылки и перевёрнутый период в запрос не уходят', async () => {
    renderLog(
      '?pb_view=log&pb_rule=r-1&pb_outcome=bounced&pb_trigger=loan_repaid' +
        '&pb_from=2026-10-05&pb_to=2026-10-01'
    )
    await waitFor(() => expect(api.listDeliveries).toHaveBeenCalled())
    expect(lastCall()).toMatchObject({
      rule_id: undefined,
      status: undefined,
      trigger: undefined,
      created_from: undefined,
      created_to: undefined,
    })
    expect(screen.getByText('credit.postbacks.log.filters.inverted')).toBeInTheDocument()
  })

  it('клиентской фильтрации нет: строка, не совпадающая с фильтром, показана', async () => {
    api.listDeliveries.mockResolvedValue(page([delivery({ status: 'sent' })]))
    renderLog('?pb_view=log&pb_outcome=skipped')
    expect(await screen.findByText('APP-0001')).toBeInTheDocument()
    const row = screen.getByText('APP-0001').closest('tr') as HTMLElement
    expect(within(row).getByText('credit.postbacks.outcome.sent')).toBeInTheDocument()
  })

  it('«Скинути фільтри» снимает все фильтры из запроса', async () => {
    renderLog(`?pb_view=log&pb_outcome=failed&pb_rule=${RULE_ID}`)
    await waitFor(() => expect(lastCall()).toMatchObject({ status: 'failed', rule_id: RULE_ID }))
    fireEvent.click(screen.getByRole('button', { name: 'credit.postbacks.log.filters.reset' }))
    await waitFor(() => expect(lastCall()).toMatchObject({ status: undefined, rule_id: undefined }))
  })

  it('негодный pb_rule — не в запросе и не в списке; пусто — без «за фільтрами»', async () => {
    api.listDeliveries.mockResolvedValue(page([]))
    renderLog('?pb_view=log&pb_rule=r-1')
    expect(await screen.findByText('credit.postbacks.log.empty')).toBeInTheDocument()
    expect(lastCall()?.rule_id).toBeUndefined()
    const select = screen.getByLabelText('credit.postbacks.log.filters.rule')
    expect(await within(select).findByRole('option', { name: RULE.name })).toBeInTheDocument()
    expect(within(select).queryByRole('option', { name: 'r-1' })).not.toBeInTheDocument()
    expect(screen.queryByText('credit.postbacks.log.emptyFiltered')).not.toBeInTheDocument()
  })

  it('ID действия из одних пробелов — не фильтр: поле пустое, «за фільтрами» нет', async () => {
    api.listDeliveries.mockResolvedValue(page([]))
    renderLog()
    expect(await screen.findByText('credit.postbacks.log.empty')).toBeInTheDocument()
    const field = screen.getByLabelText('credit.postbacks.log.filters.action')
    fireEvent.change(field, { target: { value: '   ' } })
    expect(field).toHaveValue('')
    expect(screen.getByText('credit.postbacks.log.empty')).toBeInTheDocument()
    expect(screen.queryByText('credit.postbacks.log.emptyFiltered')).not.toBeInTheDocument()
  })
})

describe('таблица лога (AC-b2, К-3, сторно)', () => {
  const rowOf = (text: string) => screen.getByText(text).closest('tr') as HTMLElement

  it('отправка 200, отказ партнёра 500, пропуск без click_id — подписями', async () => {
    api.listDeliveries.mockResolvedValue(
      page([
        delivery({ id: 1, action_number: 'APP-0001' }),
        delivery({
          id: 2,
          action_number: 'APP-0002',
          status: 'failed',
          response_code: 500,
          last_error: 'http_5xx',
          attempts: 5,
        }),
        delivery({
          id: 3,
          action_number: 'APP-0003',
          status: 'skipped',
          skip_reason: 'click_id_missing',
          url: null,
          response_code: null,
          sent_at: null,
          attempts: 0,
        }),
      ])
    )
    renderLog()
    await screen.findByText('APP-0001')

    const sent = rowOf('APP-0001')
    expect(within(sent).getByText('credit.postbacks.outcome.sent')).toBeInTheDocument()
    expect(within(sent).getByText('200')).toBeInTheDocument()

    const failed = rowOf('APP-0002')
    expect(within(failed).getByText('credit.postbacks.outcome.failed')).toBeInTheDocument()
    expect(within(failed).getByText('500')).toBeInTheDocument()
    expect(within(failed).getByText('credit.postbacks.lastError.http_5xx')).toBeInTheDocument()

    const skipped = rowOf('APP-0003')
    expect(within(skipped).getByText('credit.postbacks.outcome.skipped')).toBeInTheDocument()
    expect(
      within(skipped).getByText('credit.postbacks.skipReason.click_id_missing')
    ).toBeInTheDocument()
    // У пропуска URL нет — «—», а не пустая ячейка с кнопкой копирования.
    expect(
      within(skipped).queryByRole('button', { name: 'credit.postbacks.rules.copyUrl' })
    ).not.toBeInTheDocument()
    // Ячейка URL (седьмая колонка): у отправки — адрес, у пропуска — ровно «—».
    expect(sent.querySelectorAll('td')[6]).toHaveTextContent(/^https:/)
    expect(skipped.querySelectorAll('td')[6]).toHaveTextContent(/^—$/)
  })

  it('«сторновано» — по reversed_at, а не по причине loan_reversed', async () => {
    api.listDeliveries.mockResolvedValue(
      page([
        delivery({
          id: 1,
          action_number: 'LN-1',
          trigger: 'new_loan',
          action_id: LOAN_ID,
          reversed_at: '2026-10-03T09:00:00Z',
        }),
        delivery({
          id: 2,
          action_number: 'LN-2',
          trigger: 'new_loan',
          action_id: LOAN_ID,
          status: 'skipped',
          skip_reason: 'loan_reversed',
          url: null,
        }),
      ])
    )
    renderLog()
    await screen.findByText('LN-1')
    expect(within(rowOf('LN-1')).getByText('credit.postbacks.log.reversed')).toBeInTheDocument()
    const skipped = rowOf('LN-2')
    expect(
      within(skipped).getByText('credit.postbacks.skipReason.loan_reversed')
    ).toBeInTheDocument()
    expect(within(skipped).queryByText('credit.postbacks.log.reversed')).not.toBeInTheDocument()
  })

  it('неизвестные исход, причина и код ошибки — сырыми с пометкой, экран не падает', async () => {
    api.listDeliveries.mockResolvedValue(
      page([
        delivery({ id: 1, action_number: 'X-1', status: 'bounced', last_error: 'tls_handshake' }),
        delivery({
          id: 2,
          action_number: 'X-2',
          status: 'skipped',
          skip_reason: 'rule_paused',
          url: null,
        }),
      ])
    )
    renderLog()
    await screen.findByText('X-1')
    expect(within(rowOf('X-1')).getByText('bounced')).toBeInTheDocument()
    expect(within(rowOf('X-1')).getByText('tls_handshake')).toBeInTheDocument()
    expect(within(rowOf('X-2')).getByText('rule_paused')).toBeInTheDocument()
    expect(within(rowOf('X-1')).getAllByText('(credit.postbacks.unknownValue)')).toHaveLength(2)
  })

  it('заявка/кредит — номер со ссылкой на карточку по триггеру; неизвестный — текст', async () => {
    signIn(['credit.partner_postbacks.read', 'credit.applications.read', 'credit.loans.read'])
    api.listDeliveries.mockResolvedValue(
      page([
        delivery({ id: 1, action_number: 'APP-0001' }),
        delivery({ id: 2, action_number: 'LN-0002', trigger: 'new_loan', action_id: LOAN_ID }),
        delivery({ id: 3, action_number: null, trigger: 'loan_repaid', action_id: LOAN_ID }),
      ])
    )
    renderLog()
    expect(await screen.findByRole('link', { name: 'APP-0001' })).toHaveAttribute(
      'href',
      `/dashboard/credit/applications/${APP_ID}`
    )
    expect(screen.getByRole('link', { name: 'LN-0002' })).toHaveAttribute(
      'href',
      `/dashboard/credit/loans/${LOAN_ID}`
    )
    const unknown = screen.getByText(LOAN_ID)
    expect(unknown.closest('a')).toBeNull()
  })

  describe('ссылка на карточку — только зрителю с правом её маршрута (ревью бота, Б-1)', () => {
    const serveBoth = () =>
      api.listDeliveries.mockResolvedValue(
        page([
          delivery({ id: 1, action_number: 'APP-0001' }),
          delivery({ id: 2, action_number: 'LN-0002', trigger: 'new_loan', action_id: LOAN_ID }),
        ])
      )
    const cellOf = (text: string) => screen.getByText(text).closest('td') as HTMLElement

    it('только право постбеков — ссылок нет, номер и копирование ID действия', async () => {
      const writeText = vi.fn()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      signIn(['credit.partner_postbacks.read'])
      serveBoth()
      renderLog()
      await screen.findByText('APP-0001')
      for (const [text, id] of [
        ['APP-0001', APP_ID],
        ['LN-0002', LOAN_ID],
      ]) {
        const cell = cellOf(text)
        expect(within(cell).queryByRole('link')).not.toBeInTheDocument()
        fireEvent.click(
          within(cell).getByRole('button', { name: 'credit.postbacks.log.copyActionId' })
        )
        expect(writeText).toHaveBeenLastCalledWith(id)
      }
    })

    it('право заявок — ссылка на заявку есть, на кредит без права кредитов — нет', async () => {
      signIn(['credit.partner_postbacks.read', 'credit.applications.read'])
      serveBoth()
      renderLog()
      expect(await screen.findByRole('link', { name: 'APP-0001' })).toHaveAttribute(
        'href',
        `/dashboard/credit/applications/${APP_ID}`
      )
      expect(within(cellOf('LN-0002')).queryByRole('link')).not.toBeInTheDocument()
    })

    it('manage_settings — обе ссылки', async () => {
      signIn(['credit.partner_postbacks.read', 'manage_settings'])
      serveBoth()
      renderLog()
      expect(await screen.findByRole('link', { name: 'APP-0001' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'LN-0002' })).toHaveAttribute(
        'href',
        `/dashboard/credit/loans/${LOAN_ID}`
      )
    })
  })

  it('правило вне списка правил — именем записи с пометкой «видалено»', async () => {
    api.listDeliveries.mockResolvedValue(
      page([
        delivery({ id: 1, rule_id: GONE_RULE_ID, rule_name: 'Old partner', action_number: 'A-9' }),
      ])
    )
    renderLog()
    await screen.findByText('A-9')
    await waitFor(() =>
      expect(within(rowOf('A-9')).getByText(/credit\.postbacks\.log\.deleted/)).toBeInTheDocument()
    )
    expect(within(rowOf('A-9')).getByText(/Old partner/)).toBeInTheDocument()
  })

  it('итоговый URL — обрезан и под замазкой записи', async () => {
    renderLog()
    const shown = await screen.findByText(/^https:\/\/partner\.example\/postback.*…$/)
    expectObscured(shown)
    expect(shown.textContent?.length).toBeLessThan(URL_SENT.length)
  })

  it('полный URL — копированием, но ни в одном атрибуте', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderLog()
    await screen.findByText('APP-0001')
    fireEvent.click(screen.getByRole('button', { name: 'credit.postbacks.rules.copyUrl' }))
    expect(writeText).toHaveBeenCalledWith(URL_SENT)
    const leaks = [...document.querySelectorAll('*')].flatMap((element) =>
      [...element.attributes].filter((attribute) => attribute.value.includes(TOKEN))
    )
    expect(leaks.map((attribute) => attribute.name)).toEqual([])
  })
})

describe('страницы по курсору (AC-b4, К-6)', () => {
  it('«Далі» несёт next_cursor, «Назад» — прежний курсор; без next_cursor «Далі» выключена', async () => {
    api.listDeliveries.mockImplementation(async (params) =>
      params.cursor === 'c2'
        ? page([delivery({ id: 2, action_number: 'PAGE-2' })], null)
        : page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    )
    renderLog()
    await screen.findByText('PAGE-1')
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    expect(await screen.findByText('PAGE-2')).toBeInTheDocument()
    expect(lastCall()).toMatchObject({ cursor: 'c2', limit: 25 })
    expect(screen.getByRole('button', { name: NEXT })).toBeDisabled()
    expect(screen.getByRole('button', { name: PREV })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: PREV }))
    expect(await screen.findByText('PAGE-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
  })

  it('стек курсоров: с третьей страницы «Назад» ведёт на вторую, а не на первую', async () => {
    const pages: Record<string, CreditPostbackDeliveryList> = {
      first: page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2'),
      c2: page([delivery({ id: 2, action_number: 'PAGE-2' })], 'c3'),
      c3: page([delivery({ id: 3, action_number: 'PAGE-3' })], null),
    }
    api.listDeliveries.mockImplementation(async (params) => pages[params.cursor ?? 'first'])
    renderLog()
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await screen.findByText('PAGE-2')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await screen.findByText('PAGE-3')

    fireEvent.click(screen.getByRole('button', { name: PREV }))
    expect(await screen.findByText('PAGE-2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: PREV }))
    expect(await screen.findByText('PAGE-1')).toBeInTheDocument()
  })

  it('смена фильтра — снова первая страница', async () => {
    api.listDeliveries.mockImplementation(async (params) =>
      params.cursor === 'c2'
        ? page([delivery({ id: 2, action_number: 'PAGE-2' })], null)
        : page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    )
    renderLog()
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await screen.findByText('PAGE-2')

    fireEvent.change(screen.getByLabelText('credit.postbacks.log.filters.outcome'), {
      target: { value: 'sent' },
    })
    await waitFor(() => expect(lastCall()).toMatchObject({ status: 'sent', cursor: undefined }))
    expect(await screen.findByText('PAGE-1')).toBeInTheDocument()
  })

  it('недописанный UUID страницу не сбрасывает; дописанный — первая страница', async () => {
    api.listDeliveries.mockImplementation(async (params) =>
      params.cursor === 'c2'
        ? page([delivery({ id: 2, action_number: 'PAGE-2' })], null)
        : page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    )
    renderLog()
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await screen.findByText('PAGE-2')
    const calls = api.listDeliveries.mock.calls.length

    const field = screen.getByLabelText('credit.postbacks.log.filters.action')
    fireEvent.change(field, { target: { value: APP_ID.slice(0, 8) } })
    await screen.findByText('credit.postbacks.log.filters.actionInvalid')
    expect(screen.getByText('PAGE-2')).toBeInTheDocument()
    expect(api.listDeliveries.mock.calls.length).toBe(calls)
    expect(lastCall()).toMatchObject({ cursor: 'c2', action_id: undefined })
    expect(screen.getByRole('button', { name: PREV })).toBeEnabled()

    fireEvent.change(field, { target: { value: APP_ID } })
    await waitFor(() => expect(lastCall()).toMatchObject({ action_id: APP_ID, cursor: undefined }))
    expect(await screen.findByText('PAGE-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
  })

  it('«Далі» → фильтр → «Скинути» — первая страница, а не прежняя вторая', async () => {
    api.listDeliveries.mockImplementation(async (params) =>
      params.cursor === 'c2'
        ? page([delivery({ id: 2, action_number: 'PAGE-2' })], null)
        : page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    )
    renderLog()
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await screen.findByText('PAGE-2')
    const outcome = screen.getByLabelText('credit.postbacks.log.filters.outcome')
    fireEvent.change(outcome, { target: { value: 'sent' } })
    await screen.findByText('PAGE-1')

    fireEvent.click(screen.getByRole('button', { name: 'credit.postbacks.log.filters.reset' }))
    await waitFor(() => expect(outcome).toHaveValue(''))
    expect(screen.getByText('PAGE-1')).toBeInTheDocument()
    expect(screen.queryByText('PAGE-2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
    expect(lastCall()?.cursor).toBeUndefined()
  })

  it('фильтр из ссылки: «Далі» → «Скинути» — первая страница без фильтров', async () => {
    api.listDeliveries.mockImplementation(async (params) =>
      params.cursor === 'c2'
        ? page([delivery({ id: 2, action_number: 'PAGE-2' })], null)
        : page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    )
    renderLog('?pb_view=log&pb_outcome=sent')
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await screen.findByText('PAGE-2')

    fireEvent.click(screen.getByRole('button', { name: 'credit.postbacks.log.filters.reset' }))
    await waitFor(() => expect(lastCall()).toMatchObject({ status: undefined, cursor: undefined }))
    expect(await screen.findByText('PAGE-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
  })

  it('листание при висящем ответе — прежняя страница остаётся, «Далі» выключена', async () => {
    api.listDeliveries.mockImplementation(async (params) =>
      params.cursor === 'c2'
        ? new Promise<never>(() => {})
        : page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    )
    renderLog()
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    await waitFor(() => expect(lastCall()).toMatchObject({ cursor: 'c2' }))
    expect(screen.getByText('PAGE-1')).toBeInTheDocument()
    expect(screen.queryByTestId('table-skeleton')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: NEXT })).toBeDisabled()
  })

  it('«Далі» → сбой страницы — «Назад» видна и ведёт на первую', async () => {
    api.listDeliveries.mockImplementation(async (params) => {
      if (params.cursor === 'c2') throw new CreditApiError('Unavailable', 503, 'unavailable')
      return page([delivery({ id: 1, action_number: 'PAGE-1' })], 'c2')
    })
    renderLog()
    await screen.findByText('PAGE-1')
    fireEvent.click(screen.getByRole('button', { name: NEXT }))
    expect(await screen.findByText('credit.unavailable.title')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: NEXT })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: PREV }))
    expect(await screen.findByText('PAGE-1')).toBeInTheDocument()
    expect(screen.queryByText('credit.unavailable.title')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREV })).toBeDisabled()
  })
})

describe('обновление (К-7)', () => {
  it('«Оновити» перечитывает ту же страницу', async () => {
    renderLog()
    await screen.findByText('APP-0001')
    expect(api.listDeliveries).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: REFRESH }))
    await waitFor(() => expect(api.listDeliveries).toHaveBeenCalledTimes(2))
    expect(api.listDeliveries.mock.calls[1][0]).toEqual(api.listDeliveries.mock.calls[0][0])
  })

  it('возврат на вкладку браузера перечитывает, хотя общее умолчание это выключает', async () => {
    renderLog()
    await screen.findByText('APP-0001')
    expect(api.listDeliveries).toHaveBeenCalledTimes(1)
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(api.listDeliveries).toHaveBeenCalledTimes(2))
  })

  it('таймера перечитки нет', async () => {
    const client = renderLog()
    await screen.findByText('APP-0001')
    const [query] = client
      .getQueryCache()
      .findAll({ queryKey: ['credit', 'postbacks', 'deliveries'] })
    expect(query.observers.length).toBeGreaterThan(0)
    for (const observer of query.observers) {
      expect(observer.options.refetchInterval ?? false).toBe(false)
    }
  })
})

describe('состояния (AC-b5)', () => {
  it('загрузка — скелет', async () => {
    api.listDeliveries.mockReturnValue(new Promise(() => {}))
    renderLog()
    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument()
  })

  it('смена фильтра при висящем ответе — строк прежней выборки нет, скелет', async () => {
    renderLog()
    await screen.findByText('APP-0001')
    api.listDeliveries.mockReturnValue(new Promise(() => {}))
    fireEvent.change(screen.getByLabelText('credit.postbacks.log.filters.outcome'), {
      target: { value: 'failed' },
    })
    expect(await screen.findByTestId('table-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('APP-0001')).not.toBeInTheDocument()
  })

  it('403 — предупреждение о праве, не «модуль недоступен»', async () => {
    api.listDeliveries.mockRejectedValue(new CreditApiError('Forbidden', 403, 'forbidden'))
    renderLog()
    expect(await screen.findByText('credit.postbacks.forbidden')).toBeInTheDocument()
    expect(screen.queryByText('credit.unavailable.title')).not.toBeInTheDocument()
  })

  it('5xx — «модуль недоступен»', async () => {
    api.listDeliveries.mockRejectedValue(new CreditApiError('Bad gateway', 502, 'bad_gateway'))
    renderLog()
    expect(await screen.findByText('credit.unavailable.title')).toBeInTheDocument()
  })

  it('пусто без фильтров — «постбеків ще не було»; с фильтром — «за фільтрами нічого»', async () => {
    api.listDeliveries.mockResolvedValue(page([]))
    renderLog()
    expect(await screen.findByText('credit.postbacks.log.empty')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('credit.postbacks.log.filters.outcome'), {
      target: { value: 'failed' },
    })
    expect(await screen.findByText('credit.postbacks.log.emptyFiltered')).toBeInTheDocument()
  })

  it('сбой перечитки при данных — строки остаются, над ними предупреждение', async () => {
    renderLog()
    await screen.findByText('APP-0001')
    api.listDeliveries.mockRejectedValue(new CreditApiError('Bad gateway', 502, 'bad_gateway'))
    fireEvent.click(screen.getByRole('button', { name: REFRESH }))
    expect(await screen.findByText('credit.postbacks.log.refreshFailed')).toBeInTheDocument()
    expect(screen.getByText('APP-0001')).toBeInTheDocument()
    expect(screen.queryByText('credit.unavailable.title')).not.toBeInTheDocument()
  })
})
