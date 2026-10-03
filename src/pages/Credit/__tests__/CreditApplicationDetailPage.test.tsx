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
import { formatCreditMoney } from '@/features/credit/api/money'
import { formatDateTime } from '@/lib/formatters'
import ukCommon from '@/../public/locales/uk/common.json'
import {
  DECISION_CODES_FIXTURE,
  entryOf,
} from '@/features/credit/api/__tests__/decisionCodesFixture'
import { SCENE_A } from '@/features/credit/api/__tests__/scorecardFixture'
import { expectNotObscured, expectObscured } from '@/test/piiHelpers'
import { useAuthStore } from '@/stores/authStore'
import { CREDIT_CHECKLIST_HINTED, CREDIT_CHECKLIST_KEYS } from '@/features/credit/api/enums'
import type {
  CreditApplicationDetail,
  CreditApplicationMarketing,
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
// нет» — так свойство настоящих словарей, а не договорённость сцены. Строка
// вторым аргументом — тот же `defaultValue`, как у i18next (`t(key, 'запасное')`).
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
      t: (key: string, options?: Record<string, unknown> | string) => {
        const vars = typeof options === 'string' ? { defaultValue: options } : options
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

describe('CreditApplicationDetailPage → анкета: имя держателя счёта выплаты', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('P-1: имя держателя рядом с совпадением личности скрыто в записи сессии, как ФИО', () => {
    // Держатель синтетический: живых имён в тестах нет.
    renderPage({
      ...APPLICATION,
      ibv: {
        identity_match_rate: 0.95,
        payout_account_id: 'acc_test_1',
        accounts: [{ account_id: 'acc_test_1', holder_name: 'Test Holder' }],
      },
    } as unknown as CreditApplicationDetail)
    expectObscured(screen.getByText('Test Holder'))
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

  /** Состояние хука подтверждения условного одобрения (19-5f). */
  type ConfirmState = {
    mutate?: (payload: unknown, options?: { onSuccess?: () => void }) => void
    isPending?: boolean
    isError?: boolean
    isSuccess?: boolean
    error?: unknown
  }

  function renderDecision(
    application: CreditApplicationDetail,
    permissions: string[] = [],
    mutation: { mutate?: (payload: unknown) => void; isError?: boolean; error?: unknown } = {},
    codes: CodesState = codesLoaded(),
    confirm: ConfirmState = {}
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
    // Хук автомокнут: без ответа по умолчанию кнопка подтверждения (19-5f)
    // уронила бы сцену на деструктуризации `undefined`.
    vi.mocked(hooks.useCreditConfirmConditional).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      ...confirm,
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

  /**
   * Разбор скоринга на вкладке решения и сырой снимок под ним (19-7).
   *
   * Реквизиты выплаты и суммы пособий — синтетические (`Test Holder`,
   * `000000000`, круглые суммы): живых значений в тестах нет.
   */
  describe('разбор скоринга на вкладке решения', () => {
    const withSnapshot = (input_snapshot: CreditDecision['input_snapshot']) =>
      withDecision({ ...DECISION, input_snapshot })
    const rawSnapshot = () => {
      const pre = document.querySelector('details pre')
      if (!pre) throw new Error('сырого снимка на вкладке нет')
      return pre
    }
    const PAYOUT = { holder_name: 'Test Holder', account_number: '000000000' }

    it('R-1: снимок со scorecard — «Розбір скорингу» сразу после «Підстава рішення»', () => {
      renderDecision(withSnapshot(SCENE_A))
      const basis = screen.getByText('credit.card.decisionBasis')
      const breakdown = screen.getByText('credit.scorecard.title')
      expect(
        basis.compareDocumentPosition(breakdown) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      expect(
        breakdown.compareDocumentPosition(rawSnapshot()) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
    })

    it('R-2: решение без scorecard — панели разбора нет', () => {
      renderDecision(withDecision(DECISION))
      expect(screen.queryByText('credit.scorecard.title')).toBeNull()
    })

    it('R-2b: снимок есть (доход, правила, IBV), ключа scorecard нет — панели разбора нет', () => {
      // Решение до 19-3, ручное или при выключенном флаге скоринга: снимок не
      // пустой, но разбора в нём нет.
      renderDecision(
        withSnapshot({
          income: { net_amount_minor: 250_000 },
          rules: { ruleset: 'synthetic@1' },
          ibv: { provider: 'mock' },
        } as CreditDecision['input_snapshot'])
      )
      expect(screen.queryByText('credit.scorecard.title')).toBeNull()
      expect(rawSnapshot().textContent).toContain('"net_amount_minor": 250000')
    })

    it('R-2c: класс дохода 19-2 без scorecard — ни панели, ни таблицы, ни отсылки к разбору', () => {
      // Бывшая сцена B-5 компонента: есть ли разбор, решает страница по одному
      // чтению снимка, панель без модели не рисуется.
      renderDecision(
        withSnapshot({
          income_class: 'A',
          income_class_source: 'both',
          income_class_basis: {
            ...SCENE_A.income_class_basis,
            amounts: { sum_pension_income: 1000 },
          },
        } as CreditDecision['input_snapshot'])
      )
      expect(screen.queryByText('credit.scorecard.title')).toBeNull()
      expect(screen.queryByText('credit.scorecard.parameter')).toBeNull()
      expect(screen.getByText('credit.card.snapshotAmountsHidden')).toBeInTheDocument()
      expect(screen.queryByText('credit.card.snapshotAmountsHiddenSeeBreakdown')).toBeNull()
    })

    it('R-3: счёт выплаты убран из сырого снимка, строка об этом есть, блок скрыт в записи', () => {
      renderDecision(
        withSnapshot({
          ...SCENE_A,
          ibv: { provider: 'mock', payout_account_id: 'acc_test_1', payout_account: PAYOUT },
        })
      )
      const pre = rawSnapshot()
      // Проверяется ключ, а не подстрока: `payout_account_id` модуль пишет рядом
      // всегда, и он остаётся — это доказательство DAT-02.
      expect(pre.textContent).not.toContain('"payout_account":')
      expect(pre.textContent).toContain('payout_account_id')
      expect(pre.textContent).not.toContain('000000000')
      expect(pre.textContent).toContain('"provider": "mock"')
      expect(screen.getByText('credit.card.snapshotPayoutHidden')).toBeInTheDocument()
      expectObscured(pre)
    })

    it('R-4: счёта выплаты в снимке нет — строки о нём нет', () => {
      renderDecision(withSnapshot({ ...SCENE_A, ibv: { provider: 'mock' } }))
      expect(screen.queryByText('credit.card.snapshotPayoutHidden')).toBeNull()
      expect(screen.queryByText('credit.card.snapshotAmountsHidden')).toBeNull()
      expect(screen.queryByText('credit.card.snapshotAmountsHiddenSeeBreakdown')).toBeNull()
      expectObscured(rawSnapshot())
    })

    it('R-5: суммы пособий убраны из сырого снимка; разбор есть — строка отсылает к нему', () => {
      renderDecision(
        withSnapshot({
          ...SCENE_A,
          income_class_basis: {
            ...SCENE_A.income_class_basis,
            amounts: { sum_pension_income: 1000 },
          },
          ibv: { risk: { extra: { sum_pension_income: 1000, has_overdraft: false } } },
        } as CreditDecision['input_snapshot'])
      )
      const pre = rawSnapshot()
      expect(pre.textContent).not.toContain('amounts')
      expect(pre.textContent).not.toContain('sum_pension_income')
      expect(pre.textContent).toContain('"has_overdraft": false')
      expect(screen.getByText('credit.scorecard.title')).toBeInTheDocument()
      expect(screen.getByText('credit.card.snapshotAmountsHiddenSeeBreakdown')).toBeInTheDocument()
      expect(screen.queryByText('credit.card.snapshotAmountsHidden')).toBeNull()
      expect(screen.queryByText('credit.card.snapshotPayoutHidden')).toBeNull()
    })

    /** Живая форма `amounts` без банковской проверки: семь сумм Lending, все `null`. */
    const NULL_AMOUNTS = {
      sum_pension_income: null,
      sum_disability_income: null,
      sum_government_income_total: null,
      sum_employment_insurance_income: null,
      sum_social_assistance_income: null,
      sum_wsib_income: null,
      sum_child_support_income_government: null,
    }

    it('R-6: amounts из одних null — ни одной строки о суммах: прятать было нечего', () => {
      renderDecision(
        withSnapshot({
          income: { net_amount_minor: 250_000 },
          income_class: 'A',
          income_class_basis: { declared_class: 'A', amounts: NULL_AMOUNTS },
        } as CreditDecision['input_snapshot'])
      )
      expect(screen.queryByText('credit.card.snapshotAmountsHidden')).toBeNull()
      expect(screen.queryByText('credit.card.snapshotAmountsHiddenSeeBreakdown')).toBeNull()
      expectObscured(rawSnapshot())
    })

    it('R-7: суммы есть, разбора нет — короткая строка, без отсылки к разбору', () => {
      renderDecision(
        withSnapshot({
          income: { net_amount_minor: 250_000 },
          income_class: 'B',
          income_class_basis: {
            declared_class: 'B',
            amounts: { ...NULL_AMOUNTS, sum_pension_income: 1000 },
          },
        } as CreditDecision['input_snapshot'])
      )
      expect(rawSnapshot().textContent).not.toContain('sum_pension_income')
      expect(screen.queryByText('credit.scorecard.title')).toBeNull()
      expect(screen.getByText('credit.card.snapshotAmountsHidden')).toBeInTheDocument()
      expect(screen.queryByText('credit.card.snapshotAmountsHiddenSeeBreakdown')).toBeNull()
    })
  })

  /**
   * Чек-лист проверки в форме ручного решения (19-5f).
   *
   * Ответ — три radio в `<fieldset>` пункта; «Скинути» и «Примітка» — только у
   * отвеченного пункта. Мок `t` печатает ключ: пункт ищется группой по имени
   * `credit.checklistItem.<key>`. Кнопки по всей панели здесь не считаются — так
   * считает F-6, и её ожидание держит отсутствие кнопок у неотвеченных пунктов.
   */
  describe('19-5f: чек-лист в форме ручного решения', () => {
    const RATIONALE = 'Синтетичне обґрунтування з чек-листом'

    const item = (panel: ReturnType<typeof within>, key: string) =>
      within(panel.getByRole('group', { name: `credit.checklistItem.${key}` }))

    const answerItem = (
      panel: ReturnType<typeof within>,
      key: string,
      answer: 'yes' | 'no' | 'n_a'
    ) =>
      fireEvent.click(
        item(panel, key).getByRole('radio', { name: `credit.checklistAnswer.${answer}` })
      )

    const save = (panel: ReturnType<typeof within>) => {
      fireEvent.change(panel.getByPlaceholderText('credit.card.rationalePlaceholder'), {
        target: { value: RATIONALE },
      })
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))
    }

    it('19-5f K-1: одиннадцать пунктов в порядке листа, шесть подсказок, по три ответа; кнопок и полей у неотвеченных нет', () => {
      const panel = renderManual()

      const legends = panel
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent ?? '')
        .filter((text) => text.startsWith('credit.checklistItem.'))
      expect(legends, 'the checklist items are not the book sheet in its order').toEqual(
        CREDIT_CHECKLIST_KEYS.map((key) => `credit.checklistItem.${key}`)
      )
      for (const key of CREDIT_CHECKLIST_KEYS) {
        const radios = item(panel, key).getAllByRole('radio')
        expect(
          radios.map((radio) => radio.closest('label')?.textContent),
          `the ${key} item does not offer the three answers`
        ).toEqual([
          'credit.checklistAnswer.yes',
          'credit.checklistAnswer.no',
          'credit.checklistAnswer.n_a',
        ])
        expect(radios.some((radio) => (radio as HTMLInputElement).checked)).toBe(false)
      }
      const hints = panel.getAllByText(/^credit\.checklistHint\./).map((node) => node.textContent)
      expect(hints, 'the six hints are not under their items').toEqual(
        CREDIT_CHECKLIST_HINTED.map((key) => `credit.checklistHint.${key}`)
      )
      for (const key of CREDIT_CHECKLIST_HINTED) {
        expect(item(panel, key).getByText(`credit.checklistHint.${key}`)).toBeInTheDocument()
      }
      expect(
        panel.getAllByRole('textbox'),
        'an untouched checklist added a text input to the form'
      ).toHaveLength(1)
      expect(
        panel.queryAllByRole('button', { name: 'credit.checklist.clearAnswer' }),
        'an unanswered item offers «Clear»'
      ).toHaveLength(0)
      expect(
        panel.queryAllByRole('button', { name: 'credit.checklist.addNote' }),
        'an unanswered item offers «Note»'
      ).toHaveLength(0)
    })

    it('19-5f K-2: два ответа + одобрение — чек-лист в порядке листа, прочие ключи прежние', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      // Порядок кликов обратный листу.
      answerItem(panel, 'residence_proof', 'yes')
      answerItem(panel, 'ibv_all_accounts', 'yes')
      save(panel)

      expect(mutate).toHaveBeenCalledTimes(1)
      const payload = mutate.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(payload).sort()).toEqual([
        'checklist',
        'final_amount_minor',
        'outcome',
        'rationale',
      ])
      expect(
        payload.checklist,
        'the checklist left in the click order, not in the sheet order'
      ).toEqual([
        { key: 'ibv_all_accounts', answer: 'yes' },
        { key: 'residence_proof', answer: 'yes' },
      ])
      expect(payload.outcome).toBe('approved')
    })

    it('19-5f K-3: «Скинути» снимает ответ — пункта в теле нет; ни одного ответа — ключа checklist нет', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      answerItem(panel, 'pay_document', 'no')
      answerItem(panel, 'id_photo_only', 'yes')
      fireEvent.click(
        item(panel, 'pay_document').getByRole('button', { name: 'credit.checklist.clearAnswer' })
      )
      expect(
        item(panel, 'pay_document')
          .getAllByRole('radio')
          .some((radio) => (radio as HTMLInputElement).checked),
        '«Clear» left the answer checked'
      ).toBe(false)
      save(panel)
      expect((mutate.mock.calls[0][0] as { checklist: unknown }).checklist).toEqual([
        { key: 'id_photo_only', answer: 'yes' },
      ])

      fireEvent.click(
        item(panel, 'id_photo_only').getByRole('button', { name: 'credit.checklist.clearAnswer' })
      )
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))
      expect(mutate).toHaveBeenCalledTimes(2)
      expect(
        'checklist' in (mutate.mock.calls[1][0] as Record<string, unknown>),
        'a checklist without answers is sent as a key'
      ).toBe(false)
    })

    it('19-5f K-4: «Скинути» и «Примітка» — только у отвеченного; поле подписано текстом пункта, ≤ 500, текст уходит note', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      answerItem(panel, 'pay_document', 'yes')
      expect(
        item(panel, 'pay_document').getByRole('button', { name: 'credit.checklist.clearAnswer' })
      ).toBeInTheDocument()
      expect(
        panel.getAllByRole('button', { name: 'credit.checklist.addNote' }),
        '«Note» appears on more than the answered item'
      ).toHaveLength(1)
      expect(panel.getAllByRole('textbox'), 'the note opened without a click').toHaveLength(1)

      fireEvent.click(
        item(panel, 'pay_document').getByRole('button', { name: 'credit.checklist.addNote' })
      )
      const note = panel.getByRole('textbox', { name: 'credit.checklistItem.pay_document' })
      expect(note.getAttribute('maxlength')).toBe('500')
      // Управляемый textarea пишет значение дочерним текстом — маска ввода его не закрывает.
      expectObscured(note)
      fireEvent.change(note, { target: { value: '  FE195F-NOTE  ' } })
      save(panel)

      expect((mutate.mock.calls[0][0] as { checklist: unknown }).checklist).toEqual([
        { key: 'pay_document', answer: 'yes', note: 'FE195F-NOTE' },
      ])
    })

    it.each([
      ['declined', ['checklist', 'decline_codes', 'outcome', 'rationale']],
      ['referred', ['checklist', 'outcome', 'rationale']],
    ] as const)('19-5f K-5: чек-лист уходит и при исходе %s', (outcome, keys) => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      fireEvent.change(panel.getByRole('combobox'), { target: { value: outcome } })
      if (outcome === 'declined') {
        fireEvent.click(panel.getByRole('checkbox', { name: /AB-O-13/ }))
      }
      answerItem(panel, 'nsf_isolated', 'n_a')
      save(panel)

      const payload = mutate.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(payload).sort()).toEqual([...keys])
      expect(payload.checklist).toEqual([{ key: 'nsf_isolated', answer: 'n_a' }])
    })

    it('19-5f K-6: счёт отвеченных — «Відмічено 2 з 11»', () => {
      const panel = renderManual()

      expect(panel.getByText(/credit\.checklist\.progress answered=0 total=11/)).toBeInTheDocument()
      answerItem(panel, 'salary_regular', 'yes')
      answerItem(panel, 'id_alberta_only', 'no')
      expect(panel.getByText(/credit\.checklist\.progress answered=2 total=11/)).toBeInTheDocument()
      expect(panel.getByText(/credit\.checklist\.unansweredNotSent/)).toBeInTheDocument()
      expect(
        panel.getByText(/credit\.checklist\.progress/).textContent,
        'the count and the «unmarked items» line are glued into one sentence'
      ).not.toContain('credit.checklist.unansweredNotSent')
    })
  })

  /**
   * «Схвалити з умовою» (19-5f): коды условия `AB-C-*` под исходом «Схвалити»,
   * одна кнопка сохранения. Выбранный код делает решение ПРЕДЛОЖЕНИЕМ —
   * `referred` с кодами; `approved` с `AB-C-*` форма не шлёт никогда.
   */
  describe('19-5f: условное одобрение в форме', () => {
    const RATIONALE = 'Синтетичне обґрунтування пропозиції'
    const DETAIL = 'Синтетический отказ модуля: условие уже заявлено'

    const idsOf = (panel: ReturnType<typeof within>): Array<string | undefined> =>
      panel
        .queryAllByRole('checkbox')
        .map((box: HTMLElement) => box.closest('label')?.textContent?.split(' ')[0])

    const typeRationale = (panel: ReturnType<typeof within>) =>
      fireEvent.change(panel.getByPlaceholderText('credit.card.rationalePlaceholder'), {
        target: { value: RATIONALE },
      })

    it('19-5f Q-1: при «Схвалити» — четыре AB-C-* по id и ничего кроме; при отказе условий нет, отказов по-прежнему 7', () => {
      const reversed: CreditDecisionCodesRegistry = {
        version: 'book@q1',
        codes: [...DECISION_CODES_FIXTURE.codes].reverse(),
      }
      const panel = renderManual({}, DECISION, { data: indexDecisionCodes(reversed) })

      expect(
        panel.getByText('credit.card.conditionalTitle').tagName,
        'the conditions are not a fieldset'
      ).toBe('LEGEND')
      expect(idsOf(panel), 'the conditions are not the AB-C-* codes of the registry').toEqual([
        'AB-C-01',
        'AB-C-02',
        'AB-C-03',
        'AB-C-04',
      ])
      for (const id of ['AB-O-13', 'AB-G-06', 'AB-X-08']) {
        expect(
          panel.queryByRole('checkbox', { name: new RegExp(id) }),
          `the conditional approval offers ${id}`
        ).toBeNull()
      }

      fireEvent.change(panel.getByRole('combobox'), { target: { value: 'declined' } })
      expect(
        idsOf(panel).filter((id) => id?.startsWith('AB-C-')),
        'a decline offers a conditional code'
      ).toEqual([])
      expect(panel.getAllByRole('checkbox')).toHaveLength(7)
    })

    it('19-5f Q-2: выбран AB-C-02 — кнопка «Запропонувати умовне схвалення» и подсказка', () => {
      const panel = renderManual()
      expect(panel.queryByText('credit.card.conditionalHint')).toBeNull()

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-C-02/ }))

      expect(
        panel.getByRole('button', { name: 'credit.actions.proposeConditional' })
      ).toBeInTheDocument()
      expect(
        panel.queryByRole('button', { name: 'credit.actions.saveDecision' }),
        'the proposal still reads as a plain save'
      ).toBeNull()
      expect(panel.getByText('credit.card.conditionalHint')).toBeInTheDocument()
    })

    it('19-5f Q-3: тело предложения — referred, коды по возрастанию, сумма; без decline_codes и без approved', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-C-02/ }))
      fireEvent.click(panel.getByRole('checkbox', { name: /AB-C-01/ }))
      typeRationale(panel)
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.proposeConditional' }))

      expect(mutate).toHaveBeenCalledTimes(1)
      expect(mutate.mock.calls[0][0]).toEqual({
        outcome: 'referred',
        rationale: RATIONALE,
        final_amount_minor: 30_000,
        conditional_codes: ['AB-C-01', 'AB-C-02'],
      })
      for (const [payload] of mutate.mock.calls) {
        const body = payload as Record<string, unknown>
        expect(
          body.outcome === 'approved' && 'conditional_codes' in body,
          'the form sent approved with AB-C-* — the module answers 409'
        ).toBe(false)
      }
    })

    it('19-5f Q-4: коды сняты — прежнее одобрение', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-C-02/ }))
      fireEvent.click(panel.getByRole('checkbox', { name: /AB-C-02/ }))
      typeRationale(panel)
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))

      const payload = mutate.mock.calls[0][0] as Record<string, unknown>
      expect(Object.keys(payload).sort()).toEqual(['final_amount_minor', 'outcome', 'rationale'])
      expect(payload.outcome).toBe('approved')
    })

    it('19-5f Q-5: справочник в ошибке — строка, а не плашка; одобрение сохраняется; условие без справочника закрывает кнопку', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate }, DECISION, { isError: true })

      expect(panel.getByText('credit.card.conditionalUnavailable')).toBeInTheDocument()
      expect(
        panel.queryAllByRole('alert'),
        'the unavailable conditions are drawn as an alert plate'
      ).toHaveLength(0)
      typeRationale(panel)
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))
      expect(mutate).toHaveBeenCalledTimes(1)
      expect((mutate.mock.calls[0][0] as { outcome: string }).outcome).toBe('approved')

      // Условие отмечено, потом справочник пропал: одобрение без условия не уходит.
      cleanup()
      const second = vi.fn()
      const form = renderManual({ mutate: second })
      fireEvent.click(form.getByRole('checkbox', { name: /AB-C-02/ }))
      vi.mocked(hooks.useCreditDecisionCodes).mockReturnValue({
        data: undefined,
        isError: true,
        isFetching: false,
        refetch: vi.fn(),
      } as never)
      typeRationale(form)
      const button = form.getByRole('button', { name: 'credit.actions.saveDecision' })
      expect(
        button,
        'a chosen condition without the directory leaves as a plain approval'
      ).toBeDisabled()
      fireEvent.click(button)
      expect(second).not.toHaveBeenCalled()
    })

    it('19-5f Q-6: 409 conditional_approval_unconfirmed — одна плашка со своим текстом, detail модуля не виден', () => {
      const panel = renderManual({
        isError: true,
        error: new CreditApiError(DETAIL, 409, 'conditional_approval_unconfirmed'),
      })

      const alerts = panel.getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0].textContent).toBe('credit.decisionError.conditionalApprovalUnconfirmed')
      expect(panel.queryByText(DETAIL)).toBeNull()
    })

    it('19-5f Q-7: справочник без AB-C-* — ни пустой рамки условий, ни строки «недоступні»; одобрение уходит', () => {
      const withoutConditions = (): CodesState => ({
        data: indexDecisionCodes({
          version: 'book@no-conditional',
          codes: DECISION_CODES_FIXTURE.codes.filter((entry) => entry.kind !== 'conditional'),
        }),
      })
      // Положительный контроль: полный справочник рамку рисует — пустота ниже
      // значит «рамки нет», а не «поиск её не видит».
      expect(renderManual().getByText('credit.card.conditionalTitle').tagName).toBe('LEGEND')
      cleanup()

      const mutate = vi.fn()
      const panel = renderManual({ mutate }, DECISION, withoutConditions())
      expect(
        panel.queryByText('credit.card.conditionalTitle'),
        'an empty fieldset of conditions is drawn'
      ).toBeNull()
      expect(
        panel.queryByText('credit.card.conditionalUnavailable'),
        'a loaded directory is reported as not loaded'
      ).toBeNull()
      typeRationale(panel)
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))
      expect(mutate).toHaveBeenCalledTimes(1)
      expect((mutate.mock.calls[0][0] as { outcome: string }).outcome).toBe('approved')

      // Перезапрос справочника упал, а загруженный остался: он всё ещё загружен.
      cleanup()
      const stale = renderManual({}, DECISION, { ...withoutConditions(), isError: true })
      expect(
        stale.queryByText('credit.card.conditionalUnavailable'),
        'a failed refetch over a loaded directory is reported as not loaded'
      ).toBeNull()
    })

    it('19-5f Q-8: смена исхода снимает условия — «Направити на розгляд» без кодов, возврат на «Схвалити» с пустыми отметками', () => {
      const mutate = vi.fn()
      const panel = renderManual({ mutate })
      const outcome = panel.getByRole('combobox')

      fireEvent.click(panel.getByRole('checkbox', { name: /AB-C-02/ }))
      fireEvent.change(outcome, { target: { value: 'referred' } })
      typeRationale(panel)
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))
      expect(
        mutate.mock.calls[0][0],
        'the referral carries the condition codes chosen under «Approve»'
      ).toEqual({ outcome: 'referred', rationale: RATIONALE })

      fireEvent.change(outcome, { target: { value: 'approved' } })
      expect(
        panel
          .getAllByRole('checkbox')
          .filter((box) => (box as HTMLInputElement).checked)
          .map((box) => box.closest('label')?.textContent?.split(' ')[0]),
        'the conditions came back checked after the outcome changed'
      ).toEqual([])
      expect(
        panel.queryByRole('button', { name: 'credit.actions.proposeConditional' }),
        'the form still proposes a condition nobody sees checked'
      ).toBeNull()
      fireEvent.click(panel.getByRole('button', { name: 'credit.actions.saveDecision' }))
      expect(Object.keys(mutate.mock.calls[1][0] as object).sort()).toEqual([
        'final_amount_minor',
        'outcome',
        'rationale',
      ])
    })
  })

  /**
   * Подтверждение условного одобрения руководителем (19-5f): кнопка — при праве
   * `credit.decisions.confirm_conditional`, заявке `referred` и ступени
   * `proposed`. Автору не прячется — «подтверждает другой» проверяет модуль.
   */
  describe('19-5f: подтверждение условного одобрения', () => {
    const CONFIRM = 'credit.decisions.confirm_conditional'
    const DETAIL = 'Синтетический отказ модуля подтверждения'

    const PROPOSAL: CreditDecision = {
      ...DECISION,
      outcome: 'referred',
      decision_mode: 'manual',
      decline_codes: [],
      decision_codes: ['AB-C-02'],
      final_amount_minor: null,
      supersedes_decision_id: null,
      underwriter_id: 103,
      rationale: 'Синтетичне обґрунтування пропозиції',
      conditional_stage: 'proposed',
      checklist_completed: { yes: 10, applicable: 10 },
      input_snapshot: {
        conditional: { stage: 'proposed', codes: ['AB-C-02'], amount_minor: 25_000 },
      },
    }

    const renderProposal = (
      permissions: string[] = [CONFIRM, 'credit.decisions.decide'],
      confirm: ConfirmState = {},
      decision: CreditDecision = PROPOSAL,
      status: CreditApplicationDetail['status'] = 'referred'
    ) => renderDecision(withDecision(decision, status), permissions, {}, codesLoaded(), confirm)

    const confirmButton = () =>
      screen.queryByRole('button', { name: 'credit.actions.confirmConditional' })
    const conditionRow = () =>
      screen.getByText('credit.fields.conditionalCodes').parentElement as HTMLElement

    it('19-5f R-1: предложение без права — кнопки нет, ступень видна', () => {
      renderProposal(['credit.decisions.decide'])

      expect(confirmButton(), 'the confirmation is offered without the right').toBeNull()
      expect(
        within(conditionRow()).getByText('credit.conditionalStage.proposed')
      ).toBeInTheDocument()
    })

    it('19-5f R-2: с правом — кнопка и строка «подтверждает другой»', () => {
      renderProposal()

      expect(confirmButton()).not.toBeNull()
      expect(within(conditionRow()).getByText('credit.card.confirmNotAuthor')).toBeInTheDocument()
    })

    it.each<[string, CreditDecision, CreditApplicationDetail['status']]>([
      ['заявка уже approved', PROPOSAL, 'approved'],
      [
        'ступень confirmed',
        {
          ...PROPOSAL,
          outcome: 'approved',
          conditional_stage: 'confirmed',
          input_snapshot: {
            conditional: { stage: 'confirmed', codes: ['AB-C-02'], amount_minor: 25_000 },
          },
        },
        'referred',
      ],
    ])('19-5f R-2: %s — кнопки нет', (_case, decision, status) => {
      renderProposal([CONFIRM], {}, decision, status)

      expect(
        confirmButton(),
        'the confirmation is offered for a decision that is not a live proposal'
      ).toBeNull()
      expect(conditionRow()).toBeInTheDocument()
    })

    it('19-5f R-2b: право подтверждения без права решать — кнопка и подсказка есть', () => {
      // Без `credit.decisions.decide` справочник не запрашивается: коды условия — одним id (C-7).
      renderDecision(withDecision(PROPOSAL, 'referred'), [CONFIRM], {}, { data: undefined })

      expect(confirmButton(), 'the confirmation also requires the right to decide').not.toBeNull()
      expect(within(conditionRow()).getByText('credit.card.confirmNotAuthor')).toBeInTheDocument()
      expect(conditionRow().textContent).toContain('AB-C-02')
      expect(conditionRow().textContent).not.toContain(entryOf('AB-C-02').ru)
    })

    it('19-5f R-3: диалог с суммой и кодами; «Скасувати» — без запроса; «Підтвердити» — один вызов с id предложения', () => {
      const mutate = vi.fn()
      renderProposal(undefined, { mutate })

      fireEvent.click(confirmButton() as HTMLElement)
      const dialog = within(screen.getByRole('dialog'))
      // Сумма — предложенная из снимка (25 000), а не запрошенная (30 000) и не
      // `final_amount_minor` предложения (`null` → «—»).
      expect(dialog.getByText(/credit\.card\.confirmMessage/).textContent).toBe(
        `credit.card.confirmMessage amount=${formatCreditMoney(25_000, 'CAD')} codes=AB-C-02`
      )
      fireEvent.click(dialog.getByRole('button', { name: 'actions.cancel' }))
      expect(mutate, '«Cancel» sent the confirmation').not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()

      fireEvent.click(confirmButton() as HTMLElement)
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'credit.actions.confirmConditional',
        })
      )
      expect(mutate).toHaveBeenCalledTimes(1)
      expect(mutate.mock.calls[0][0]).toEqual({ proposal_decision_id: PROPOSAL.decision_id })
    })

    it('19-5f R-4: 409 conditional_confirmer_is_the_author — одна плашка со своим текстом', () => {
      renderProposal(undefined, {
        isError: true,
        error: new CreditApiError(DETAIL, 409, 'conditional_confirmer_is_the_author'),
      })

      const alerts = within(conditionRow()).getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0].textContent).toBe('credit.decisionError.confirmerIsTheAuthor')
      expect(screen.queryByText(DETAIL)).toBeNull()
    })

    it('19-5f R-5: автор предложения — тот же пользователь CRM, а кнопка всё равно видна', () => {
      useAuthStore.setState({
        user: { id: '103', username: 'u', projects: [], active_project_id: '1' } as never,
      })
      try {
        renderProposal()
        expect(
          confirmButton(),
          'the button is hidden from the author — the author rule belongs to the module'
        ).not.toBeNull()
      } finally {
        useAuthStore.setState({ user: null })
      }
    })

    it.each([
      [
        '409 invalid_state',
        new CreditApiError(DETAIL, 409, 'invalid_state'),
        'credit.decisionError.proposalNotActive',
      ],
      [
        '403 operator_id_not_numeric',
        new CreditApiError(DETAIL, 403, 'operator_id_not_numeric'),
        'credit.decisionError.operatorIdNotNumeric',
      ],
      [
        '422 validation_failed (график не строится)',
        new CreditApiError(DETAIL, 422, 'validation_failed'),
        DETAIL,
      ],
      ['Error без сообщения', new Error(''), 'credit.decisionError.generic'],
    ] as const)('19-5f R-6: %s — текст плашки подтверждения', (_case, error, shown) => {
      renderProposal(undefined, { isError: true, error })

      const alerts = within(conditionRow()).getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0].textContent).toBe(shown)
    })

    it('19-5f R-7: успех — плашка «Умовне схвалення підтверджено» переживает перезапрос карточки, кнопки нет', () => {
      const mutate = vi.fn((_payload: unknown, options?: { onSuccess?: () => void }) =>
        options?.onSuccess?.()
      )
      const view = renderProposal(undefined, { mutate })

      fireEvent.click(confirmButton() as HTMLElement)
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'credit.actions.confirmConditional',
        })
      )
      expect(mutate).toHaveBeenCalledTimes(1)
      // Окно до ответа перезапроса: карточка ещё несёт предложение.
      expect(
        within(conditionRow()).getByText('credit.card.conditionalConfirmed')
      ).toBeInTheDocument()
      expect(confirmButton(), 'the button is live again before the card refreshed').toBeNull()

      // Сброс кэша принёс заявку `approved` с решением-подтверждением.
      vi.mocked(hooks.useCreditApplication).mockReturnValue({
        ...idle,
        data: withDecision(
          {
            ...PROPOSAL,
            decision_id: 'd5d5d5d5-5555-4555-8555-555555555555',
            outcome: 'approved',
            conditional_stage: 'confirmed',
            input_snapshot: {
              conditional: { stage: 'confirmed', codes: ['AB-C-02'], amount_minor: 25_000 },
            },
          },
          'approved'
        ),
      } as unknown as ReturnType<typeof hooks.useCreditApplication>)
      view.rerender(<MemoryRouter>{withQuery(<CreditApplicationDetailPage />)}</MemoryRouter>)

      // Положительный контроль: карточка действительно перерисована подтверждением.
      expect(
        within(conditionRow()).getByText('credit.conditionalStage.confirmed')
      ).toBeInTheDocument()
      expect(
        within(conditionRow()).getByText('credit.card.conditionalConfirmed'),
        'the success plate left together with the confirm button'
      ).toBeInTheDocument()
      expect(confirmButton()).toBeNull()
    })
  })

  /**
   * Карточка решения с условием (19-5f): условие — своей строкой из снимка,
   * «Коди відмови» — без кодов условия. Сырой снимок с примечанием чек-листа —
   * под маской записи сессии.
   */
  describe('19-5f: условие и чек-лист в карточке решения', () => {
    const PROPOSAL: CreditDecision = {
      ...DECISION,
      outcome: 'referred',
      decision_mode: 'manual',
      decline_codes: [],
      decision_codes: ['AB-C-02'],
      final_amount_minor: null,
      supersedes_decision_id: null,
      conditional_stage: 'proposed',
      input_snapshot: {
        conditional: { stage: 'proposed', codes: ['AB-C-02'], amount_minor: 25_000 },
      },
    }
    const codesRow = () =>
      screen.getByText('credit.fields.declineCodes').parentElement?.textContent ?? ''
    const conditionRow = () =>
      screen.getByText('credit.fields.conditionalCodes').parentElement?.textContent ?? ''

    it('19-5f C-6: предложение — «Коди відмови» прочерк, условие своей строкой: код, текст книги, ступень, сумма', () => {
      renderDecision(withDecision(PROPOSAL, 'referred'), ['credit.decisions.decide'])

      expect(codesRow(), 'the conditional approval is shown as a decline code').toBe(
        'credit.fields.declineCodes—'
      )
      const row = conditionRow()
      expect(row).toContain('AB-C-02')
      expect(row).toContain(entryOf('AB-C-02').ru)
      expect(row).toContain('credit.conditionalStage.proposed')
      // Предложенная сумма снимка (25 000), а не запрошенная (30 000) и не
      // `final_amount_minor` предложения (`null` → «—»).
      expect(row).toContain(`credit.card.proposedAmount amount=${formatCreditMoney(25_000, 'CAD')}`)
    })

    it('19-5f C-7: справочника нет — в строке условия только id, страница цела', () => {
      renderDecision(withDecision(PROPOSAL, 'referred'), [], {}, { data: undefined })

      const row = conditionRow()
      expect(row).toContain('AB-C-02')
      expect(row).not.toContain(entryOf('AB-C-02').ru)
      expect(screen.getByText('credit.fields.decidedAt')).toBeInTheDocument()
    })

    it('19-5f C-10: решение без условия и чек-листа — строка кодов как прежде, строки условия нет', () => {
      renderDecision(
        withDecision(
          {
            ...DECISION,
            outcome: 'declined',
            decision_mode: 'manual',
            final_amount_minor: null,
            supersedes_decision_id: null,
            decline_codes: ['AB-O-13'],
            decision_codes: ['AB-O-13'],
          },
          'declined'
        ),
        ['credit.decisions.decide', 'credit.decisions.confirm_conditional']
      )

      expect(codesRow()).toContain(entryOf('AB-O-13').ru)
      expect(codesRow()).toContain('credit.decisionCodeCategory.financial_hardship')
      expect(screen.queryByText('credit.fields.conditionalCodes')).toBeNull()
      expect(screen.queryByRole('button', { name: 'credit.actions.confirmConditional' })).toBeNull()
    })

    it('19-5f C-11: примечание чек-листа в сыром снимке — текст есть, узел под маской записи', () => {
      renderDecision(
        withDecision({
          ...DECISION,
          decision_mode: 'manual',
          checklist_completed: { yes: 1, applicable: 1 },
          input_snapshot: {
            checklist: {
              version: 'checklist@1',
              items: [{ key: 'pay_document', answer: 'yes', note: 'FE195F-NOTE' }],
            },
          },
        })
      )

      const pre = document.querySelector('details pre')
      expect(pre, 'the raw snapshot is not on the tab').not.toBeNull()
      expect(
        pre?.textContent,
        'the scene proves nothing: the note is not in the raw snapshot'
      ).toContain('FE195F-NOTE')
      expectObscured(pre)
    })

    /**
     * Строка «Чек-лист» (19-5f, Р-11): доля — числами модуля `checklist_completed`
     * (правило `n_a` — модуля, fe не пересчитывает), ответы — свёрнутым списком из
     * снимка в порядке ответа модуля. Ручное решение без чек-листа — «не
     * заповнено»; автоматическое без чек-листа — строки нет.
     */
    const MANUAL: CreditDecision = {
      ...DECISION,
      decision_mode: 'manual',
      supersedes_decision_id: null,
    }
    /** Десять «Так» и `residence_proof` «Не застосовно» — сцена DEV-приёмки 3(а). */
    const TEN_OF_TEN = CREDIT_CHECKLIST_KEYS.map((key) => ({
      key,
      answer: key === 'residence_proof' ? ('n_a' as const) : ('yes' as const),
      note: null,
    }))
    const checklistRow = () =>
      screen.queryByText('credit.fields.checklist')?.parentElement as HTMLElement | null | undefined

    it('19-5f C-8: доля — числами модуля: {10, 10} → «Так — 10 з 10», а не «з 11»', () => {
      renderDecision(
        withDecision({
          ...MANUAL,
          checklist_completed: { yes: 10, applicable: 10 },
          input_snapshot: { checklist: { version: 'checklist@1', items: TEN_OF_TEN } },
        })
      )

      const row = checklistRow()?.textContent ?? ''
      expect(row, 'the checklist row is missing from the decision card').toContain(
        'credit.checklist.share yes=10 applicable=10'
      )
      expect(row, 'the share was recounted in the CRM over the whole sheet').not.toContain(
        'applicable=11'
      )
    })

    it('19-5f C-8: все пункты «Не застосовно» — {0, 0} → «Жоден пункт не застосовний»', () => {
      renderDecision(
        withDecision({
          ...MANUAL,
          checklist_completed: { yes: 0, applicable: 0 },
          input_snapshot: {
            checklist: {
              version: 'checklist@1',
              items: CREDIT_CHECKLIST_KEYS.map((key) => ({
                key,
                answer: 'n_a' as const,
                note: null,
              })),
            },
          },
        })
      )

      const row = checklistRow()?.textContent ?? ''
      expect(row).toContain('credit.checklist.noneApplicable')
      expect(row, '«0 of 0 applicable» is shown instead of «none applies»').not.toContain(
        'credit.checklist.share'
      )
    })

    it.each([
      ['checklist_completed: null', null],
      ['ключа нет (решение до 19-5)', undefined],
    ] as const)(
      '19-5f C-8: ручное решение без чек-листа (%s) — «Чек-лист не заповнено»',
      (_case, completed) => {
        const manual: CreditDecision = { ...MANUAL }
        if (completed === null) manual.checklist_completed = null
        else delete manual.checklist_completed

        renderDecision(withDecision(manual))

        const row = checklistRow()
        expect(row, 'a manual decision without a checklist lost the «Чек-лист» row').toBeTruthy()
        expect(row?.textContent).toBe('credit.fields.checklistcredit.checklist.notFilled')
        expect(row?.querySelector('details'), 'an empty answer list is drawn').toBeNull()
      }
    )

    it('19-5f C-8: автоматическое решение без чек-листа — строки «Чек-лист» нет', () => {
      // Положительный контроль: та же карточка с долей модуля строку показывает —
      // отсутствие ниже значит «строки нет», а не «ключ подписи другой».
      renderDecision(withDecision({ ...DECISION, checklist_completed: { yes: 3, applicable: 5 } }))
      expect(checklistRow()?.textContent).toContain('credit.checklist.share yes=3 applicable=5')
      cleanup()

      renderDecision(withDecision(DECISION))

      expect(screen.getByText('credit.fields.decidedAt')).toBeInTheDocument()
      expect(
        screen.queryByText('credit.fields.checklist'),
        'an automatic decision got a «not filled» checklist row'
      ).toBeNull()
    })

    it('19-5f C-9: примечание в раскрытом списке ответов — под маской записи, текст виден; порядок — ответа модуля', () => {
      renderDecision(
        withDecision({
          ...MANUAL,
          checklist_completed: { yes: 1, applicable: 1 },
          input_snapshot: {
            checklist: {
              version: 'checklist@1',
              items: [
                { key: 'residence_proof', answer: 'n_a', note: null },
                { key: 'pay_document', answer: 'yes', note: 'FE195F-NOTE-CARD' },
              ],
            },
          },
        })
      )

      const answers = checklistRow()?.querySelector('details')
      expect(answers, 'the answer list is not in the «Чек-лист» row').toBeTruthy()
      const list = within(answers as HTMLElement)
      expect(
        list.getAllByRole('listitem').map((li) => li.textContent?.split(' — ')[0]),
        'the answers are reordered instead of kept in the module order'
      ).toEqual(['credit.checklistItem.residence_proof', 'credit.checklistItem.pay_document'])
      expect(list.getByText(/credit\.checklistItem\.pay_document/).textContent).toContain(
        'credit.checklistAnswer.yes'
      )
      // Положительный контроль: примечание на экране есть — маскируется именно оно.
      const note = list.getByText('FE195F-NOTE-CARD')
      expectObscured(note)
      // Текст пункта — копирайт интерфейса, его запись читать должна.
      expectNotObscured(list.getByText(/credit\.checklistItem\.pay_document/))
    })

    it('19-5f C-12: снимок не той формы — карточка цела: условие без кодов, ступени и суммы, в ответах только правильные записи', () => {
      renderDecision(
        withDecision(
          {
            ...PROPOSAL,
            conditional_stage: undefined,
            input_snapshot: {
              conditional: { codes: 'x' },
              checklist: {
                version: 'checklist@1',
                items: [
                  1,
                  { key: 'pay_document', answer: 'yes', note: null },
                  { key: 'id_photo_only', answer: 'maybe' },
                ],
              },
            },
          } as unknown as CreditDecision,
          'referred'
        ),
        ['credit.decisions.decide', 'credit.decisions.confirm_conditional']
      )

      expect(screen.getByText('credit.fields.decidedAt')).toBeInTheDocument()
      // Кодов нет (строка вместо списка), ступени нет — бейджа нет, суммы нет — «—».
      expect(
        conditionRow(),
        'the condition row of a malformed snapshot shows invented codes or a stage badge'
      ).toBe('credit.fields.conditionalCodescredit.card.proposedAmount amount=—')
      expect(
        screen.queryByRole('button', { name: 'credit.actions.confirmConditional' }),
        'a proposal without a known stage offers the confirmation'
      ).toBeNull()
      const answers = checklistRow()?.querySelector('details')
      expect(answers, 'the answer list is not in the «Чек-лист» row').toBeTruthy()
      expect(
        within(answers as HTMLElement)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
        'a malformed checklist entry reached the answer list'
      ).toEqual(['credit.checklistItem.pay_document — credit.checklistAnswer.yes'])
    })
  })
})

/**
 * 18-13c: панель «Джерело трафіку» во вкладке «Анкета».
 *
 * Девять строк всегда — семь меток ТЗ, согласие и время клика; пустая метка —
 * буквальное `(not set)`, как в GA4 и выгрузке, в какой бы форме пустота ни
 * пришла. Подписи — имена полей. Метки — чужой ввод: на экран только текстом.
 * Клик-идентификаторы и прочие метки — под маской записи сессии, UTM — открыты.
 * Значения синтетические.
 */
describe('CreditApplicationDetailPage → 18-13c: источник трафика', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const NO_TAGS: CreditApplicationMarketing = {
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    gclid: null,
    click_id: null,
    consent_ads: null,
    click_at: null,
  }
  const CLICK_AT = '2026-10-02T10:15:00-06:00'
  const TAGGED: CreditApplicationMarketing = {
    ...NO_TAGS,
    utm_source: 'partner1',
    utm_medium: 'cpa',
    click_id: 'abc123',
    consent_ads: 'granted',
    click_at: CLICK_AT,
  }
  const ROW_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'click_id',
    'consent_ads',
    'click_at',
  ]

  function withTags(patch: Record<string, unknown>): CreditApplicationDetail {
    return { ...APPLICATION, ...patch } as unknown as CreditApplicationDetail
  }

  function attributionSection(): HTMLElement {
    const section = screen.getByText('credit.card.attribution').closest('section')
    expect(section, 'панели «Джерело трафіку» нет во вкладке «Анкета»').not.toBeNull()
    return section as HTMLElement
  }

  /** Строки панели по порядку: [подпись, значение]. Подзаголовок «Інші мітки» строкой не считается. */
  function attributionRows(): Array<[string, string]> {
    const body = attributionSection().querySelector(':scope > div') as HTMLElement
    return Array.from(body.querySelectorAll(':scope > div')).map((row) => [
      row.children[0]?.textContent ?? '',
      row.children[1]?.textContent ?? '',
    ])
  }

  it('AC-1: девять строк в порядке ТЗ — метки, (not set), подпись согласия, время клика', () => {
    renderPage(withTags({ marketing: TAGGED }))
    expect(attributionRows()).toEqual([
      ['utm_source', 'partner1'],
      ['utm_medium', 'cpa'],
      ['utm_campaign', '(not set)'],
      ['utm_content', '(not set)'],
      ['utm_term', '(not set)'],
      ['gclid', '(not set)'],
      ['click_id', 'abc123'],
      ['consent_ads', 'credit.attribution.consent.granted'],
      ['click_at', formatDateTime(CLICK_AT)],
    ])
  })

  it('панель стоит сразу за «Дохід і позика»', () => {
    renderPage(withTags({ marketing: TAGGED }))
    const income = screen.getByText('credit.card.incomeAndLoan').closest('section')
    expect(income?.nextElementSibling, 'панель меток не следует за «Дохід і позика»').toBe(
      attributionSection()
    )
  })

  it.each([
    ['все девять null', { marketing: NO_TAGS }],
    ['поля marketing нет (стенд до 18-13)', {}],
    ['пробельная строка', { marketing: { utm_source: '  ' } }],
    ['буквальный (not set)', { marketing: { ...NO_TAGS, utm_source: '(not set)' } }],
  ] as Array<[string, Record<string, unknown>]>)(
    'AC-1: %s — во всех девяти строках (not set)',
    (_form, patch) => {
      renderPage(withTags(patch))
      const rows = attributionRows()
      expect(rows.map(([label]) => label)).toEqual(ROW_KEYS)
      for (const [label, value] of rows) {
        expect(value, `строка ${label} показала не (not set)`).toBe('(not set)')
      }
    }
  )

  it.each([
    ['denied', 'credit.attribution.consent.denied'],
    ['unknown', 'credit.attribution.consent.unknown'],
    ['later_value', 'later_value'],
  ])('согласие %s показывается как %s', (consent, shown) => {
    renderPage(withTags({ marketing: { ...NO_TAGS, consent_ads: consent } }))
    expect(new Map(attributionRows()).get('consent_ads')).toBe(shown)
  })

  it('AC-2: прочие метки — под подзаголовком, по алфавиту, после девяти строк', () => {
    renderPage(withTags({ marketing: TAGGED, marketing_other: { sub_id: 's1', fbclid: 'f1' } }))
    expect(within(attributionSection()).getByText('credit.attribution.otherTags')).toBeVisible()
    const rows = attributionRows()
    expect(rows).toHaveLength(11)
    expect(rows.slice(9)).toEqual([
      ['fbclid', 'f1'],
      ['sub_id', 's1'],
    ])
  })

  it.each([
    ['marketing_other = null', { marketing: TAGGED, marketing_other: null }],
    ['marketing_other = {}', { marketing: TAGGED, marketing_other: {} }],
    ['поля marketing_other нет', { marketing: TAGGED }],
  ] as Array<[string, Record<string, unknown>]>)(
    'AC-2: %s — подзаголовка «Інші мітки» нет, строк ровно девять',
    (_form, patch) => {
      renderPage(withTags(patch))
      expect(
        within(attributionSection()).queryByText('credit.attribution.otherTags'),
        'подзаголовок прочих меток без прочих меток: взяты из marketing?'
      ).toBeNull()
      expect(attributionRows()).toHaveLength(9)
    }
  )

  it('AC-2: gclid и click_id под маской записи сессии, UTM — открыты', () => {
    renderPage(withTags({ marketing: { ...TAGGED, gclid: 'gcl-test-1' } }))
    const section = within(attributionSection())
    expectObscured(section.getByText('abc123'))
    expectObscured(section.getByText('gcl-test-1'))
    expectNotObscured(section.getByText('partner1'))
    expectNotObscured(section.getByText('cpa'))
  })

  it('AC-2: прочая метка под маской и длиннее 256 знаков обрезана с многоточием', () => {
    const long = 'z'.repeat(300)
    renderPage(withTags({ marketing: NO_TAGS, marketing_other: { fbclid: 'f1', note: long } }))
    const rows = new Map(attributionRows())
    expect(rows.get('note')).toBe(`${'z'.repeat(256)}…`)
    expectObscured(within(attributionSection()).getByText('f1'))
  })

  it('прочая метка: ключ из 64 знаков без пробелов переносится, а не наезжает на значение', () => {
    const key = 'very_long_affiliate_sub_identifier_key_'.padEnd(64, 'x')
    renderPage(withTags({ marketing: NO_TAGS, marketing_other: { [key]: 'v1' } }))
    const label = within(attributionSection()).getByText(key)
    expect(label.closest('.break-all'), 'подпись прочей метки без переноса').not.toBeNull()
    // Положительный контроль: строка та же — подпись и значение на своих местах.
    expect(new Map(attributionRows()).get(key)).toBe('v1')
  })

  it('метка — чужой ввод: только текст, без ссылок, разметки и атрибутов со значением', () => {
    const markup = '<b>bold</b>'
    const link = 'https://evil.example/landing'
    renderPage(
      withTags({
        marketing: { ...NO_TAGS, utm_source: markup, utm_campaign: link },
        marketing_other: { sub_id: markup },
      })
    )
    const section = attributionSection()
    expect(within(section).getAllByText(markup), 'разметка метки не показана текстом').toHaveLength(
      2
    )
    expect(section.querySelector('b'), 'метка исполнена как разметка').toBeNull()
    expect(within(section).queryAllByRole('link'), 'метка стала ссылкой').toHaveLength(0)
    const leaked = Array.from(section.querySelectorAll('[title], [aria-label]')).filter((node) =>
      [markup, link].some(
        (value) =>
          (node.getAttribute('title') ?? '').includes(value) ||
          (node.getAttribute('aria-label') ?? '').includes(value)
      )
    )
    expect(leaked, 'значение метки в атрибуте — запись сессии его не маскирует').toHaveLength(0)
  })
})
