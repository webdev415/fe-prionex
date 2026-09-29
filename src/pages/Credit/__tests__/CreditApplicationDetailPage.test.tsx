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
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { indexDecisionCodes } from '@/features/credit/api/decisionCodes'
import ukCommon from '@/../public/locales/uk/common.json'
import {
  DECISION_CODES_FIXTURE,
  entryOf,
} from '@/features/credit/api/__tests__/decisionCodesFixture'
import type {
  CreditApplicationDetail,
  CreditDecision,
  CreditDecisionCodeEntry,
  CreditDecisionCodesRegistry,
} from '@/features/credit/api/types'

// Страница ищет клиента CRM по телефону заёмщика (см. CreditClientLink), поэтому
// ей нужен клиент запросов. Запрос в тестах не уходит: телефона в фикстурах нет,
// а хук включается только при непустом телефоне — но провайдер обязан быть.
const withQuery = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
)

vi.mock('@/features/credit/hooks/useCredit')
// Язык интерфейса мока — `uk`; сцена другого языка меняет его у себя и
// возвращает в `finally`.
const i18nState = vi.hoisted(() => ({ language: 'uk' }))
// Мок печатает ключ вместе с подстановками — иначе не видно, ЧТО ушло в строку.
// `defaultValue` он не печатает, а отвечает им, как i18next: только когда ключа
// нет ни в словаре языка интерфейса, ни в запасном `en`. «Строки в словаре
// нет» — так свойство настоящих словарей, а не договорённость сцены.
vi.mock('react-i18next', async () => {
  const dictionaries: Record<string, unknown> = {
    uk: (await import('@/../public/locales/uk/common.json')).default,
    en: (await import('@/../public/locales/en/common.json')).default,
    es: (await import('@/../public/locales/es/common.json')).default,
  }
  const has = (dictionary: unknown, key: string) =>
    typeof key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        dictionary
      ) === 'string'
  const print = (key: string, vars: Record<string, unknown>) =>
    `${key} ${Object.entries(vars)
      .map(([name, value]) => `${name}=${String(value)}`)
      .join(' ')}`
  return {
    useTranslation: () => ({
      t: (key: string, vars?: Record<string, unknown>) => {
        if (!vars || typeof vars !== 'object') return key
        if (!('defaultValue' in vars)) return print(key, vars)
        const { defaultValue, ...rest } = vars
        if (!has(dictionaries[i18nState.language], key) && !has(dictionaries.en, key)) {
          return String(defaultValue)
        }
        return Object.keys(rest).length ? print(key, rest) : key
      },
      i18n: { language: i18nState.language, changeLanguage: vi.fn() },
    }),
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})
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

  /**
   * Состояние справочника кодов решения. По умолчанию — загружен срезом живого
   * реестра: хук автомокнут, и забытый мок дал бы `undefined` и уронил бы всю
   * группу на деструктуризации, а не сцену про справочник.
   */
  type CodesState = {
    data?: ReturnType<typeof indexDecisionCodes>
    isError?: boolean
    error?: unknown
    isFetching?: boolean
    isPaused?: boolean
    isPending?: boolean
    isLoading?: boolean
    refetch?: () => unknown
  }
  const codesLoaded = (): CodesState => ({ data: indexDecisionCodes(DECISION_CODES_FIXTURE) })

  function renderDecision(
    application: CreditApplicationDetail,
    permissions: string[] = [],
    mutation: { mutate?: (payload: unknown) => void; isError?: boolean; error?: unknown } = {},
    codes: CodesState = codesLoaded()
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
    vi.mocked(hooks.useCreditDecisionCodes).mockReturnValue({
      data: undefined,
      isError: false,
      error: null,
      isFetching: false,
      isPaused: false,
      refetch: vi.fn(),
      ...codes,
    } as never)
    const view = render(<MemoryRouter>{withQuery(<CreditApplicationDetailPage />)}</MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: 'credit.tabs.decision' }))
    return view
  }

  const pointerRow = () => screen.getByText('credit.fields.supersedesDecision').parentElement

  /**
   * Форма ручного решения: сцена S-5 (`referred` + право решать) поверх неё
   * синтетический заёмщик. «Текущее решение» и «Ручное решение» несут одни и те
   * же ключи полей, поэтому поиск по форме — только внутри её панели.
   */
  function renderManual(
    mutation: Parameters<typeof renderDecision>[2] = {},
    decision: CreditDecision = DECISION,
    codes: CodesState = codesLoaded()
  ) {
    renderDecision(
      {
        ...withDecision(decision, 'referred'),
        client_email: 'applicant.fe1722b@example.org',
        draft: { personal: { first_name: 'Тест', last_name: 'Синтетичний' } },
      } as CreditApplicationDetail,
      ['credit.decisions.decide'],
      mutation,
      codes
    )
    return within(screen.getByText('credit.card.manualDecision').closest('section') as HTMLElement)
  }

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
   * Сцена — та же, что S-5 (`referred` + право решать): `renderManual` выше.
   */
  describe('ручное решение: автор — из пропуска, а не из формы', () => {
    const DETAIL = 'Синтетический отказ модуля: автор решения не совпадает с пропуском'
    const REFUSALS = [
      [403, 'operator_id_not_numeric', 'credit.decisionError.operatorIdNotNumeric'],
      [403, 'operator_id_ambiguous', 'credit.decisionError.operatorIdAmbiguous'],
      [422, 'underwriter_not_the_caller', 'credit.decisionError.underwriterNotTheCaller'],
    ] as const

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
      // Отказ без кода не отправляется (19-1f): код выбирается из справочника.
      if (outcome === 'declined') {
        fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-13/ }))
      }
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))

      expect(mutate).toHaveBeenCalledTimes(1)
      const payload = mutate.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(payload).sort(), `the ${outcome} body carries unexpected keys`).toEqual([
        ...keys,
      ])
      if (outcome === 'declined') {
        expect(
          payload.decline_codes,
          'the declined body does not carry the registry code the operator chose'
        ).toEqual(['AB-O-13'])
      }
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

  /**
   * Отказ — только кодом книги правил, и форма берёт коды из справочника модуля.
   *
   * До 19-1f форма предлагала три служебных `RC-*` литералом и пропускала отказ
   * без кода (модуль отвечал `422`). Справочник теперь приходит дверью модуля;
   * к отказу предлагаются коды отказа, автогейта и служебный, но не условное
   * одобрение `AB-C-*`. Мок `t` печатает ключ, язык мока — `uk`: первой
   * строкой кода идёт RU книги, второй — EN.
   */
  describe('ручное решение: коды из справочника модуля', () => {
    const RATIONALE = 'Синтетичне обґрунтування відмови'

    function declineWith(panel: ReturnType<typeof within>) {
      fireEvent.change(panel.getByRole('combobox'), { target: { value: 'declined' } })
      fireEvent.change(panel.getByPlaceholderText('credit.card.rationalePlaceholder'), {
        target: { value: RATIONALE },
      })
    }

    const saveButton = (panel: ReturnType<typeof within>) =>
      panel.getByRole('button', { name: 'credit.actions.saveDecision' })

    const codeRow = (panel: ReturnType<typeof within>, id: string) =>
      panel.getByRole('checkbox', { name: new RegExp(id) }).closest('label') as HTMLElement

    it('F-1: коды разложены по разделам книги, у чекбокса — id и текст книги', () => {
      // Вход перевёрнут: ответ модуля отсортирован по `id`, и порядок формы
      // совпал бы с ним сам собой. Перевёрнутый ставит `AB-O-09` раньше `AB-O-08`.
      const reversed: CreditDecisionCodesRegistry = {
        version: 'book@reversed',
        codes: [...DECISION_CODES_FIXTURE.codes].reverse(),
      }
      const index = indexDecisionCodes(reversed)
      const panel = renderManual({}, DECISION, { data: index })
      declineWith(panel)

      for (const group of index.declineGroups) {
        const legend = panel.getByText(`credit.decisionCodeCategory.${group.category}`)
        expect(legend.tagName, `the ${group.category} section is not a fieldset legend`).toBe(
          'LEGEND'
        )
        for (const entry of group.codes) {
          expect(legend.closest('fieldset')).toContainElement(
            panel.getByRole('checkbox', { name: new RegExp(entry.id) })
          )
        }
      }
      const idsIn = (category: string) =>
        within(
          panel
            .getByText(`credit.decisionCodeCategory.${category}`)
            .closest('fieldset') as HTMLElement
        )
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')?.textContent?.split(' ')[0])
      expect(
        idsIn('loan_terms'),
        'inside a section the gate AB-G-06 came before the refusal AB-O-05'
      ).toEqual(['AB-O-05', 'AB-G-06'])
      expect(
        idsIn('conduct'),
        'inside a section two refusals are not ordered by id — AB-O-09 came before AB-O-08'
      ).toEqual(['AB-O-08', 'AB-O-09'])
      const escaped = entryOf('AB-O-13').ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(
        panel.getByRole('checkbox', { name: /AB-O-13/ }),
        'the AB-O-13 checkbox is not named by its id and the book text'
      ).toHaveAccessibleName(new RegExp(`^AB-O-13 ${escaped}`))
      expect(panel.getAllByRole('checkbox')).toHaveLength(7)
    })

    it('F-2: служебных RC-* в форме нет — ни чекбоксом, ни кнопкой, ни текстом', () => {
      const panel = renderManual()
      declineWith(panel)

      expect(
        panel.queryAllByRole('checkbox', { name: /RC-\d{2}/ }),
        'the form offers a service RC-* code as a checkbox again'
      ).toHaveLength(0)
      expect(
        panel.queryAllByRole('button', { name: /RC-\d{2}/ }),
        'the form offers the literal RC-* chips again'
      ).toHaveLength(0)
      expect(
        panel.queryByText(/RC-[01]\d/),
        'a service RC-* code is printed in the manual decision form'
      ).toBeNull()
      // Поиск умеет найти код: иначе пустота выше ничего не значила бы.
      expect(panel.getAllByRole('checkbox').length).toBeGreaterThan(0)
    })

    it('F-3: условного одобрения AB-C-* нет, автогейт и служебный код есть', () => {
      const panel = renderManual()
      declineWith(panel)

      expect(
        panel.queryByRole('checkbox', { name: /AB-C-01/ }),
        'the form offers the conditional approval AB-C-01 as a refusal'
      ).toBeNull()
      expect(
        panel.queryByRole('checkbox', { name: /AB-G-06/ }),
        'the form lost the calculator gate AB-G-06'
      ).not.toBeNull()
      expect(
        panel.queryByRole('checkbox', { name: /AB-X-08/ }),
        'the form lost the service code AB-X-08'
      ).not.toBeNull()
    })

    const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tooltipRows = (panel: ReturnType<typeof within>) =>
      panel
        .getAllByRole('checkbox')
        .map((box: HTMLElement) => box.closest('label') as HTMLElement)
        .filter((row: HTMLElement) => row.hasAttribute('title') || row.querySelector('[title]'))

    /**
     * Основание книги (`note_ru`) — третьей приглушённой строкой внутри метки,
     * а не `title`: подсказку видит только мышь. Текст в метке виден глазу и
     * входит в имя чекбокса — его слышит скринридер и получает клавиатура.
     */
    it('F-4: украинский интерфейс — первой строкой RU книги, второй EN, третьей основание книги', () => {
      const panel = renderManual()
      declineWith(panel)

      const text = codeRow(panel, 'AB-O-13').textContent ?? ''
      const { ru, en } = entryOf('AB-O-13')
      expect(text.indexOf(ru), 'the book text of AB-O-13 is missing').toBeGreaterThan(-1)
      expect(
        text.indexOf(en),
        'the uk interface shows the English text of AB-O-13 before the book text'
      ).toBeGreaterThan(text.indexOf(ru))
      expect(
        text,
        'a code without a book rationale (AB-O-13) got an extra line under the uk interface'
      ).toBe(`AB-O-13 ${ru}${en}`)

      const withNote = entryOf('AB-O-05')
      const note = withNote.note_ru ?? ''
      expect(
        note,
        'the fixture lost the book rationale of AB-O-05 — the scene proves nothing'
      ).not.toBe('')
      expect(
        codeRow(panel, 'AB-O-05').textContent,
        'the uk interface does not show the book rationale of AB-O-05 as the third line of the row'
      ).toBe(`AB-O-05 ${withNote.ru}${withNote.en}${note}`)
      expect(
        within(codeRow(panel, 'AB-O-05')).getByText(note),
        'the book rationale is not a line of its own'
      ).toBeInTheDocument()
      expect(
        panel.getByRole('checkbox', { name: /AB-O-05/ }),
        'the book rationale is not part of the checkbox name — a screen reader does not hear it'
      ).toHaveAccessibleName(new RegExp(escapeRe(note)))
      expect(
        tooltipRows(panel),
        'a code row still carries a hover-only title tooltip'
      ).toHaveLength(0)
    })

    it('F-4: английский интерфейс — первой строкой EN, русского основания нет ни строкой, ни подсказкой', () => {
      i18nState.language = 'en'
      try {
        const panel = renderManual()
        declineWith(panel)

        const text = codeRow(panel, 'AB-O-05').textContent ?? ''
        const { ru, en, note_ru: note } = entryOf('AB-O-05')
        expect(
          text.indexOf(en),
          'the en interface shows the book Russian text of AB-O-05 before the English one'
        ).toBeLessThan(text.indexOf(ru))
        expect(text.indexOf(en)).toBeGreaterThan(-1)
        expect(
          note,
          'the fixture lost the book rationale of AB-O-05 — the scene proves nothing'
        ).toBeTruthy()
        expect(
          text,
          'the en interface shows the Russian-only book rationale of AB-O-05 as a line'
        ).toBe(`AB-O-05 ${en}${ru}`)
        expect(
          tooltipRows(panel),
          'the en interface shows the Russian-only book rationale as a tooltip'
        ).toHaveLength(0)
      } finally {
        i18nState.language = 'uk'
      }
    })

    it('F-5: отказ без кода не уходит; выбранный код уходит в теле', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })
      declineWith(panel)

      expect(saveButton(panel), 'a decline without a code can be saved').toBeDisabled()
      fireEvent.click(saveButton(panel))
      expect(mutate, 'a decline without a code reached the module').not.toHaveBeenCalled()

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-13/ }))
      expect(saveButton(panel)).toBeEnabled()
      fireEvent.click(saveButton(panel))

      expect(mutate).toHaveBeenCalledTimes(1)
      expect(mutate.mock.calls[0][0]).toEqual({
        outcome: 'declined',
        rationale: RATIONALE,
        decline_codes: ['AB-O-13'],
      })

      // Снятый выбор — снова «без кода».
      fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-13/ }))
      expect(saveButton(panel), 'unchecking the only code left the save enabled').toBeDisabled()
    })

    it('F-5: два кода уходят без повторов и по возрастанию, в каком порядке ни выбирай', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })
      declineWith(panel)

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-20/ }))
      fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-13/ }))
      fireEvent.click(saveButton(panel))

      expect((mutate.mock.calls[0][0] as { decline_codes: string[] }).decline_codes).toEqual([
        'AB-O-13',
        'AB-O-20',
      ])
    })

    it('F-6: справочник недоступен — одна плашка и «Повторити»; отказ закрыт, одобрение работает', () => {
      const mutate = vi.fn()
      const refetch = vi.fn()
      const panel = renderManual({ mutate }, DECISION, { isError: true, refetch })
      declineWith(panel)

      const alerts = panel.getAllByRole('alert')
      expect(alerts, 'the directory failure is drawn as more than one plate').toHaveLength(1)
      expect(alerts[0].textContent).toBe('credit.card.decisionCodesUnavailable')
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.retry' }))
      expect(refetch, 'retry did not re-request the directory').toHaveBeenCalledTimes(1)
      expect(panel.queryAllByRole('checkbox')).toHaveLength(0)
      expect(saveButton(panel), 'a decline can be saved without the directory').toBeDisabled()

      fireEvent.change(panel.getByRole('combobox'), { target: { value: 'approved' } })
      expect(saveButton(panel)).toBeEnabled()
      fireEvent.click(saveButton(panel))
      expect(mutate, 'approval stopped working while the directory is down').toHaveBeenCalledTimes(
        1
      )
      expect((mutate.mock.calls[0][0] as { outcome: string }).outcome).toBe('approved')
    })

    it('F-6: повтор уже в пути — «Повторити» закрыта, второй запрос не уходит', () => {
      const refetch = vi.fn()
      const panel = renderManual({}, DECISION, { isError: true, isFetching: true, refetch })
      declineWith(panel)

      expect(panel.getAllByRole('alert'), 'the directory failure plate is gone').toHaveLength(1)
      // В загрузке кнопка несёт текст загрузки, а не «Повторити», — поэтому она
      // ищется как единственная кнопка панели, кроме «Зберегти».
      const retry = panel.getAllByRole('button').filter((button) => button !== saveButton(panel))
      expect(retry, 'the directory failure lost its retry button').toHaveLength(1)
      expect(
        retry[0],
        'the retry button stays clickable while the retry is in flight'
      ).toBeDisabled()
      fireEvent.click(retry[0])
      expect(
        refetch,
        'a second directory request left while the first one is in flight'
      ).not.toHaveBeenCalled()
    })

    /**
     * 404 — у модуля нет двери справочника (он старше 0.1.27), 403 — роли не
     * дают его читать. Повтор этого не вылечит, поэтому текст называет причину и
     * «Повторити» нет. 503 — временный сбой: прежний текст и повтор. 503 здесь —
     * положительный контроль того же поиска кнопки.
     */
    it.each([
      [404, 'credit.card.decisionCodesModuleTooOld', false],
      [403, 'credit.card.decisionCodesForbidden', false],
      [503, 'credit.card.decisionCodesUnavailable', true],
    ] as const)(
      'F-10: справочник ответил %i — плашка %s, повтор предлагается: %s',
      (status, key, retryOffered) => {
        const refetch = vi.fn()
        const panel = renderManual({}, DECISION, {
          isError: true,
          error: new CreditApiError('Синтетичний збій довідника', status),
          refetch,
        })
        declineWith(panel)

        const alerts = panel.getAllByRole('alert')
        expect(
          alerts,
          `the ${status} directory failure is drawn as more than one plate`
        ).toHaveLength(1)
        expect(
          alerts[0].textContent,
          `the ${status} directory failure is not named by its own text`
        ).toBe(key)
        const retry = panel.queryByRole('button', { name: 'credit.actions.retry' })
        if (retryOffered) {
          expect(retry, `the transient ${status} failure lost its retry button`).not.toBeNull()
        } else {
          expect(
            retry,
            `the permanent ${status} failure invites the operator to retry forever`
          ).toBeNull()
        }
        expect(panel.queryAllByRole('checkbox')).toHaveLength(0)
        expect(saveButton(panel), 'a decline can be saved without the directory').toBeDisabled()
      }
    )

    it('F-7: без права решать справочник не запрашивается', () => {
      renderDecision(withDecision(DECISION, 'referred'), [])
      const calls = vi.mocked(hooks.useCreditDecisionCodes).mock.calls

      expect(calls.length, 'the decision tab did not ask for the directory at all').toBeGreaterThan(
        0
      )
      expect(
        calls.every(([enabled]) => enabled === false),
        'the directory is requested without credit.decisions.decide — the door answers 403'
      ).toBe(true)

      // Контроль: с правом тот же поиск видит `true`.
      cleanup()
      vi.mocked(hooks.useCreditDecisionCodes).mockClear()
      renderManual()
      expect(vi.mocked(hooks.useCreditDecisionCodes).mock.calls.at(-1)).toEqual([true])
    })

    it('F-8: справочник грузится — строка загрузки, отказ пока закрыт', () => {
      // «Грузится» для страницы — это нет данных, нет ошибки и запрос не на
      // паузе: ветка формы `directory ? … : isError || isPaused ? … :
      // загрузка`, флаг `isLoading` она не читает. Поэтому в моке его нет: он
      // ничего бы здесь не проверял. Пауза — сцена F-11.
      const panel = renderManual({}, DECISION, { data: undefined, isError: false })
      declineWith(panel)

      expect(panel.getByText('credit.card.decisionCodesLoading')).toBeInTheDocument()
      expect(panel.queryAllByRole('checkbox')).toHaveLength(0)
      expect(saveButton(panel)).toBeDisabled()
    })

    /**
     * Запрос, начатый без сети, React Query ставит на паузу
     * (`networkMode: 'online'`): данных нет, ошибки нет, `isPending` и
     * `isLoading` — `true`. Без своей ветки форма рисовала «Завантажуємо…»
     * бесконечно при закрытом отказе. Пауза — временный сбой: плашка про сеть
     * и тот же повтор. Второй случай — пауза повторного запроса после
     * временной ошибки: причина сейчас та же — нет сети.
     */
    it.each([
      ['первый запрос', { isError: false, error: null }],
      [
        'повтор после временной ошибки',
        { isError: true, error: new CreditApiError('Синтетичний збій довідника', 503) },
      ],
    ] as const)(
      'F-11: справочник на паузе без сети (%s) — плашка про сеть и «Повторити», вечной загрузки нет',
      (_case, failure) => {
        const refetch = vi.fn()
        const panel = renderManual({}, DECISION, {
          data: undefined,
          ...failure,
          isPaused: true,
          isPending: true,
          isLoading: true,
          isFetching: false,
          refetch,
        })
        declineWith(panel)

        expect(
          panel.queryByText('credit.card.decisionCodesLoading'),
          'a paused directory query shows the loading line forever'
        ).toBeNull()
        const alerts = panel.getAllByRole('alert')
        expect(alerts, 'the paused directory is drawn as more than one plate').toHaveLength(1)
        expect(
          alerts[0].textContent,
          'the paused directory query is not named as a lost network connection'
        ).toBe('credit.card.decisionCodesOffline')
        fireEvent.click(panel.getByRole('button', { name: 'credit.actions.retry' }))
        expect(refetch, 'retry did not re-request the paused directory').toHaveBeenCalledTimes(1)
        expect(panel.queryAllByRole('checkbox')).toHaveLength(0)
        expect(saveButton(panel), 'a decline can be saved without the directory').toBeDisabled()
      }
    )

    it('F-9: код выпал из новой версии справочника — отказ им не открыть, в тело он не уходит', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })
      declineWith(panel)
      fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-13/ }))
      expect(saveButton(panel)).toBeEnabled()

      // Перезапрос принёс новую версию реестра: `AB-O-13` в ней — условное
      // одобрение. В индексе он есть, к отказу больше не предлагается.
      const next: CreditDecisionCodesRegistry = {
        version: 'book@fe-c1',
        codes: DECISION_CODES_FIXTURE.codes.map(
          (entry): CreditDecisionCodeEntry =>
            entry.id === 'AB-O-13' ? { ...entry, kind: 'conditional' } : entry
        ),
      }
      vi.mocked(hooks.useCreditDecisionCodes).mockReturnValue({
        data: indexDecisionCodes(next),
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
      } as never)
      // Перерисовка забирает новый ответ хука: оператор дописал обоснование.
      fireEvent.change(panel.getByPlaceholderText('credit.card.rationalePlaceholder'), {
        target: { value: `${RATIONALE}.` },
      })

      expect(
        panel.queryByRole('checkbox', { name: /AB-O-13/ }),
        'the new directory version still offers AB-O-13 — the scene proves nothing'
      ).toBeNull()
      expect(
        saveButton(panel),
        'a code the directory no longer offers still opens the decline'
      ).toBeDisabled()
      fireEvent.click(saveButton(panel))
      expect(
        mutate,
        'a decline with only a withdrawn code reached the module'
      ).not.toHaveBeenCalled()

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-20/ }))
      fireEvent.click(saveButton(panel))
      expect(mutate).toHaveBeenCalledTimes(1)
      expect(
        (mutate.mock.calls[0][0] as { decline_codes: string[] }).decline_codes,
        'a code the directory no longer offers left in the decision body'
      ).toEqual(['AB-O-20'])
    })

    const DECLINED: CreditDecision = {
      ...DECISION,
      outcome: 'declined',
      decision_mode: 'manual',
      final_amount_minor: null,
      supersedes_decision_id: null,
    }

    const codesRow = () =>
      screen.getByText('credit.fields.declineCodes').parentElement?.textContent ?? ''

    const renderCard = (decision: CreditDecision, codes?: CodesState) =>
      renderDecision(
        withDecision(decision, 'declined'),
        ['credit.decisions.decide'],
        {},
        codes ?? codesLoaded()
      )

    it('C-1: смысл — кодом реестра, а присланный RC-* — приглушённо «как прислано»', () => {
      renderCard({ ...DECLINED, decline_codes: ['RC-04'], decision_codes: ['AB-O-05'] })

      const row = codesRow()
      expect(row, 'the card shows the code as sent instead of its registry meaning').toContain(
        'AB-O-05'
      )
      expect(row).toContain(entryOf('AB-O-05').ru)
      expect(row).toContain('credit.decisionCodeCategory.loan_terms')
      expect(row, 'the code the operator sent is hidden').toContain(
        'credit.card.declineCodesSent codes=RC-04'
      )
      expect(row).not.toContain('credit.declineCode.RC-04')
    })

    it('C-2: присланное совпало со смыслом — строки «Надіслано» нет', () => {
      renderCard({ ...DECLINED, decline_codes: ['AB-O-13'], decision_codes: ['AB-O-13'] })

      const row = codesRow()
      expect(row).toContain(entryOf('AB-O-13').ru)
      expect(row).not.toContain('credit.card.declineCodesSent')
    })

    it.each(['automatic', 'override'] as const)(
      'C-6: решение %s — строки «Надіслано» нет: коды прислал не оператор ручного решения',
      (mode) => {
        renderCard({
          ...DECLINED,
          decision_mode: mode,
          decline_codes: ['RC-04'],
          decision_codes: ['AB-O-05'],
        })

        const row = codesRow()
        expect(row).toContain(entryOf('AB-O-05').ru)
        expect(row, `the ${mode} decision is labelled as codes sent by the operator`).not.toContain(
          'credit.card.declineCodesSent'
        )
      }
    )

    it('C-3: ключа decision_codes нет (модуль старше 0.1.27) — прежний вывод словарём', () => {
      const lagging: Partial<CreditDecision> = { ...DECLINED, decline_codes: ['RC-11'] }
      delete lagging.decision_codes
      expect('decision_codes' in lagging).toBe(false)

      renderCard(lagging as CreditDecision)

      expect(codesRow(), 'a decision of an older module lost the old decline code text').toBe(
        'credit.fields.declineCodesRC-11 — credit.declineCode.RC-11'
      )
    })

    it('C-4: справочник недоступен — код реестра показан своим id, страница цела', () => {
      renderCard(
        { ...DECLINED, decline_codes: ['AB-O-13'], decision_codes: ['AB-O-13'] },
        { isError: true }
      )

      const row = codesRow()
      expect(row).toContain('AB-O-13')
      expect(row).not.toContain(entryOf('AB-O-13').ru)
      expect(screen.getByText('credit.fields.decidedAt')).toBeInTheDocument()
    })

    it('C-5: оба списка пусты — прочерк', () => {
      renderCard({ ...DECLINED, decline_codes: [], decision_codes: [] })

      expect(codesRow()).toBe('credit.fields.declineCodes—')
    })

    /**
     * Роль без `credit.decisions.decide` открывает карточку, но справочник ей
     * закрыт тем же правом: запрос не уходит, `data` нет. До справочника такая
     * роль читала `RC-04 — <текст словаря>`; теперь она обязана читать то же, а
     * коды справочника — приглушённой строкой с подписью, а не голыми `id`.
     * Сцена с правом и справочником на той же паре кодов — C-1.
     */
    it('C-7: без права решать — прежний текст словаря, коды справочника подписанной строкой', () => {
      renderDecision(
        withDecision(
          { ...DECLINED, decline_codes: ['RC-04'], decision_codes: ['AB-O-05'] },
          'declined'
        ),
        [],
        {},
        { data: undefined }
      )

      expect(
        vi.mocked(hooks.useCreditDecisionCodes).mock.calls.every(([enabled]) => enabled === false),
        'the scene asked for the directory — it is not the read-only role'
      ).toBe(true)
      const row = codesRow()
      expect(
        row,
        'without the directory the card lost the old decline code text — a read-only role reads bare ids'
      ).toContain('RC-04 — credit.declineCode.RC-04')
      expect(row, 'without the directory the registry code is not shown at all').toContain(
        'credit.card.decisionCodesIds codes=AB-O-05'
      )
      expect(
        row,
        'without the directory the row carries something besides the old text and the labelled registry codes'
      ).toBe(
        'credit.fields.declineCodes' +
          'RC-04 — credit.declineCode.RC-04' +
          'credit.card.decisionCodesIds codes=AB-O-05'
      )
    })

    it('C-8: без права решать, код справочника прислан как есть — один id, без выдуманного текста', () => {
      renderDecision(
        withDecision(
          { ...DECLINED, decline_codes: ['AB-O-13'], decision_codes: ['AB-O-13'] },
          'declined'
        ),
        [],
        {},
        { data: undefined }
      )

      expect(
        codesRow(),
        'a registry code sent as is got an invented old-dictionary text or a duplicate line'
      ).toBe('credit.fields.declineCodesAB-O-13')
    })

    it('C-9: повтор кода в ответе модуля — одна строка и без предупреждения React о ключах', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        renderCard({
          ...DECLINED,
          decline_codes: ['AB-O-13'],
          decision_codes: ['AB-O-13', 'AB-O-13'],
        })

        const row = screen.getByText('credit.fields.declineCodes').parentElement as HTMLElement
        expect(
          within(row).getAllByText('AB-O-13'),
          'a repeated registry code is drawn twice in the decision card'
        ).toHaveLength(1)
        expect(row.textContent).toContain(entryOf('AB-O-13').ru)
        expect(
          consoleError.mock.calls.some((args) => args.map(String).join(' ').includes('same key')),
          'a repeated registry code gave two React children with the same key'
        ).toBe(false)
      } finally {
        consoleError.mockRestore()
      }
    })

    /**
     * Прежний вывод печатает код одним `id`, когда строки для него в прежнем
     * словаре нет, — в любой ветке, а не только когда код есть в
     * `decision_codes`. Третья ветка (ключа нет — модуль старше 0.1.27 — или
     * список смысла пуст) печатала такой код «AB-O-13 — AB-O-13»: запасной
     * текст i18next — сам код. `RC-04` рядом — положительный контроль: у кода
     * со строкой словаря текст остаётся. Справочник загружен: третья ветка от
     * него не зависит.
     */
    it.each([
      ['ключа decision_codes нет', undefined, ['AB-O-13'], 'AB-O-13'],
      ['список смысла пуст', [], ['RC-04', 'AB-O-13'], 'RC-04 — credit.declineCode.RC-04; AB-O-13'],
    ] as const)(
      'C-10: %s, у кода нет строки прежнего словаря — один id, без «CODE — CODE»',
      (_case, meaning, sent, expected) => {
        const legacy = (ukCommon as { credit: { declineCode: Record<string, string> } }).credit
          .declineCode
        expect(
          legacy['AB-O-13'],
          'the scene needs a code without an old-dictionary text: credit.declineCode.AB-O-13 appeared'
        ).toBeUndefined()
        expect(legacy['RC-04'], 'the positive control RC-04 lost its dictionary text').toBeTruthy()

        const decision: Partial<CreditDecision> = { ...DECLINED, decline_codes: [...sent] }
        if (meaning === undefined) delete decision.decision_codes
        else decision.decision_codes = [...meaning]
        renderCard(decision as CreditDecision)

        const row = codesRow()
        expect(
          row,
          'a code without an old-dictionary text is printed as «CODE — CODE»'
        ).not.toMatch(/AB-O-13 — /)
        expect(row).toBe(`credit.fields.declineCodes${expected}`)
      }
    )
  })
})
