/**
 * Форма правила постбека партнёру — создание и правка (18-13d-a2).
 *
 * Что держим (AC-a5, AC-a6, AC-a12; решения куратора К-2, К-4, К-5):
 *  - клиент зеркалит три проверки модуля: без `{click_id}`, чужой макрос (по
 *    имени), `{amount}` у «Новий лід» — ошибка у поля URL и «Зберегти» неактивна;
 *  - 422 модуля раскладывается по полям: `errors[].field` → поле, текст — по
 *    `details.reason`; без поля — общий `Alert` с текстом Problem;
 *  - ключ создания живёт на действие с неизменным телом: повтор после сетевого
 *    отказа — тот же ключ, правка после 422 — новый, новое открытие — новый;
 *    повтор мутаций — боевой предикат `main.tsx` (сетевой отказ транспорта
 *    раздела — `transportCode` — повторяется один раз), а не `retry` теста;
 *  - правка шлёт `PATCH` только изменённых полей, ключ — на нажатие; 409 —
 *    «правило змінив інший користувач» и перечитка списка;
 *  - пока запрос в пути, форма выключена и не закрывается;
 *  - подсказка макросов из ответа двери, вставка в позицию курсора, пример ТЗ;
 *    подстановки значений на клиенте нет; поле URL и текст его ошибки под
 *    замазкой записи.
 *
 * Хуки настоящие, QueryClient живой, подменён только транспорт.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { CreditPostbacksSection } from '../components/CreditPostbacksSection'
import { CreditApiError, toCreditError } from '@/features/credit/api/creditApi'
import {
  creditPostbacksApi,
  type CreditPostbackRule,
  type CreditPostbackRuleList,
} from '@/features/credit/api/postbacks'
import { expectObscured } from '@/test/piiHelpers'
import { MAIN_PREDICATE_LINES, MAIN_SOURCE, isMutationRetryable } from '@/test/mutationRetry'

vi.mock('@/features/credit/api/postbacks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credit/api/postbacks')>()
  return {
    ...actual,
    creditPostbacksApi: {
      rules: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
    },
  }
})

const api = vi.mocked(creditPostbacksApi)

const URL_OK = 'https://partner.example/pb?clickid={click_id}&action_id={action_id}'

function rule(patch: Partial<CreditPostbackRule> = {}): CreditPostbackRule {
  return {
    id: 'r-1',
    name: 'Partner one — lead',
    active: true,
    trigger: 'new_lead',
    utm_source: 'partner1',
    url_template: URL_OK,
    goal: '1',
    currency: null,
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    created_by: 7,
    updated_by: 7,
    ...patch,
  }
}

let server: CreditPostbackRule[] = []
let macros = ['click_id', 'action_id', 'goal', 'amount', 'currency']

function serveRules(rules: CreditPostbackRule[]): void {
  server = rules
  api.rules.mockImplementation(
    async (): Promise<CreditPostbackRuleList> => ({
      items: server,
      triggers: [
        { code: 'new_lead', amount_allowed: false },
        { code: 'new_loan', amount_allowed: true },
      ],
      macros,
    })
  )
  api.createRule.mockImplementation(async (input) => {
    const created = rule({ ...input, id: `r-${server.length + 1}` })
    server = [...server, created]
    return created
  })
  api.updateRule.mockImplementation(async (id, patch) => {
    server = server.map((item) => (item.id === id ? { ...item, ...patch } : item))
    return server.find((item) => item.id === id) as CreditPostbackRule
  })
}

const raw = (glob: Record<string, unknown>) => Object.values(glob)[0] as string
const FORM_SOURCE = raw(
  import.meta.glob('../components/CreditPostbackRuleForm.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
)

function renderSection(canWrite = true): void {
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
}

const SAVE = 'credit.postbacks.form.save'
const networkError = () => toCreditError(new AxiosError('Network Error', 'ERR_NETWORK'))
const refused422 = (
  errors: Array<{ field: string | null; code: string }>,
  reason: Record<string, string[]> = {}
) =>
  new CreditApiError(
    'Правило постбека не прошло проверку',
    422,
    'validation_failed',
    // Модуль шлёт `field: null` у ошибки не про поле — тип клиента его не знает.
    errors as never,
    { reason }
  )

async function openCreate(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'credit.postbacks.form.add' }))
  return screen.findByRole('dialog')
}

const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement
const urlField = (dialog: HTMLElement) => field(dialog, 'credit.postbacks.rules.url')
const saveButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: SAVE })

function type(input: HTMLElement, value: string): void {
  fireEvent.change(input, { target: { value } })
}

function fill(dialog: HTMLElement, url = URL_OK, trigger = 'new_lead'): void {
  type(field(dialog, 'credit.postbacks.rules.name'), 'Partner two — lead')
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: trigger } })
  type(field(dialog, 'utm_source'), '  partner2  ')
  type(urlField(dialog), url)
}

beforeEach(() => {
  vi.clearAllMocks()
  macros = ['click_id', 'action_id', 'goal', 'amount', 'currency']
  serveRules([rule()])
})

describe('создание (AC-a5)', () => {
  it('«Зберегти» неактивна, пока не заполнены обязательные поля', async () => {
    renderSection()
    const dialog = await openCreate()
    expect(saveButton(dialog)).toBeDisabled()
    type(field(dialog, 'credit.postbacks.rules.name'), 'Partner two')
    expect(saveButton(dialog)).toBeDisabled()
    fill(dialog)
    expect(saveButton(dialog)).toBeEnabled()
    // Пустой после среза utm_source — не заполнен.
    type(field(dialog, 'utm_source'), '   ')
    expect(saveButton(dialog)).toBeDisabled()
  })

  it('POST тела формы с ключом; utm_source без пробелов по краям; список перечитан, форма закрыта', async () => {
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    type(field(dialog, 'credit.postbacks.rules.currency'), 'CAD')
    fireEvent.click(saveButton(dialog))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createRule).toHaveBeenCalledTimes(1)
    const [body, key] = api.createRule.mock.calls[0]
    expect(body).toEqual({
      name: 'Partner two — lead',
      active: true,
      trigger: 'new_lead',
      utm_source: 'partner2',
      url_template: URL_OK,
      goal: null,
      currency: 'CAD',
    })
    expect(key).toMatch(/^fe-postback-rule:/)
    expect(await screen.findByText('Partner two — lead')).toBeInTheDocument()
    expect(api.rules.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('«Активне» по умолчанию включено; выключенное уходит false', async () => {
    renderSection()
    const dialog = await openCreate()
    const active = within(dialog).getByRole('switch')
    expect(active).toHaveAttribute('aria-checked', 'true')
    fill(dialog)
    fireEvent.click(active)
    fireEvent.click(saveButton(dialog))
    await waitFor(() => expect(api.createRule).toHaveBeenCalledTimes(1))
    expect(api.createRule.mock.calls[0][0].active).toBe(false)
  })
})

describe('клиентские проверки адреса (AC-a5, Р-18-13d-6)', () => {
  it.each([
    ['без {click_id}', 'https://p.example/pb?a={action_id}', 'new_lead', 'url_click_id_required'],
    [
      '{amount} на «Новий лід»',
      'https://p.example/pb?c={click_id}&s={amount}',
      'new_lead',
      'url_macro_not_for_trigger',
    ],
    ['чужой макрос', 'https://p.example/pb?c={click_id}&x={foo}', 'new_lead', 'url_macro_unknown'],
  ])('%s — ошибка у поля URL, «Зберегти» неактивна', async (_name, url, trigger, reason) => {
    renderSection()
    const dialog = await openCreate()
    fill(dialog, url, trigger)
    const error = within(dialog).getByText(new RegExp(`form\\.errors\\.${reason}`))
    expect(urlField(dialog)).toHaveAttribute('aria-describedby', error.id)
    expect(saveButton(dialog)).toBeDisabled()
  })

  it('чужой макрос назван по имени', async () => {
    renderSection()
    const dialog = await openCreate()
    fill(dialog, 'https://p.example/pb?c={click_id}&x={foo}')
    expect(within(dialog).getByText(/url_macro_unknown \{foo\}/)).toBeInTheDocument()
  })

  it('{amount}: смена триггера на «Новий кредит» снимает ошибку', async () => {
    renderSection()
    const dialog = await openCreate()
    fill(dialog, 'https://p.example/pb?c={click_id}&s={amount}')
    expect(saveButton(dialog)).toBeDisabled()
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'new_loan' } })
    expect(within(dialog).queryByText(/form\.errors\./)).not.toBeInTheDocument()
    expect(saveButton(dialog)).toBeEnabled()
  })
})

describe('отказы модуля (AC-a5, К-2)', () => {
  it.each([
    ['url_macro_outside_query', 'credit.postbacks.rules.url'],
    ['url_click_id_required', 'credit.postbacks.rules.url'],
  ])('422 url_template / %s — текст под полем URL', async (reason, label) => {
    api.createRule.mockRejectedValueOnce(
      refused422([{ field: 'url_template', code: 'invalid_value' }], { url_template: [reason] })
    )
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))

    const error = await within(dialog).findByText(`credit.postbacks.form.errors.${reason}`)
    expect(field(dialog, label)).toHaveAttribute('aria-describedby', error.id)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('422 по goal — под полем goal; правка поля снимает отказ', async () => {
    api.createRule.mockRejectedValueOnce(
      refused422([{ field: 'goal', code: 'invalid_value' }], { goal: ['goal_format'] })
    )
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    type(field(dialog, 'credit.postbacks.rules.goal'), 'abc')
    fireEvent.click(saveButton(dialog))

    const error = await within(dialog).findByText('credit.postbacks.form.errors.goal_format')
    expect(field(dialog, 'credit.postbacks.rules.goal')).toHaveAttribute(
      'aria-describedby',
      error.id
    )
    type(field(dialog, 'credit.postbacks.rules.goal'), '1')
    expect(within(dialog).queryByText('credit.postbacks.form.errors.goal_format')).toBeNull()
  })

  it('422 без уточнения — текст Problem под полем', async () => {
    api.createRule.mockRejectedValueOnce(refused422([{ field: 'name', code: 'invalid_value' }]))
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))
    const error = await within(dialog).findByText('Правило постбека не прошло проверку')
    expect(field(dialog, 'credit.postbacks.rules.name')).toHaveAttribute(
      'aria-describedby',
      error.id
    )
  })

  it('422 без поля — общий Alert с текстом Problem', async () => {
    api.createRule.mockRejectedValueOnce(refused422([{ field: null, code: 'invalid_value' }]))
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Правило постбека не прошло проверку')
  })
})

describe('ключ идемпотентности создания (AC-a5, Р-18-13d-9, К-4) — боевой повтор', () => {
  it('сетевой отказ — один автоповтор тем же ключом, правило создано, форма закрыта', async () => {
    api.createRule.mockRejectedValueOnce(networkError())
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createRule).toHaveBeenCalledTimes(2)
    const [first, retried] = api.createRule.mock.calls
    expect(retried).toEqual(first)
    expect(await screen.findByText('Partner two — lead')).toBeInTheDocument()
  })

  it('сеть не вернулась и после автоповтора; повтор того же тела нажатием — тот же ключ', async () => {
    api.createRule.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError())
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))

    expect(await within(dialog).findByText('credit.postbacks.form.saveFailed')).toBeInTheDocument()
    expect(api.createRule).toHaveBeenCalledTimes(2)

    fireEvent.click(saveButton(dialog))
    await waitFor(() => expect(api.createRule).toHaveBeenCalledTimes(3))
    const [first, , pressed] = api.createRule.mock.calls.map((call) => call[1])
    expect(pressed).toBe(first)
    expect(api.createRule.mock.calls[2][0]).toEqual(api.createRule.mock.calls[0][0])
  })

  it('422, правка поля URL, повторная отправка — новый ключ', async () => {
    api.createRule.mockRejectedValueOnce(
      refused422([{ field: 'url_template', code: 'invalid_value' }], {
        url_template: ['url_host_not_public'],
      })
    )
    renderSection()
    const dialog = await openCreate()
    fill(dialog, 'https://10.0.0.1/pb?c={click_id}')
    fireEvent.click(saveButton(dialog))
    await within(dialog).findByText('credit.postbacks.form.errors.url_host_not_public')

    type(urlField(dialog), URL_OK)
    fireEvent.click(saveButton(dialog))
    await waitFor(() => expect(api.createRule).toHaveBeenCalledTimes(2))
    const [first, second] = api.createRule.mock.calls.map((call) => call[1])
    expect(second).not.toBe(first)
  })

  it('новое открытие формы — новый ключ', async () => {
    api.createRule.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError())
    renderSection()
    let dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))
    await within(dialog).findByText('credit.postbacks.form.saveFailed')
    fireEvent.click(within(dialog).getByRole('button', { name: 'credit.postbacks.form.cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await openCreate()
    fill(dialog)
    fireEvent.click(saveButton(dialog))
    await waitFor(() => expect(api.createRule).toHaveBeenCalledTimes(3))
    const [first, , reopened] = api.createRule.mock.calls.map((call) => call[1])
    expect(reopened).not.toBe(first)
  })

  it('предикат повтора сцен — копия боевого из main.tsx', () => {
    for (const line of MAIN_PREDICATE_LINES) expect(MAIN_SOURCE).toContain(line)
    // Сетевой отказ транспорта раздела повторяется, отказ с ответом — нет.
    expect(isMutationRetryable(networkError())).toBe(true)
    expect(isMutationRetryable(new CreditApiError('Boom', 500))).toBe(false)
  })
})

describe('правка (AC-a5)', () => {
  async function openEdit(): Promise<HTMLElement> {
    fireEvent.click(await screen.findByRole('button', { name: 'credit.postbacks.form.edit' }))
    return screen.findByRole('dialog')
  }

  it('форма заполнена правилом; PATCH только изменённых полей с ключом', async () => {
    renderSection()
    const dialog = await openEdit()
    expect(field(dialog, 'credit.postbacks.rules.name').value).toBe('Partner one — lead')
    expect(urlField(dialog).value).toBe(URL_OK)
    // Без правок отправлять нечего.
    expect(saveButton(dialog)).toBeDisabled()

    type(field(dialog, 'credit.postbacks.rules.name'), 'Renamed')
    fireEvent.click(saveButton(dialog))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const [id, patch, key] = api.updateRule.mock.calls[0]
    expect([id, patch]).toEqual(['r-1', { name: 'Renamed' }])
    expect(key).toMatch(/^fe-postback-rule:/)
    expect(await screen.findByText('Renamed')).toBeInTheDocument()
  })

  it('409 — «правило змінив інший користувач», список перечитан', async () => {
    api.updateRule.mockRejectedValueOnce(new CreditApiError('Conflict', 409, 'conflict'))
    renderSection()
    const dialog = await openEdit()
    const before = api.rules.mock.calls.length
    type(field(dialog, 'credit.postbacks.rules.name'), 'Renamed')
    fireEvent.click(saveButton(dialog))

    expect(await within(dialog).findByText('credit.postbacks.form.conflict')).toBeInTheDocument()
    await waitFor(() => expect(api.rules.mock.calls.length).toBeGreaterThan(before))
  })

  it.each([
    ['422', () => api.updateRule.mockRejectedValueOnce(refused422([{ field: 'name', code: 'x' }]))],
    [
      'сеть (и автоповтор)',
      () =>
        api.updateRule.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError()),
    ],
  ])('правка: отказ (%s), правка поля, новое нажатие — новый ключ', async (_name, refuse) => {
    refuse()
    renderSection()
    const dialog = await openEdit()
    type(field(dialog, 'credit.postbacks.rules.name'), 'Renamed')
    fireEvent.click(saveButton(dialog))
    await within(dialog).findByRole('alert')
    const refused = api.updateRule.mock.calls.length

    type(field(dialog, 'credit.postbacks.rules.name'), 'Renamed again')
    fireEvent.click(saveButton(dialog))
    await waitFor(() => expect(api.updateRule).toHaveBeenCalledTimes(refused + 1))
    const keys = api.updateRule.mock.calls.map((call) => call[2])
    expect(keys[refused]).toMatch(/^fe-postback-rule:/)
    expect(keys[refused]).not.toBe(keys[0])
    expect(api.updateRule.mock.calls[refused][1]).toEqual({ name: 'Renamed again' })
  })

  it('без права записи нет ни «Додати правило», ни «Змінити»', async () => {
    renderSection(false)
    await screen.findByText('Partner one — lead')
    expect(screen.queryByRole('button', { name: 'credit.postbacks.form.add' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'credit.postbacks.form.edit' })).toBeNull()
  })
})

describe('пока запрос в пути (ревью a2)', () => {
  it('поля, макросы, «Скасувати» и крестик выключены; после ответа форма закрыта', async () => {
    let finish = () => {}
    api.createRule.mockImplementation(
      (input) =>
        new Promise<CreditPostbackRule>((resolve) => {
          finish = () => resolve(rule({ ...input, id: 'r-2' }))
        })
    )
    renderSection()
    const dialog = await openCreate()
    fill(dialog)
    expect(field(dialog, 'credit.postbacks.rules.name')).toBeEnabled()
    fireEvent.click(saveButton(dialog))

    await waitFor(() => expect(urlField(dialog)).toBeDisabled())
    for (const label of [
      'credit.postbacks.rules.name',
      'utm_source',
      'credit.postbacks.rules.goal',
    ])
      expect(field(dialog, label)).toBeDisabled()
    expect(within(dialog).getByRole('combobox')).toBeDisabled()
    expect(within(dialog).getByRole('switch')).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: '{click_id}' })).toBeDisabled()
    const cancel = within(dialog).getByRole('button', { name: 'credit.postbacks.form.cancel' })
    expect(cancel).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    finish()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.createRule).toHaveBeenCalledTimes(1)
  })
})

describe('макросы (AC-a6, К-5)', () => {
  it('пять макросов из ответа двери с подписями; {click_id} обязателен, {amount} — только кредит', async () => {
    renderSection()
    const dialog = await openCreate()
    for (const macro of ['click_id', 'action_id', 'goal', 'amount', 'currency']) {
      expect(within(dialog).getByRole('button', { name: `{${macro}}` })).toBeInTheDocument()
      expect(within(dialog).getByText(new RegExp(`postbacks\\.macro\\.${macro}`))).toBeTruthy()
    }
    expect(within(dialog).getByText(/macro\.click_id — credit\.postbacks\.form\.macroRequired/))
    expect(within(dialog).getByText(/macro\.amount — credit\.postbacks\.form\.macroAmountOnly/))
    expect(within(dialog).getByText(/^https:\/\/partner\.com\/postback\?clickid=\{click_id\}/))
  })

  it('макрос вне снимка — сырым именем с пометкой; проверка его принимает', async () => {
    macros = [...macros, 'sub_id']
    renderSection()
    const dialog = await openCreate()
    expect(within(dialog).getByRole('button', { name: '{sub_id}' })).toBeInTheDocument()
    expect(within(dialog).getAllByText('credit.postbacks.unknownValue').length).toBe(1)
    fill(dialog, `${URL_OK}&s={sub_id}`)
    expect(saveButton(dialog)).toBeEnabled()
  })

  it('клик вставляет макрос в позицию курсора', async () => {
    renderSection()
    const dialog = await openCreate()
    const url = urlField(dialog)
    type(url, 'https://p.example/pb?c=&a=1')
    url.setSelectionRange(23, 23)
    fireEvent.click(within(dialog).getByRole('button', { name: '{click_id}' }))
    expect(url.value).toBe('https://p.example/pb?c={click_id}&a=1')
  })

  it('поле URL под замазкой записи сессий', async () => {
    renderSection()
    const dialog = await openCreate()
    expectObscured(urlField(dialog))
    expect(urlField(dialog)).toHaveAttribute('data-openreplay-obscured')
  })

  it('текст ошибки поля URL (куски адреса) тоже под замазкой', async () => {
    renderSection()
    const dialog = await openCreate()
    fill(dialog, 'https://p.example/pb?c={click_id}&k={sk_live_AbCdEf}')
    const error = within(dialog).getByText(/url_macro_unknown \{sk_live_AbCdEf\}/)
    expect(error).toHaveAttribute('role', 'alert')
    expect(urlField(dialog)).toHaveAttribute('aria-describedby', error.id)
    expectObscured(error)
    // Контроль: ошибка соседнего поля не замазана — замазка не на всей форме.
    expect(
      field(dialog, 'credit.postbacks.rules.name').closest('[data-openreplay-obscured]')
    ).toBeNull()
  })

  it('подстановки значений на клиенте нет: в коде формы нет замены `{…}`', () => {
    expect(FORM_SOURCE.length, 'глоб потерял исходник формы').toBeGreaterThan(0)
    expect(FORM_SOURCE).not.toMatch(/\.replace(All)?\(/)
    // Контроль: замена в исходнике краснит проверку.
    const mutated = FORM_SOURCE.replace(
      'const EXAMPLE_URL',
      "const fill = (s: string) => s.replace(/\\{click_id\\}/g, 'x')\nconst EXAMPLE_URL"
    )
    expect(mutated, 'контроль не построен').not.toBe(FORM_SOURCE)
    expect(mutated).toMatch(/\.replace(All)?\(/)
  })
})
