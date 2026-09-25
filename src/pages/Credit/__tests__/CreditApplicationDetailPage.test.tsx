/**
 * Карточка заявки: идентификаторы, которых оператор не видел.
 *
 * CEO считал, что «идентификатор заявки» уже показан. Показан был номер
 * (CA-000208) — им заявку ищет оператор. Но разработчик модуля ищет по
 * `application_id`, партнёр — по `external_application_id`, а повтор решения
 * (`/decisions/{id}/replay`) требует `decision_id`; ни один из трёх не был на
 * экране, и первый существовал только в адресной строке.
 *
 * Отдельно защищается ЧЕСТНОСТЬ пустого значения: у заявки без решения строка
 * «ID рішення» обязана остаться с прочерком. Спрятать её — значит заставить
 * оператора искать поле, которое он видел на соседней карточке.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import type { CreditApplicationDetail, CreditDecision } from '@/features/credit/api/types'

// Страница ищет клиента CRM по телефону заёмщика (см. CreditClientLink), поэтому
// ей нужен клиент запросов. Запрос в тестах не уходит: телефона в фикстурах нет,
// а хук включается только при непустом телефоне — но провайдер обязан быть.
const withQuery = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
)

vi.mock('@/features/credit/hooks/useCredit')
// Мок печатает ключ вместе с подстановками — иначе не видно, ЧТО ушло в строку.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && typeof vars === 'object'
        ? `${key} ${Object.entries(vars)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(' ')}`
        : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ applicationId: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197' }),
}))

/** Снимок живого ответа стенда `GET /applications/{id}` (CA-000208). */
const APPLICATION = {
  application_id: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197',
  external_application_id: 'debe20f4-2308-41a1-b9ba-bd20d7576ef9',
  number: 'CA-000208',
  status: 'in_progress',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 30_000,
  client_email: 'info+eyes1@loanbridge.ca',
  client_phone: null,
  created_at: '2026-08-31T20:07:08.091139+00:00',
  updated_at: '2026-08-31T20:48:41.882126+00:00',
  expires_at: '2026-09-01T20:07:08.103297+00:00',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
  project_id: 1,
  client_id: null,
  // Заявка ещё в анкете: решения нет, кредита нет — самый частый случай в очереди.
  decision_id: null,
  loan_id: null,
  resume_step: 'address',
  missing_fields: ['address', 'phones', 'income', 'params', 'bank_verification'],
  paydays: [],
  consents: [],
  audit: [],
  draft: { personal: { first_name: 'Eyes', last_name: 'Return' } },
  documents: [],
} as unknown as CreditApplicationDetail

const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

function renderPage(application: CreditApplicationDetail = APPLICATION) {
  vi.mocked(hooks.useCreditApplication).mockReturnValue({
    ...idle,
    data: application,
  } as unknown as ReturnType<typeof hooks.useCreditApplication>)
  vi.mocked(hooks.useCreditOverview).mockReturnValue(idle as never)
  vi.mocked(hooks.useCreditManualDecision).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never)
  return render(<MemoryRouter>{withQuery(<CreditApplicationDetailPage />)}</MemoryRouter>)
}

describe('CreditApplicationDetailPage → идентификаторы', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('показывает UUID заявки и внешний ID партнёра', () => {
    renderPage()
    expect(screen.getByText('6a547e31-ba5e-4723-a2ea-ea55c8ef5197')).toBeInTheDocument()
    expect(screen.getByText('debe20f4-2308-41a1-b9ba-bd20d7576ef9')).toBeInTheDocument()
  })

  it('оставляет строку решения с прочерком, пока решения нет', () => {
    renderPage()
    const row = screen.getByText('credit.fields.decisionId').parentElement
    expect(row?.textContent).toContain('—')
  })

  it('показывает ID решения и кредита, как только они появились', () => {
    renderPage({
      ...APPLICATION,
      status: 'disbursed',
      decision_id: 'c0ffee00-1111-2222-3333-444444444444',
      loan_id: 'a249ee86-b723-483a-bbba-1ad400cc5bdd',
    } as CreditApplicationDetail)
    expect(screen.getByText('c0ffee00-1111-2222-3333-444444444444')).toBeInTheDocument()
    expect(screen.getByText('a249ee86-b723-483a-bbba-1ad400cc5bdd')).toBeInTheDocument()
  })
})

describe('CreditApplicationDetailPage → этап заявки доезжает до ленты', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('передаёт ленте три поля этапа, а не обрезанную заявку', () => {
    // Единственная точка стыка — <CreditStageProgress application={application} />.
    // Компонентные случаи подают поля НАПРЯМУЮ в проп, минуя страницу, поэтому
    // обрезка объекта на вызове (`{ status, missing_fields }`) откатила бы CRM
    // к своей старой нумерации из зеркала и осталась бы зелёной: вход
    // помощника структурный, и сужённый объект ему подходит, а утверждения
    // сборки ловят только УДАЛЕНИЕ поля из типа.
    renderPage({
      ...APPLICATION,
      stage: 'decision',
      stage_index: 4,
      stage_total: 5,
    } as CreditApplicationDetail)
    // Маркер именно ответа модуля: зеркало на этой фикстуре
    // (`missing_fields` с анкетой) назвало бы ВТОРОЙ шаг, а подписи «крок N з M»
    // не нарисовало бы вовсе — её нет ни в одной прежней сборке.
    expect(screen.getByText(/credit\.card\.stageOfTotal index=4 total=5/)).toBeVisible()
    const rows = Array.from(document.querySelectorAll('li')).map((li) =>
      (li.textContent ?? '').replace(/\s+/g, ' ')
    )
    expect(rows).toHaveLength(5)
    expect(rows[3]).toContain('credit.stage.decision')
    expect(rows[3]).toContain('credit.stageState.current')
    expect(rows[1]).not.toContain('credit.stageState.current')
  })
})

/**
 * Решение заменило прежнее (T-FE-6-04): модуль пересмотрел своё автоматическое
 * решение после смены реквизитов выплаты и указал `supersedes_decision_id`.
 *
 * Это указатель, а не ссылка: двери «решение по id» нет, заявка несёт только
 * действующее решение. Оператору нужен id прежнего — моноширинно и с
 * копированием, чтобы продиктовать его разработчику. Id разные: текущее
 * `d2d2…`, прежнее `d1d1…`, переопределения человеком нет (`null`).
 *
 * Ключа нет только у модуля старше B-3: ключ и пересмотр пришли одной правкой,
 * поэтому отсутствие ключа экран показывает как `null` (S-6), а не пустой строкой.
 */
describe('CreditApplicationDetailPage → решение заменяет прежнее', () => {
  const CURRENT = 'd2d2d2d2-2222-4222-8222-222222222222'
  const PREVIOUS = 'd1d1d1d1-1111-4111-8111-111111111111'

  const DECISION: CreditDecision = {
    decision_id: CURRENT,
    application_id: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197',
    outcome: 'approved',
    decision_mode: 'automatic',
    decline_codes: [],
    final_amount_minor: 30_000,
    currency: 'CAD',
    cooldown_until: null,
    ruleset_version: 'ca-ab-local@0.1.0',
    model_version: 'admission-stub@0',
    input_snapshot_id: 's1',
    underwriter_id: null,
    rationale: null,
    overrides_decision_id: null,
    supersedes_decision_id: PREVIOUS,
    decided_at: '2026-09-17T10:00:00Z',
  }

  const withDecision = (
    decision: CreditDecision,
    status: CreditApplicationDetail['status'] = 'approved'
  ) =>
    ({
      ...APPLICATION,
      status,
      decision,
      decision_id: decision.decision_id,
    }) as CreditApplicationDetail

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderDecision(
    application: CreditApplicationDetail,
    permissions: string[] = [],
    mutation: { mutate?: (payload: unknown) => void; isError?: boolean; error?: unknown } = {}
  ) {
    vi.mocked(hooks.useCreditApplication).mockReturnValue({
      ...idle,
      data: application,
    } as unknown as ReturnType<typeof hooks.useCreditApplication>)
    vi.mocked(hooks.useCreditOverview).mockReturnValue({
      ...idle,
      data: { permissions },
    } as never)
    vi.mocked(hooks.useCreditManualDecision).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      ...mutation,
    } as never)
    const view = render(<MemoryRouter>{withQuery(<CreditApplicationDetailPage />)}</MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: 'credit.tabs.decision' }))
    return view
  }

  const pointerRow = () => screen.getByText('credit.fields.supersedesDecision').parentElement

  it('S-1: показывает id прежнего решения моноширинно и копирует его', () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderDecision(withDecision(DECISION))

    const row = pointerRow()
    expect(row).not.toBeNull()
    const id = within(row as HTMLElement).getByText(PREVIOUS)
    expect(id.className).toContain('font-mono')
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'credit.actions.copy' }))
    expect(writeText).toHaveBeenCalledWith(PREVIOUS)
  })

  it('S-2: ничего не заменяло — строки нет, а панель решения на месте', () => {
    renderDecision(withDecision({ ...DECISION, supersedes_decision_id: null }))

    expect(screen.queryByText('credit.fields.supersedesDecision')).toBeNull()
    expect(screen.getByText('credit.card.currentDecision')).toBeInTheDocument()
    expect(screen.getByText('credit.fields.decidedAt')).toBeInTheDocument()
  })

  it('S-3: указатель — не ссылка: ни <a> в строке, ни href с этим id на странице', () => {
    renderDecision(withDecision(DECISION))

    const linkToPrevious = `a[href*="${PREVIOUS.slice(0, 8)}"]`
    expect(pointerRow()?.querySelector('a')).toBeNull()
    expect(document.querySelector(linkToPrevious)).toBeNull()
    // Контроль селектора: ссылку с этим id он находит — пустота выше значит
    // «ссылки нет», а не «селектор ничего не умеет найти».
    const probe = document.createElement('a')
    probe.setAttribute('href', `/dashboard/credit/decisions/${PREVIOUS}`)
    expect(probe.matches(linkToPrevious)).toBe(true)
  })

  it('S-4: в строке id прежнего решения, а не текущего', () => {
    renderDecision(withDecision(DECISION))

    const text = pointerRow()?.textContent ?? ''
    expect(text).toContain(PREVIOUS)
    expect(text).not.toContain(CURRENT)
  })

  it('S-5: указатель не гейтит ручное решение (REQ-FE-6-08)', () => {
    renderDecision(withDecision(DECISION, 'referred'), ['credit.decisions.decide'])

    expect(pointerRow()?.textContent).toContain(PREVIOUS)
    expect(screen.getByText('credit.card.manualDecision')).toBeInTheDocument()
  })

  it('S-6: ключа нет (модуль старше B-3) — строки нет, как при null, а панель решения на месте', () => {
    const lagging: Partial<CreditDecision> = { ...DECISION }
    delete lagging.supersedes_decision_id
    expect('supersedes_decision_id' in DECISION).toBe(true)
    expect('supersedes_decision_id' in lagging).toBe(false)

    renderDecision(withDecision(lagging as CreditDecision))

    expect(
      screen.queryByText('credit.fields.supersedesDecision'),
      'a decision without the supersedes key rendered the pointer row — absence was printed as an empty pointer'
    ).toBeNull()
    expect(screen.getByText('credit.card.currentDecision')).toBeInTheDocument()
    expect(screen.getByText('credit.fields.decidedAt')).toBeInTheDocument()
  })

  /**
   * Автор ручного решения — владелец пропуска CRM: модуль берёт его сам, а число
   * в теле считает лишь заявлением и отказывает, если оно чужое. Форма больше не
   * предлагает вписать номер и не шлёт его; три отказа модуля по пропуску оператор
   * читает текстом своего кода, а не русским `detail`.
   *
   * Сцена — та же, что S-5 (`referred` + право решать), поверх неё синтетический
   * заёмщик. «Текущее решение» и «Ручное решение» несут одни и те же ключи полей,
   * поэтому поиск по форме — только внутри её панели.
   */
  describe('ручное решение: автор — из пропуска, а не из формы', () => {
    const DETAIL = 'Синтетический отказ модуля: автор решения не совпадает с пропуском'
    const REFUSALS = [
      [403, 'operator_id_not_numeric', 'credit.decisionError.operatorIdNotNumeric'],
      [403, 'operator_id_ambiguous', 'credit.decisionError.operatorIdAmbiguous'],
      [422, 'underwriter_not_the_caller', 'credit.decisionError.underwriterNotTheCaller'],
    ] as const

    function renderManual(
      mutation: Parameters<typeof renderDecision>[2] = {},
      decision: CreditDecision = DECISION
    ) {
      renderDecision(
        {
          ...withDecision(decision, 'referred'),
          client_email: 'applicant.fe1722b@example.org',
          draft: { personal: { first_name: 'Тест', last_name: 'Синтетичний' } },
        } as CreditApplicationDetail,
        ['credit.decisions.decide'],
        mutation
      )
      return within(
        screen.getByText('credit.card.manualDecision').closest('section') as HTMLElement
      )
    }

    it('D-1: ввода автора в форме нет, а соседние поля формы на месте', () => {
      const panel = renderManual()

      expect(
        panel.queryByText('credit.fields.underwriterId'),
        'the manual decision form offers an author input again — any number typed there signs the decision'
      ).toBeNull()
      expect(panel.getByText('credit.fields.outcome')).toBeInTheDocument()
      expect(panel.getByText('credit.fields.rationale')).toBeInTheDocument()
      // Числовое поле в форме одно — сумма одобрения; поиск умеет его найти.
      expect(
        panel.getAllByRole('spinbutton'),
        'the manual decision form has a numeric input besides the approved amount'
      ).toHaveLength(1)
      expect(panel.getByText('credit.fields.finalAmount')).toContainElement(
        panel.getByRole('spinbutton')
      )
      // Текстовый ввод в форме один — обоснование; поиск умеет его найти.
      expect(
        panel.getAllByRole('textbox'),
        'the manual decision form has a text input besides the rationale'
      ).toHaveLength(1)
      expect(panel.getByRole('textbox')).toBe(
        panel.getByPlaceholderText('credit.card.rationalePlaceholder')
      )
    })

    it.each([
      ['approved', ['final_amount_minor', 'outcome', 'rationale']],
      ['declined', ['decline_codes', 'outcome', 'rationale']],
      ['referred', ['outcome', 'rationale']],
    ] as const)('D-2: исход %s уходит без автора в теле', (outcome, keys) => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      fireEvent.change(panel.getByRole('combobox'), { target: { value: outcome } })
      fireEvent.change(panel.getByPlaceholderText('credit.card.rationalePlaceholder'), {
        target: { value: 'Синтетичне обґрунтування ручного рішення' },
      })
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))

      expect(mutate).toHaveBeenCalledTimes(1)
      const payload = mutate.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(payload).sort(), `the ${outcome} body carries unexpected keys`).toEqual([
        ...keys,
      ])
      expect(
        'underwriter_id' in payload,
        'the form sends the decision author in the body again'
      ).toBe(false)
    })

    it.each([
      [103, '103'],
      [null, '—'],
    ] as const)('D-3: автор решения %s показан строкой «Андеррайтер»', (underwriter, shown) => {
      renderManual({}, { ...DECISION, underwriter_id: underwriter })

      const label = screen.queryByText('credit.fields.underwriter')
      expect(label, 'the current decision lost its author row').not.toBeNull()
      expect(
        label?.parentElement?.textContent,
        'the author row shows something other than the author the module recorded'
      ).toBe(`credit.fields.underwriter${shown}`)
    })

    it.each(REFUSALS)('D-4: %i %s — текст оператора, а не detail модуля', (status, code, key) => {
      const panel = renderManual({ isError: true, error: new CreditApiError(DETAIL, status, code) })

      expect(
        panel.queryByText(key),
        `the ${code} refusal is not named by its own text`
      ).not.toBeNull()
      expect(
        panel.queryByText(DETAIL),
        `the operator reads the module's raw Russian detail for ${code}`
      ).toBeNull()
    })

    it.each([
      ['422 validation_failed', new CreditApiError(DETAIL, 422, 'validation_failed'), DETAIL],
      ['403 шлюза без кода', new CreditApiError('Forbidden', 403), 'Forbidden'],
      ['не ошибка модуля', new Error('Network Error'), 'Network Error'],
    ] as const)('D-5: %s — прежний текст дословно', (_scene, error, shown) => {
      const panel = renderManual({ isError: true, error })

      // Тот же поиск, что в D-4, находит тот же detail — пустота там значит
      // «текста нет», а не «поиск его не видит».
      expect(
        panel.queryByText(shown),
        'a refusal outside the three codes lost its message'
      ).not.toBeNull()
      expect(
        panel.queryByText(/credit\.decisionError\./),
        'a refusal outside the three codes is shown as a pass refusal'
      ).toBeNull()
    })

    it.each(REFUSALS)('D-6: %i %s — одна плашка, и текст в ней', (status, code, key) => {
      const panel = renderManual({ isError: true, error: new CreditApiError(DETAIL, status, code) })

      const alerts = panel.getAllByRole('alert')
      expect(alerts, 'the manual decision refusal is drawn as more than one plate').toHaveLength(1)
      expect(alerts[0].textContent, 'the refusal plate holds something other than its text').toBe(
        key
      )
    })

    it.each([
      ['Error с пустым сообщением', new Error('')],
      ['Error с одними пробелами', new Error('   ')],
      ['брошена строка', 'Синтетический отказ строкой'],
      ['брошен объект с message', { message: DETAIL }],
    ] as const)('D-7: %s — общий текст отказа, плашка не пуста', (_scene, error) => {
      const panel = renderManual({ isError: true, error })

      const alerts = panel.getAllByRole('alert')
      expect(alerts, 'the manual decision refusal is drawn as more than one plate').toHaveLength(1)
      expect(
        alerts[0].textContent,
        'a refusal without an Error message left the plate without the generic refusal text'
      ).toBe('credit.decisionError.generic')
    })
  })
})
