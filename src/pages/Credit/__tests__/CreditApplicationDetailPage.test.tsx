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
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import type { CreditApplicationDetail } from '@/features/credit/api/types'

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
