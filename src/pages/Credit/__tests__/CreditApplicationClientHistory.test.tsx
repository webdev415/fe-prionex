/**
 * Карточка заявки: другие заявки клиента, хронология и коммуникации.
 *
 * Вопрос оператора — «сколько заявок этот человек уже подавал и что с ним было».
 * Каждая пустота здесь обязана различаться, потому что значит разное: модуль поле
 * не прислал (это не ноль), сравнивать было не с чем, других заявок нет; «нет
 * права» и «CRM не ответила» — не «звонков не было». Звонки и SMS CRM берутся
 * только по `client_id` от модуля, никогда по клиенту, найденному по телефону.
 *
 * Все фикстуры выдуманные: номера `CA-900001…`, UUID вида
 * `00000000-0000-4000-8000-00000000000N`, почта на `example.org`, телефоны из
 * вымышленного пространства NANP (станция 555, абонентская часть 01xx).
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosResponse } from 'axios'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import { creditApi } from '@/features/credit/api/creditApi'
import { searchClientsByPhoneExact } from '@/api/clientSearchApi'
import { callSmsApi } from '@/features/clients/api/callSmsApi'
import { formatDate, formatDateTime } from '@/lib/formatters'
import type {
  CreditApplicantApplications,
  CreditApplicationDetail,
  CreditTimelineRow,
  CreditTimelineTransition,
} from '@/features/credit/api/types'

vi.mock('@/features/credit/hooks/useCredit')
vi.mock('@/api/clientSearchApi', () => ({ searchClientsByPhoneExact: vi.fn() }))
vi.mock('@/features/clients/api/callSmsApi', () => ({
  callSmsApi: { getClientCalls: vi.fn(), getClientSms: vi.fn() },
}))
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
  useParams: () => ({ applicationId: '00000000-0000-4000-8000-000000000001' }),
}))

const PHONE = '+14035550123'

const TRANSITION_CREATE: CreditTimelineTransition = {
  from_status: null,
  to_status: 'in_progress',
  actor: 'create',
  at: '2026-09-01T09:00:00Z',
}
const TRANSITION_REFER: CreditTimelineTransition = {
  from_status: 'scoring',
  to_status: 'referred',
  actor: 'decision',
  at: '2026-09-01T11:00:00Z',
}

const APPLICATION = {
  application_id: '00000000-0000-4000-8000-000000000001',
  external_application_id: '00000000-0000-4000-8000-000000000009',
  number: 'CA-900001',
  status: 'in_progress',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 30_000,
  client_email: 'applicant.fe176e@example.org',
  client_phone: null,
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
  project_id: 1,
  client_id: null,
  decision_id: null,
  loan_id: null,
  paydays: [],
  consents: [{ kind: 'terms', text_version: 'ca-ab-terms-draft-1', granted: true }],
  audit: [TRANSITION_CREATE, TRANSITION_REFER],
  sign_evidence: {
    method: 'typed_name',
    signed_at: '2026-09-01T11:30:00Z',
    session_id: 'session-fe176e',
    pdf_sha256: 'a'.repeat(64),
  },
  draft: {},
  documents: [],
} as unknown as CreditApplicationDetail

function row(
  id: number,
  overrides: Partial<CreditApplicantApplications['items'][number]> = {}
): CreditApplicantApplications['items'][number] {
  return {
    application_id: `00000000-0000-4000-8000-00000000010${id}`,
    number: `CA-90010${id}`,
    status: 'disbursed',
    created_at: `2026-08-0${id}T10:00:00Z`,
    decision_outcome: 'approved',
    ...overrides,
  }
}

function statusRow(transition: CreditTimelineTransition, at = transition.at): CreditTimelineRow {
  return { track: 'status', at, last_at: at, count: 1, client: null, transition }
}

function clientRow(
  event: string,
  at: string,
  extra: Partial<CreditTimelineRow> = {},
  scope: 'application' | 'client' = 'application'
): CreditTimelineRow {
  return {
    track: 'client',
    at,
    last_at: at,
    count: 1,
    client: {
      event,
      source: 'cabinet',
      scope,
      who: '0123456789abcdef',
      details: {},
      event_ids: ['00000000-0000-4000-8000-000000000201'],
    },
    transition: null,
    ...extra,
  }
}

const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

function renderPage(application: CreditApplicationDetail) {
  vi.mocked(hooks.useCreditApplication).mockReturnValue({
    ...idle,
    data: application,
  } as unknown as ReturnType<typeof hooks.useCreditApplication>)
  vi.mocked(hooks.useCreditOverview).mockReturnValue(idle as never)
  vi.mocked(hooks.useCreditManualDecision).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never)
  return render(
    <MemoryRouter>
      {/* `gcTime: Infinity` — без пятиминутного таймера сборки кэша запросов: он
          пережил бы тест. */}
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <CreditApplicationDetailPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const openHistory = () => fireEvent.click(screen.getByRole('tab', { name: 'credit.tabs.history' }))
const openForm = () => fireEvent.click(screen.getByRole('tab', { name: 'credit.tabs.form' }))
const panel = (title: string) => {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section')
  if (!section) throw new Error(`панель ${title} не найдена`)
  return section
}
const clientPanel = () => panel('credit.clientHistory.title')
const historyPanel = () => panel('credit.tabs.history')
const communicationsPanel = () => panel('credit.communications.title')
const subblock = (title: string) => {
  const heading = within(communicationsPanel()).getByRole('heading', { level: 3, name: title })
  const block = heading.parentElement
  if (!block) throw new Error(`подблок ${title} не найден`)
  return block
}
/** Строка списка, которая содержит этот текст (ключ мока `t`). */
const itemWith = (scope: HTMLElement, text: string) => {
  const item = within(scope)
    .getAllByRole('listitem')
    .find((node) => node.textContent?.includes(text))
  if (!item) throw new Error(`строка «${text}» не найдена`)
  return item
}

const withPrior = (value: CreditApplicantApplications | null | undefined) =>
  ({ ...APPLICATION, applicant_applications: value }) as CreditApplicationDetail

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(searchClientsByPhoneExact).mockResolvedValue([])
})

// ─────────────────────────────────────────────── блок «Клієнт» (H) ────

describe('блок «Клієнт»: другие заявки клиента', () => {
  const THREE: CreditApplicantApplications = {
    total: 3,
    items: [
      row(1),
      row(2, { status: 'declined', decision_outcome: 'declined' }),
      row(3, { status: 'in_progress', decision_outcome: null }),
    ],
    identity_keys: ['email'],
  }

  it('H-1: панель стоит сразу после «Зв’язки»', () => {
    renderPage(withPrior(THREE))
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '')
    expect(titles.indexOf('credit.clientHistory.title')).toBe(
      titles.indexOf('credit.card.links') + 1
    )
    expect(titles.indexOf('credit.card.links')).toBeGreaterThan(-1)
  })

  it('H-2: счёт, правило и ссылки на карточки тех заявок', () => {
    renderPage(withPrior(THREE))
    const block = clientPanel()
    expect(within(block).getByText('credit.clientHistory.otherApplications count=3')).toBeTruthy()
    expect(within(block).getByText('credit.clientHistory.identityRule')).toBeTruthy()
    for (const item of THREE.items) {
      const link = within(block).getByRole('link', { name: item.number })
      expect(link.getAttribute('href')).toBe(
        `/dashboard/credit/applications/${item.application_id}`
      )
      const line = link.closest('li')
      expect(line?.textContent).toContain(`credit.status.${item.status}`)
      expect(line?.textContent).toContain(formatDate(item.created_at))
    }
    const undecided = within(block).getByRole('link', { name: 'CA-900103' }).closest('li')
    expect(undecided?.textContent).toContain('—')
    const approved = within(block).getByRole('link', { name: 'CA-900101' }).closest('li')
    expect(approved?.textContent).toContain('credit.status.approved')
  })

  it('H-3: число — из total, а не из длины списка; усечение названо', () => {
    renderPage(
      withPrior({
        total: 12,
        items: [row(1), row(2), row(3), row(4), row(5)],
        identity_keys: ['email', 'national_id'],
      })
    )
    const block = clientPanel()
    expect(within(block).getByText('credit.clientHistory.otherApplications count=12')).toBeTruthy()
    expect(within(block).getByText('credit.clientHistory.shownOf shown=5 total=12')).toBeTruthy()
  })

  it('H-4: сравнивали и не нашли — «Інших заявок немає»', () => {
    renderPage(withPrior({ total: 0, items: [], identity_keys: ['email'] }))
    const text = clientPanel().textContent ?? ''
    expect(text).toContain('credit.clientHistory.none')
    expect(text).not.toContain('credit.clientHistory.otherApplications')
    expect(text).not.toContain('credit.clientHistory.notCounted')
    expect(text).not.toContain('credit.clientHistory.noIdentity')
  })

  it.each([
    ['поля нет', undefined],
    ['null', null],
  ] as const)('H-5: %s — «модуль не передав», не ноль', (_name, value) => {
    const application =
      value === undefined ? ({ ...APPLICATION } as CreditApplicationDetail) : withPrior(value)
    renderPage(application)
    const text = clientPanel().textContent ?? ''
    expect(text).toContain('credit.clientHistory.notCounted')
    expect(text).not.toContain('credit.clientHistory.otherApplications')
    expect(text).not.toContain('count=0')
  })

  it('H-6: контактов других заявок на экране нет', () => {
    const leaky = {
      ...THREE,
      items: THREE.items.map((item, i) => ({
        ...item,
        client_email: `other${i}.fe176e@example.org`,
        client_national_id: `90000000${i}`,
      })),
    } as unknown as CreditApplicantApplications
    renderPage(withPrior(leaky))
    const text = clientPanel().textContent ?? ''
    expect(text).not.toContain('other0.fe176e@example.org')
    expect(text).not.toContain('900000000')
    // Положительный контроль: строки те же, номер виден.
    expect(text).toContain('CA-900101')
  })

  it('H-7: блок не шлёт ни одного запроса — счёт только из поля', () => {
    const list = vi.spyOn(creditApi, 'applications')
    renderPage(withPrior(THREE))
    expect(list).not.toHaveBeenCalled()
    expect(hooks.useCreditApplications).not.toHaveBeenCalled()
    expect(searchClientsByPhoneExact).not.toHaveBeenCalled()
    expect(callSmsApi.getClientCalls).not.toHaveBeenCalled()
    expect(callSmsApi.getClientSms).not.toHaveBeenCalled()
    list.mockRestore()
  })

  it('H-8: сравнивать не с чем — «Нема за чим порівняти», а не «немає»', () => {
    renderPage(withPrior({ total: 0, items: [], identity_keys: [] }))
    const text = clientPanel().textContent ?? ''
    expect(text).toContain('credit.clientHistory.noIdentity')
    expect(text).not.toContain('credit.clientHistory.none')
    expect(text).not.toContain('credit.clientHistory.otherApplications')
    expect(text).not.toContain('credit.clientHistory.notCounted')
  })

  it.each([
    ['список', THREE],
    ['не найдено', { total: 0, items: [], identity_keys: ['email'] }],
    ['поля нет', undefined],
    ['не с чем сравнить', { total: 0, items: [], identity_keys: [] }],
  ] as const)('H-9: %s — заявки прежней CRM названы невключёнными', (_name, value) => {
    renderPage(withPrior(value as CreditApplicantApplications | undefined))
    expect(clientPanel().textContent).toContain('credit.clientHistory.legacyNotCounted')
  })

  it.each([
    ['только число', { total: 3 }],
    ['признаки не списком', { total: 3, items: [], identity_keys: 'email' }],
    ['список не массивом', { total: 3, items: {}, identity_keys: ['email'] }],
  ] as const)(
    'H-10: поле неполной формы (%s) — «модуль не передав», карточка не падает',
    (_name, value) => {
      renderPage(withPrior(value as unknown as CreditApplicantApplications))
      const text = clientPanel().textContent ?? ''
      expect(text).toContain('credit.clientHistory.notCounted')
      expect(text).not.toContain('credit.clientHistory.otherApplications')
      // Положительный контроль: страница отрисована целиком, не экран ошибки.
      expect(screen.getAllByText(/CA-900001/).length).toBeGreaterThan(0)
    }
  )
})

// ─────────────────────────────────────────────── хронология (T) ────

describe('вкладка «Історія»: хронология модуля', () => {
  // Порядок ответа НЕ совпадает ни с хронологическим (R2 = 10:00Z раньше всех), ни
  // со строковым (`…10:02…Z` < `…10:05…Z` < `…12:00…+02:00`): на экране обязан
  // остаться порядок ответа R1, R2, R3.
  const R1 = clientRow('ibv_login', '2026-09-01T10:05:00Z')
  const R2 = statusRow(TRANSITION_REFER, '2026-09-01T12:00:00+02:00')
  const R3 = clientRow('block_saved', '2026-09-01T10:02:00Z')
  const withTimeline = (timeline: CreditTimelineRow[], extra: object = {}) =>
    ({ ...APPLICATION, timeline, ...extra }) as CreditApplicationDetail

  it('T-1: строки — в порядке ответа; переход статуса один раз', () => {
    renderPage(withTimeline([R1, R2, R3]))
    openHistory()
    const lines = within(historyPanel())
      .getAllByRole('listitem')
      .map((node) => node.textContent ?? '')
    const position = (text: string) => lines.findIndex((line) => line.includes(text))
    expect(position('credit.portalEvent.ibv_login')).toBe(0)
    expect(position('credit.status.referred')).toBe(1)
    expect(position('credit.portalEvent.block_saved')).toBe(2)
    // Переход есть и в `audit`, и в хронологии — на экране один раз.
    expect(lines.filter((line) => line.includes('credit.status.referred'))).toHaveLength(1)
  })

  it('T-2: переход — «было → стало» и актор; первый — без стрелки, актор null — «—»', () => {
    const first = statusRow({ ...TRANSITION_CREATE, actor: null })
    renderPage(withTimeline([statusRow(TRANSITION_REFER), first]))
    openHistory()
    const refer = itemWith(historyPanel(), 'credit.status.referred')
    expect(refer.textContent).toContain('credit.status.scoring → ')
    expect(refer.textContent).toContain('credit.actor.decision')
    expect(refer.textContent).toContain('credit.timeline.trackStatus')
    expect(refer.textContent).not.toContain('credit.timeline.trackClient')
    const created = itemWith(historyPanel(), 'credit.status.in_progress')
    expect(created.textContent).not.toContain('→')
    expect(created.textContent).not.toContain('credit.status.null')
    expect(created.textContent).not.toContain('credit.actor.null')
    expect(created.textContent).toContain('(—)')
  })

  it('T-3: событие сайта — подписью; незнакомое — пометкой с именем', () => {
    renderPage(withTimeline([R1, clientRow('future_event', '2026-09-01T10:06:00Z')]))
    openHistory()
    const login = itemWith(historyPanel(), 'credit.portalEvent.ibv_login')
    expect(login.textContent).toContain('credit.timeline.trackClient')
    expect(login.textContent).not.toContain('credit.timeline.trackStatus')
    const unknown = itemWith(historyPanel(), 'credit.portalEvent.unknown name=future_event')
    // Голого имени без пометки нет: вне подписи «unknown» имени в строке не осталось.
    expect(
      unknown.textContent?.replace('credit.portalEvent.unknown name=future_event', '')
    ).not.toContain('future_event')
  })

  it('T-4: свёрнутая строка называет второй край', () => {
    const collapsed = clientRow('block_saved', '2026-09-01T10:00:00Z', {
      count: 4,
      last_at: '2026-09-01T10:30:00Z',
    })
    renderPage(withTimeline([collapsed, R1]))
    openHistory()
    expect(itemWith(historyPanel(), 'credit.portalEvent.block_saved').textContent).toContain(
      `credit.timeline.collapsed count=4 last=${formatDateTime('2026-09-01T10:30:00Z')}`
    )
    expect(itemWith(historyPanel(), 'credit.portalEvent.ibv_login').textContent).not.toContain(
      'credit.timeline.collapsed'
    )
  })

  it('T-5: событие адреса клиента помечено в строке; событие заявки — нет', () => {
    renderPage(
      withTimeline([
        clientRow('code_requested', '2026-09-01T09:30:00Z', {}, 'client'),
        clientRow('block_saved', '2026-09-01T09:40:00Z', {}, 'application'),
      ])
    )
    openHistory()
    expect(itemWith(historyPanel(), 'credit.portalEvent.code_requested').textContent).toContain(
      'credit.timeline.scopeClient'
    )
    expect(itemWith(historyPanel(), 'credit.portalEvent.block_saved').textContent).not.toContain(
      'credit.timeline.scopeClient'
    )
  })

  it('T-6: лента усечена — названо и показанное, и полное число', () => {
    const events = Array.from({ length: 200 }, (_, i) => ({
      event_id: `00000000-0000-4000-8000-${String(1000 + i).padStart(12, '0')}`,
      ts: '2026-09-01T10:00:00Z',
      source: 'cabinet',
      event: 'block_saved',
    }))
    renderPage(withTimeline([R1], { portal_events: events, portal_events_total: 250 }))
    openHistory()
    expect(
      within(historyPanel()).getByText('credit.timeline.truncated shown=200 total=250')
    ).toBeTruthy()
  })

  it('T-6: показано всё — пометки об усечении нет', () => {
    renderPage(
      withTimeline([R1], {
        portal_events: [
          {
            event_id: '00000000-0000-4000-8000-000000000301',
            ts: R1.at,
            source: 'cabinet',
            event: 'ibv_login',
          },
        ],
        portal_events_total: 1,
      })
    )
    openHistory()
    expect(historyPanel().textContent).not.toContain('credit.timeline.truncated')
  })

  it('T-7a: хронологии нет — прежний список переходов, те же строки и порядок', () => {
    renderPage({ ...APPLICATION } as CreditApplicationDetail)
    openHistory()
    const lines = within(historyPanel())
      .getAllByRole('listitem')
      .map((node) => node.textContent)
    // Две первые строки вкладки — `audit` в прежнем виде: время, «было → стало»,
    // актор в скобках. Следом — согласие (прежний список согласий).
    expect(lines.slice(0, 2)).toEqual([
      `${formatDateTime(TRANSITION_CREATE.at)}credit.status.in_progress(credit.actor.create)`,
      `${formatDateTime(TRANSITION_REFER.at)}credit.status.scoring → credit.status.referred(credit.actor.decision)`,
    ])
  })

  it('T-7b: хронологии нет — честная пометка; есть — пометки нет', () => {
    const { unmount } = renderPage({ ...APPLICATION } as CreditApplicationDetail)
    openHistory()
    expect(within(historyPanel()).getByText('credit.timeline.notProvided')).toBeTruthy()
    unmount()
    renderPage(withTimeline([R1]))
    openHistory()
    expect(historyPanel().textContent).not.toContain('credit.timeline.notProvided')
  })

  it('T-7c: лента пустая — как отсутствие: пометка и прежний список переходов', () => {
    renderPage(withTimeline([]))
    openHistory()
    expect(within(historyPanel()).getByText('credit.timeline.notProvided')).toBeTruthy()
    const lines = within(historyPanel())
      .getAllByRole('listitem')
      .map((node) => node.textContent)
    expect(lines.slice(0, 2)).toEqual([
      `${formatDateTime(TRANSITION_CREATE.at)}credit.status.in_progress(credit.actor.create)`,
      `${formatDateTime(TRANSITION_REFER.at)}credit.status.scoring → credit.status.referred(credit.actor.decision)`,
    ])
  })

  it('T-7d: в ленте нет переходов статуса — прежний список переходов под ней', () => {
    renderPage(withTimeline([R1, R3]))
    openHistory()
    const text = historyPanel().textContent ?? ''
    expect(text).not.toContain('credit.timeline.notProvided')
    expect(text).toContain('credit.portalEvent.ibv_login')
    expect(itemWith(historyPanel(), 'credit.status.referred').textContent).toBe(
      `${formatDateTime(TRANSITION_REFER.at)}credit.status.scoring → credit.status.referred(credit.actor.decision)`
    )
  })

  it('T-8: `details` и `who` не рисуются', () => {
    const detailed = clientRow('document_opened', '2026-09-01T10:10:00Z', {
      client: {
        event: 'document_opened',
        source: 'cabinet',
        scope: 'application',
        who: 'fe176e0123456789',
        details: { marker: 'DETAILS-fe176e-zz' },
        event_ids: ['00000000-0000-4000-8000-000000000401'],
      },
    })
    renderPage(withTimeline([detailed]))
    openHistory()
    const line = itemWith(historyPanel(), 'credit.portalEvent.document_opened')
    expect(line.textContent).not.toContain('DETAILS-fe176e-zz')
    expect(line.textContent).not.toContain('fe176e0123456789')
  })

  it.each([
    ['с хронологией', [R1]],
    ['без хронологии', undefined],
  ] as const)('T-9: %s — след подписи и согласия на месте', (_name, timeline) => {
    renderPage(
      (timeline ? withTimeline([...timeline]) : { ...APPLICATION }) as CreditApplicationDetail
    )
    openHistory()
    const text = historyPanel().textContent ?? ''
    expect(text).toContain('credit.card.signEvidence')
    expect(text).toContain('session-fe176e')
    expect(text).toContain('credit.card.consents')
    expect(text).toContain('credit.consent.terms')
  })
})

// ──────────────────────────────── след правовых текстов (18-4e, L) ────

describe('вкладка «Історія»: показанные правовые тексты', () => {
  const TRAIL = [
    {
      source: 'legal-texts',
      subject: 'sign.max_cost',
      publication_id: 63,
      version_no: 1,
      sha256: 'c'.repeat(64),
      locale: 'en',
      shown_at: null,
      received_at: '2026-09-01T09:00:00+00:00',
    },
  ]
  const withTrail = (extra: object) => ({ ...APPLICATION, ...extra }) as CreditApplicationDetail

  it.each([
    ['поля нет', {}],
    ['null', { legal_texts_shown: null }],
    ['объект', { legal_texts_shown: {} }],
    ['строка', { legal_texts_shown: 'x' }],
  ])('L-1: %s — блока нет, согласия на месте', (_name, extra) => {
    renderPage(withTrail(extra))
    openHistory()
    const text = historyPanel().textContent ?? ''
    expect(text).not.toContain('credit.legalTrail.title')
    expect(text).not.toContain('credit.legalTrail.empty')
    expect(text).toContain('credit.consent.terms')
  })

  it('L-2: пустой след — подзаголовок и «следа нет» под согласиями', () => {
    renderPage(withTrail({ legal_texts_shown: [] }))
    openHistory()
    const text = historyPanel().textContent ?? ''
    expect(text).toContain('credit.legalTrail.empty')
    expect(text.indexOf('credit.card.consents')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('credit.legalTrail.title')).toBeGreaterThan(
      text.indexOf('credit.consent.terms')
    )
  })

  it('L-3: след без согласий — блок есть, списка согласий нет', () => {
    renderPage(withTrail({ consents: [], legal_texts_shown: TRAIL }))
    openHistory()
    const panel = historyPanel()
    expect(panel.textContent).toContain('credit.legalTrail.title')
    expect(within(panel).getByRole('table').textContent).toContain('sign.max_cost')
    expect(panel.textContent).not.toContain('credit.card.consents')
  })
})

// ─────────────────────────────────────────────── коммуникации (C) ────

describe('вкладка «Історія»: коммуникации', () => {
  const linked = (extra: object = {}) =>
    ({ ...APPLICATION, client_id: 7, ...extra }) as CreditApplicationDetail
  const http = (status: number) =>
    new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, { status } as AxiosResponse)

  function crmAnswers(
    calls: Awaited<ReturnType<typeof callSmsApi.getClientCalls>> | Error,
    sms: Awaited<ReturnType<typeof callSmsApi.getClientSms>> | Error
  ) {
    if (calls instanceof Error) vi.mocked(callSmsApi.getClientCalls).mockRejectedValue(calls)
    else vi.mocked(callSmsApi.getClientCalls).mockResolvedValue(calls)
    if (sms instanceof Error) vi.mocked(callSmsApi.getClientSms).mockRejectedValue(sms)
    else vi.mocked(callSmsApi.getClientSms).mockResolvedValue(sms)
  }

  const CALLS = [
    {
      call_id: 'call-fe176e-1',
      client_id: 7,
      agent_extension: 'EXT-fe176e',
      customer_number: '+14035550188',
      direction: 'inbound',
      state: 'completed',
      initiated_at: '2026-09-01T10:00:00Z',
      talk_duration: 65,
      outcome: 'answered',
    },
    {
      call_id: 'call-fe176e-2',
      client_id: 7,
      agent_extension: 'EXT-fe176e',
      customer_number: '+14035550188',
      direction: 'outbound',
      state: 'failed',
      initiated_at: '2026-09-02T10:00:00Z',
      talk_duration: null,
      outcome: null,
    },
  ]
  const SMS = [
    {
      id: 1,
      client_id: 7,
      direction: 'outbound',
      phone_number: '+14035550177',
      status: 'delivered',
      content: 'SMS-TEXT-fe176e',
      sent_at: '2026-09-03T10:00:00Z',
      created_at: '2026-09-03T10:00:00Z',
    },
  ]

  it('C-1: подблоки по порядку, маркеры каналов — последними', () => {
    renderPage({ ...APPLICATION } as CreditApplicationDetail)
    openHistory()
    const text = communicationsPanel().textContent ?? ''
    const order = [
      'credit.communications.calls',
      'credit.communications.sms',
      'credit.communications.mail',
      'credit.communications.gotoMissing',
      'credit.communications.smsCanadaMissing',
    ].map((key) => text.indexOf(key))
    expect(order.every((position) => position >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('C-2: без client_id — «не пов’язав», и ни одного запроса, даже при найденном по телефону', async () => {
    vi.mocked(searchClientsByPhoneExact).mockResolvedValue([
      { id: 99, first_name: 'Test', last_name: 'Synthetic' },
    ] as never)
    renderPage({ ...APPLICATION, client_phone: PHONE } as CreditApplicationDetail)
    // Вкладка «Анкета»: клиент найден по телефону — это догадка, не связь.
    expect(await screen.findByText('credit.clientLink.byPhone')).toBeTruthy()
    openHistory()
    expect(subblock('credit.communications.calls').textContent).toContain(
      'credit.communications.noClient'
    )
    expect(subblock('credit.communications.sms').textContent).toContain(
      'credit.communications.noClient'
    )
    openForm()
    openHistory()
    expect(callSmsApi.getClientCalls).not.toHaveBeenCalled()
    expect(callSmsApi.getClientSms).not.toHaveBeenCalled()
  })

  it('C-3: client_id от модуля — по одному запросу звонков и SMS, по пять строк', async () => {
    crmAnswers({ calls: [], total: 0 }, { messages: [], total: 0 })
    renderPage(linked())
    openHistory()
    // Ответы дошли до экрана — значит, обе загрузки закончились, и лишний запрос
    // (второй вызов внутри одной загрузки) уже был бы учтён.
    await within(subblock('credit.communications.calls')).findByText(
      'credit.communications.noneCalls'
    )
    await within(subblock('credit.communications.sms')).findByText('credit.communications.noneSms')
    expect(callSmsApi.getClientCalls).toHaveBeenCalledTimes(1)
    expect(callSmsApi.getClientCalls).toHaveBeenCalledWith(7, { limit: 5 })
    expect(callSmsApi.getClientSms).toHaveBeenCalledTimes(1)
    expect(callSmsApi.getClientSms).toHaveBeenCalledWith(7, { limit: 5 })
  })

  it('C-4: звонки — время, направление, длительность, исход; без номеров', async () => {
    crmAnswers({ calls: CALLS, total: 40 } as never, { messages: [], total: 0 })
    renderPage(linked())
    openHistory()
    const block = subblock('credit.communications.calls')
    await waitFor(() => expect(within(block).getAllByRole('listitem')).toHaveLength(2))
    const [inbound, outbound] = within(block).getAllByRole('listitem')
    expect(inbound.textContent).toContain(formatDateTime(CALLS[0].initiated_at))
    expect(inbound.textContent).toContain('credit.communications.direction.inbound')
    expect(inbound.textContent).toContain('1:05')
    expect(inbound.textContent).toContain('answered')
    expect(outbound.textContent).toContain('credit.communications.direction.outbound')
    expect(outbound.textContent).toContain('—')
    expect(outbound.textContent).toContain('failed')
    expect(within(block).getByText('credit.communications.shownOf shown=2 total=40')).toBeTruthy()
    const card = within(communicationsPanel()).getByRole('link', {
      name: 'credit.communications.openClientCard',
    })
    expect(card.getAttribute('href')).toBe('/dashboard/clients/7')
    // Ссылка общая для обоих каналов — не внутри подблока SMS.
    expect(within(subblock('credit.communications.sms')).queryByRole('link')).toBeNull()
    const text = communicationsPanel().textContent ?? ''
    expect(text).not.toContain('+14035550188')
    expect(text).not.toContain('EXT-fe176e')
  })

  it('C-5: SMS — время и статус; ни текста, ни номера', async () => {
    crmAnswers({ calls: [], total: 0 }, { messages: SMS, total: 1 } as never)
    renderPage(linked())
    openHistory()
    const block = subblock('credit.communications.sms')
    await waitFor(() => expect(within(block).getAllByRole('listitem')).toHaveLength(1))
    const [message] = within(block).getAllByRole('listitem')
    expect(message.textContent).toContain(formatDateTime(SMS[0].sent_at))
    expect(message.textContent).toContain('delivered')
    const text = communicationsPanel().textContent ?? ''
    expect(text).not.toContain('SMS-TEXT-fe176e')
    expect(text).not.toContain('+14035550177')
  })

  it('C-6: ответ получен, ничего нет — «не знайдено»', async () => {
    crmAnswers({ calls: [], total: 0 }, { messages: [], total: 0 })
    renderPage(linked())
    openHistory()
    expect(
      await within(subblock('credit.communications.calls')).findByText(
        'credit.communications.noneCalls'
      )
    ).toBeTruthy()
    expect(
      await within(subblock('credit.communications.sms')).findByText(
        'credit.communications.noneSms'
      )
    ).toBeTruthy()
  })

  it('C-7: 403 — «немає права», а не «не знайдено»', async () => {
    crmAnswers(http(403), http(403))
    renderPage(linked())
    openHistory()
    await waitFor(() =>
      expect(subblock('credit.communications.sms').textContent).toContain(
        'credit.communications.forbidden'
      )
    )
    expect(subblock('credit.communications.calls').textContent).toContain(
      'credit.communications.forbidden'
    )
    const text = communicationsPanel().textContent ?? ''
    expect(text).not.toContain('credit.communications.noneCalls')
    expect(text).not.toContain('credit.communications.noneSms')
  })

  it.each([
    ['500', () => http(500)],
    ['сеть без ответа', () => new AxiosError('Network Error', 'ERR_NETWORK')],
  ] as const)(
    'C-8: %s — «CRM не відповіла», не «не знайдено» и не «немає права»',
    async (_name, error) => {
      crmAnswers(error(), error())
      renderPage(linked())
      openHistory()
      await waitFor(() =>
        expect(subblock('credit.communications.sms').textContent).toContain(
          'credit.communications.failed'
        )
      )
      expect(subblock('credit.communications.calls').textContent).toContain(
        'credit.communications.failed'
      )
      const text = communicationsPanel().textContent ?? ''
      expect(text).not.toContain('credit.communications.noneCalls')
      expect(text).not.toContain('credit.communications.noneSms')
      expect(text).not.toContain('credit.communications.forbidden')
    }
  )

  it('C-9: письма сайта — строки хронологии обеих областей; прочие события — нет', () => {
    renderPage({
      ...APPLICATION,
      timeline: [
        clientRow('notification_mailed', '2026-09-01T10:00:00Z'),
        clientRow('ibv_login', '2026-09-01T10:01:00Z'),
        clientRow('code_sent', '2026-09-01T10:02:00Z', {}, 'client'),
      ],
    } as CreditApplicationDetail)
    openHistory()
    const block = subblock('credit.communications.mail')
    const mailed = itemWith(block, 'credit.portalEvent.notification_mailed')
    expect(mailed.textContent).toContain(formatDateTime('2026-09-01T10:00:00Z'))
    expect(mailed.textContent).not.toContain('credit.timeline.scopeClient')
    expect(itemWith(block, 'credit.portalEvent.code_sent').textContent).toContain(
      'credit.timeline.scopeClient'
    )
    expect(block.textContent).not.toContain('credit.portalEvent.ibv_login')
    expect(block.textContent).not.toContain('credit.communications.mailNone')
    expect(block.textContent).toContain('credit.communications.mailLoanStage')
  })

  it('C-9: писем нет — «листів немає», и граница писем кредита названа', () => {
    renderPage({
      ...APPLICATION,
      timeline: [clientRow('ibv_login', '2026-09-01T10:01:00Z')],
    } as CreditApplicationDetail)
    openHistory()
    const block = subblock('credit.communications.mail')
    expect(block.textContent).toContain('credit.communications.mailNone')
    expect(block.textContent).toContain('credit.communications.mailLoanStage')
  })

  it.each([
    ['поля нет', undefined],
    ['лента пустая', []],
  ] as const)(
    'C-9c: хронологии нет (%s) — «не передав», а не «листів немає»',
    (_name, timeline) => {
      renderPage({ ...APPLICATION, timeline } as unknown as CreditApplicationDetail)
      openHistory()
      const block = subblock('credit.communications.mail')
      expect(block.textContent).toContain('credit.communications.mailNotProvided')
      expect(block.textContent).not.toContain('credit.communications.mailNone')
      expect(block.textContent).toContain('credit.communications.mailLoanStage')
    }
  )

  it.each([
    ['без связи', null],
    ['со связью', 7],
  ] as const)('C-10: %s — маркеры отсутствующих каналов видны всегда', (_name, clientId) => {
    crmAnswers({ calls: [], total: 0 }, { messages: [], total: 0 })
    renderPage({ ...APPLICATION, client_id: clientId } as CreditApplicationDetail)
    openHistory()
    const text = communicationsPanel().textContent ?? ''
    expect(text).toContain('credit.communications.gotoMissing')
    expect(text).toContain('credit.communications.smsCanadaMissing')
  })

  it('C-11: число есть, а строк нет — «показано 0 з N», не «не знайдено»', async () => {
    crmAnswers({ calls: [], total: 5 }, { messages: [], total: 0 })
    renderPage(linked())
    openHistory()
    const block = subblock('credit.communications.calls')
    expect(
      await within(block).findByText('credit.communications.shownOf shown=0 total=5')
    ).toBeTruthy()
    expect(block.textContent).not.toContain('credit.communications.noneCalls')
  })

  it('C-12: повторный заход на вкладку за минуту не шлёт запросы в CRM снова', async () => {
    crmAnswers({ calls: [], total: 0 }, { messages: [], total: 0 })
    renderPage(linked())
    openHistory()
    await within(subblock('credit.communications.calls')).findByText(
      'credit.communications.noneCalls'
    )
    await within(subblock('credit.communications.sms')).findByText('credit.communications.noneSms')
    openForm()
    openHistory()
    await within(subblock('credit.communications.calls')).findByText(
      'credit.communications.noneCalls'
    )
    expect(callSmsApi.getClientCalls).toHaveBeenCalledTimes(1)
    expect(callSmsApi.getClientSms).toHaveBeenCalledTimes(1)
  })
})
