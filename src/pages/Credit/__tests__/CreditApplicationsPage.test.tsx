/**
 * Раздел «Кредитный модуль» → Заявки.
 *
 * Что здесь защищается:
 *  - список показывает то, что вернул модуль, и ведёт в карточку (иначе очередь
 *    бесполезна);
 *  - фильтр по статусу уходит в запрос, а не фильтрует локально: страниц много,
 *    локальная фильтрация показывала бы верификатору неполную очередь;
 *  - метрики считаются из сводки, а не выдумываются нулями;
 *  - плашка этапа 1 честно предупреждает, что роль — макет стенда.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreditApplicationsPage } from '../CreditApplicationsPage'
import { creditApi } from '@/features/credit/api/creditApi'
import type { CreditApplicationSummary, CreditOverview } from '@/features/credit/api/types'

vi.mock('@/features/credit/api/creditApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/credit/api/creditApi')>(
    '@/features/credit/api/creditApi'
  )
  return {
    ...actual,
    creditApi: {
      overview: vi.fn(),
      applications: vi.fn(),
    },
  }
})

const OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: ['credit.applications.read', 'credit.decisions.decide'],
  roles_available: ['verifier', 'underwriter', 'risk_manager'],
  applications: { referred: 2, scoring: 1, declined: 118, disbursed: 257 },
  loans: { active: 61 },
  application_statuses: ['in_progress', 'scoring', 'referred', 'approved', 'declined', 'disbursed'],
  demo_mode: true,
}

const ROW: CreditApplicationSummary = {
  application_id: '11111111-2222-3333-4444-555555555555',
  number: 'DEMO-202608-03A17C',
  status: 'referred',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 90_000,
  client_email: 'marie.tremblay@example.ca',
  created_at: '2026-08-29T09:00:00Z',
  updated_at: '2026-08-29T09:05:00Z',
  decision_outcome: 'referred',
  decision_mode: 'automatic',
  final_amount_minor: null,
}

function renderPage(initialEntry = '/dashboard/credit/applications') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <CreditApplicationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CreditApplicationsPage', () => {
  beforeEach(() => {
    vi.mocked(creditApi.overview).mockResolvedValue(OVERVIEW)
    vi.mocked(creditApi.applications).mockResolvedValue({
      items: [ROW],
      next_cursor: null,
      total: 1,
    })
  })

  it('показывает заявку из модуля', async () => {
    renderPage()
    expect(await screen.findByText('DEMO-202608-03A17C')).toBeInTheDocument()
    expect(screen.getByText('marie.tremblay@example.ca')).toBeInTheDocument()
    // 90 000 minor = 900.00 CAD: форматирование денег не должно терять масштаб
    expect(screen.getByText(/900[,.]00\s*CAD/)).toBeInTheDocument()
  })

  it('фильтр по статусу уходит в запрос к модулю, а не фильтрует локально', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')

    // В тестовой среде i18n замокан и возвращает ключ (см. src/test/setup.ts),
    // поэтому ищем кнопку по ключу перевода, а не по русскому/английскому тексту.
    fireEvent.click(screen.getByRole('button', { name: 'credit.status.referred' }))

    await waitFor(() => {
      expect(vi.mocked(creditApi.applications)).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['referred'] })
      )
    })
  })

  it('метрики берутся из сводки модуля', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    // счётчик статуса «ручной разбор» из overview
    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('честно предупреждает, что роль — макет стенда этапа 1', async () => {
    renderPage()
    expect(await screen.findByText('credit.stand.notice')).toBeInTheDocument()
  })
})
