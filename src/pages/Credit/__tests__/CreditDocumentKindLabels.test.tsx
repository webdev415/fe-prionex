/**
 * Колонка «Вид» в документах карточек заявки и кредита.
 *
 * Защищаются две вещи, которые ломаются молча:
 *  1) договор этапа 1 (`agreement_draft`) подписан словами — на DEV так
 *     выглядит каждый сгенерированный договор, и сырой код висел у всех;
 *  2) вид, которого фронт не знает, называется неизвестным видом с кодом, а
 *     не голым кодом, — и правило «не знаю» не глотает загрузки клиента:
 *     `DocumentMeta.kind` в контракте — oneOf видов модуля и видов загрузки.
 *
 * Мок `t` рендерит НАСТОЯЩИЙ украинский словарь с подстановкой: ключ-печатающий
 * мок показал бы одно и то же имя ключа и до правки, и после — подпись, которой
 * в словаре нет, он не отличает от той, что есть. Запасной текст вторым
 * аргументом мок отдаёт, как i18next, — иначе сцена «до правки» врала бы.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as hooks from '@/features/credit/hooks/useCredit'
import {
  CREDIT_DOCUMENT_KINDS,
  CREDIT_DYNAMIC_NAMESPACES,
  CREDIT_UPLOADED_DOCUMENT_KINDS,
} from '@/features/credit/api/enums'
import type {
  CreditApplicationDetail,
  CreditDocumentMeta,
  CreditLoanDetail,
  CreditLoanState,
} from '@/features/credit/api/types'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import { CreditLoanDetailPage } from '../CreditLoanDetailPage'
import en from '../../../../public/locales/en/common.json'
import es from '../../../../public/locales/es/common.json'
import uk from '../../../../public/locales/uk/common.json'

const IDS = vi.hoisted(() => ({
  application: 'aaaaaaaa-0000-4000-8000-000000000011',
  loan: 'bbbbbbbb-0000-4000-8000-000000000012',
}))

vi.mock('@/features/credit/hooks/useCredit')
vi.mock('react-i18next', async () => {
  const dictionary = (await import('../../../../public/locales/uk/common.json')).default as Record<
    string,
    unknown
  >
  const find = (key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        dictionary
      )
  const t = (key: string, options?: unknown): string => {
    const vars = typeof options === 'object' && options ? (options as Record<string, unknown>) : {}
    const found = find(key)
    const template =
      typeof found === 'string'
        ? found
        : typeof options === 'string'
          ? options
          : typeof vars.defaultValue === 'string'
            ? vars.defaultValue
            : key
    return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match
    )
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ loanId: IDS.loan, applicationId: IDS.application }),
}))

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

const text = (key: string) => String(lookup(uk, key))

/** Метаданные документа по форме `DocumentMeta` контракта; вид — параметр сцены. */
const documentOf = (kind: string, index: number): CreditDocumentMeta => ({
  document_id: `dddddddd-0000-4000-8000-00000000010${index}`,
  application_id: IDS.application,
  loan_id: IDS.loan,
  client_id: null,
  debt_id: null,
  client_document_id: null,
  content_available: true,
  kind,
  title: `file-${index}.md`,
  template_version: 'agr-1-draft',
  sha256: 'a'.repeat(64),
  generated_at: '2026-09-01T10:00:00Z',
})

const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

const LOAN = {
  loan_id: IDS.loan,
  contract_number: 'FB-000090',
  product_code: 'CA_AB_PAYDAY',
  product_version: '1',
  status: 'active',
  currency: 'CAD',
  principal_minor: 40_000,
  balance_total_minor: 40_000,
  project_id: 1,
  client_id: null,
  debt_id: null,
  application_id: IDS.application,
  origin: 'credit_module',
  jurisdiction: 'CA-AB',
  schedule_version: 1,
  delinquency_days: 0,
  advance_refund_excess_minor: 0,
  paid_minor: 0,
  disbursed_at: '2026-09-01T09:00:00Z',
  maturity_date: '2026-10-19',
} as unknown as CreditLoanDetail

const STATE = {
  loan_id: IDS.loan,
  contract_number: 'FB-000090',
  status: 'active',
  currency: 'CAD',
  paid_minor: 0,
  delinquency: { delinquency_days: 0, arrears_flag: false, no_contact_flag: false },
  balances: {
    principal_minor: 40000,
    interest_minor: 0,
    fee_minor: 0,
    commission_minor: 0,
    penalty_minor: 0,
    fine_minor: 0,
    overpayment_minor: 0,
    total_due_minor: 40000,
    overdue_minor: 0,
    principal_charged_minor: 40000,
    interest_charged_minor: 0,
    fee_charged_minor: 0,
    commission_charged_minor: 0,
    penalty_charged_minor: 0,
    fine_charged_minor: 0,
    total_charged_minor: 40000,
    default_interest_minor: 0,
    nsf_fees_minor: 0,
  },
  flags: { validation_valid: true, delinquency_bucket: 'current' },
  next_payment: { due_date: '2026-10-10', amount_minor: 11400 },
  payments: [],
} as unknown as CreditLoanState

const APPLICATION = {
  application_id: IDS.application,
  external_application_id: 'c0c0c0c0-0000-4000-8000-000000000016',
  number: 'CA-000257',
  status: 'disbursed',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 40_000,
  client_email: null,
  client_phone: null,
  created_at: '2026-08-31T20:07:08.091139+00:00',
  updated_at: '2026-08-31T20:48:41.882126+00:00',
  expires_at: '2026-09-01T20:07:08.103297+00:00',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
  project_id: 1,
  client_id: null,
  decision_id: null,
  loan_id: IDS.loan,
  resume_step: null,
  missing_fields: [],
  paydays: [],
  consents: [],
  audit: [],
  draft: {},
  documents: [],
} as unknown as CreditApplicationDetail

function renderLoanCard(kinds: string[]) {
  vi.mocked(hooks.useCreditLoan).mockReturnValue({
    ...idle,
    data: LOAN,
  } as unknown as ReturnType<typeof hooks.useCreditLoan>)
  vi.mocked(hooks.useCreditLoanState).mockReturnValue({
    ...idle,
    data: STATE,
  } as unknown as ReturnType<typeof hooks.useCreditLoanState>)
  for (const hook of [
    hooks.useCreditLoanSchedule,
    hooks.useCreditLoanJournal,
    hooks.useCreditLoanScheduleVersions,
    hooks.useCreditApplication,
  ]) {
    vi.mocked(hook).mockReturnValue(idle as never)
  }
  vi.mocked(hooks.useCreditLoanDocuments).mockReturnValue({
    ...idle,
    data: { items: kinds.map(documentOf) },
  } as unknown as ReturnType<typeof hooks.useCreditLoanDocuments>)
  render(
    <MemoryRouter>
      {/* Паспорт кредита ищет клиента CRM по телефону заявки — ему нужен клиент
          запросов; `gcTime: Infinity` — без пятиминутного таймера сборки кэша,
          который пережил бы тест. */}
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <CreditLoanDetailPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
  // Контроль: отрисован паспорт ЭТОГО кредита, а не экран ошибки.
  expect(screen.getAllByText(/FB-000090/).length).toBeGreaterThan(0)
  openDocumentsTab()
}

function renderApplicationCard(kinds: string[]) {
  vi.mocked(hooks.useCreditApplication).mockReturnValue({
    ...idle,
    data: { ...APPLICATION, documents: kinds.map(documentOf) },
  } as unknown as ReturnType<typeof hooks.useCreditApplication>)
  vi.mocked(hooks.useCreditOverview).mockReturnValue(idle as never)
  vi.mocked(hooks.useCreditManualDecision).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as never)
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CreditApplicationDetailPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
  expect(screen.getAllByText(/CA-000257/).length).toBeGreaterThan(0)
  openDocumentsTab()
}

function openDocumentsTab() {
  fireEvent.click(screen.getByRole('tab', { name: text('credit.tabs.documents') }))
}

/** Подписи колонки «Вид» — первые ячейки строк таблицы документов, по порядку. */
function kindCells(): string[] {
  const header = screen.getByRole('columnheader', { name: text('credit.columns.documentKind') })
  const table = header.closest('table')
  if (!table) throw new Error('таблицы документов нет')
  return [...table.querySelectorAll('tbody tr')].map(
    (row) => row.querySelector('td')?.textContent ?? ''
  )
}

const CARDS = [
  ['кредита', renderLoanCard],
  ['заявки', renderApplicationCard],
] as const

describe.each(CARDS)('карточка %s → колонка «Вид»', (_card, renderCard) => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('K-1: договор этапа 1 подписан словами, а не кодом', () => {
    // Положительный контроль в той же таблице: вид со старой подписью.
    renderCard(['agreement_draft', 'contract'])
    expect(kindCells()).toEqual(['Проєкт договору', 'Кредитний договір'])
  })

  it('K-2: незнакомый вид — «Невідомий вид (код)», не голый код', () => {
    renderCard(['future_kind', 'contract'])
    expect(kindCells()).toEqual(['Невідомий вид (future_kind)', 'Кредитний договір'])
  })

  it('K-3: каждая загрузка клиента — своей подписью, правило «не знаю» её не глотает', () => {
    // `DocumentMeta.kind` — oneOf DocumentKind | UploadedDocumentKind: в списке
    // заявки на DEV лежат и выписки, и чеки клиента. Все семь видов, а не
    // представители: выпавший из перечня вид стал бы «Невідомий вид».
    renderCard([
      'bank_statement_pdf',
      'id_photo',
      'void_cheque',
      'pad_form',
      'pay_stub',
      'utility_bill',
      'other',
    ])
    expect(kindCells()).toEqual([
      'Банківська виписка',
      'Документ, що посвідчує особу',
      'Анульований чек',
      'Згода на автосписання (PAD)',
      'Розрахунковий лист',
      'Комунальний рахунок',
      'Інше',
    ])
  })
})

describe('перечень и словари видов документа', () => {
  it('K-4: agreement_draft входит в перечень видов модуля — все 11 значений DocumentKind', () => {
    // Снято с contracts/openapi.yaml модуля, `DocumentKind.enum`: main 19395aa0
    // (то же на b5a0b517 и ae7e0eeb).
    expect([...CREDIT_DOCUMENT_KINDS].sort()).toEqual(
      [
        'agreement_draft',
        'contract',
        'schedule',
        'pcci',
        'nosia',
        'early_settlement_quote',
        'settlement_statement',
        'initial_disclosure',
        'payment_receipt',
        'cancellation_notice',
        'regulatory_card_ua',
      ].sort()
    )
  })

  it('K-4b: перечень загрузок клиента — все 7 значений UploadedDocumentKind', () => {
    // Снято с того же контракта (main 19395aa0), `UploadedDocumentKind.enum`.
    expect([...CREDIT_UPLOADED_DOCUMENT_KINDS].sort()).toEqual(
      [
        'bank_statement_pdf',
        'id_photo',
        'void_cheque',
        'pad_form',
        'pay_stub',
        'utility_bill',
        'other',
      ].sort()
    )
  })

  it('K-4c: страж словарей требует подписи у обоих перечней', () => {
    // `i18nKeys.test.ts` обходит `CREDIT_DYNAMIC_NAMESPACES`: сузься пространство
    // `documentKind` до видов модуля — подпись загрузки удалялась бы из обоих
    // словарей молча, а запасного текста у известного вида больше нет.
    expect([...CREDIT_DYNAMIC_NAMESPACES.documentKind].sort()).toEqual(
      [...CREDIT_DOCUMENT_KINDS, ...CREDIT_UPLOADED_DOCUMENT_KINDS].sort()
    )
  })

  it.each([
    ['uk', uk, 'Проєкт договору', 'Невідомий вид ({{code}})'],
    ['en', en, 'Draft agreement', 'Unknown kind ({{code}})'],
    ['es', es, 'Borrador de contrato', 'Tipo desconocido ({{code}})'],
  ] as const)(
    'K-5: %s — подписи договора и неизвестного вида дословно',
    (_lang, dictionary, draft, unknown) => {
      expect(lookup(dictionary, 'credit.documentKind.agreement_draft')).toBe(draft)
      expect(lookup(dictionary, 'credit.documentKind.unknown')).toBe(unknown)
    }
  )
})
