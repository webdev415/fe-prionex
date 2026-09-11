/**
 * Раздел «Кредитный модуль» → Кредиты, колонка «Видано».
 *
 * Дата выдачи не показывалась в списке вовсе, хотя сервис по ней сортирует.
 * Защищается ровно то, что легко сломать молча: колонка есть, дата в ней
 * настоящая, а сортировка — СЕРВЕРНАЯ. Отсортировать загруженную страницу на
 * клиенте значит соврать: оператор просит «самые старые выдачи наверх» и
 * получает самые старые среди двадцати строк текущей страницы, а не среди всех.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditLoansPage } from '../CreditLoansPage'
import { useCreditLoans, useCreditOverview } from '@/features/credit/hooks/useCredit'
import type { CreditLoanSummary, CreditOverview } from '@/features/credit/api/types'

// Мокаем ХУКИ, а не HTTP: живой QueryClient оставляет таймеры notifyManager,
// которые срабатывают после teardown jsdom и падают в чужом тест-файле.
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditLoans: vi.fn(),
}))

const OVERVIEW = {
  role: 'underwriter',
  permissions: ['credit.loans.read'],
  roles_available: ['underwriter'],
  applications: {},
  loans: { active: 61 },
  application_statuses: ['disbursed'],
  demo_mode: true,
} as unknown as CreditOverview

/** Снимок живой строки стенда `GET /loans` (FB-000074). */
const ROW: CreditLoanSummary = {
  loan_id: 'a249ee86-b723-483a-bbba-1ad400cc5bdd',
  contract_number: 'FB-000074',
  product_code: 'CA_AB_PAYDAY',
  status: 'active',
  currency: 'CAD',
  principal_minor: 30_000,
  total_payable_minor: 34_200,
  delinquency_days: 0,
  client_email: 'info+fullpath-happy@loanbridge.ca',
  disbursed_at: '2026-08-31T18:27:54.336420+00:00',
  maturity_date: '2026-10-12',
  application_id: '62386a7c-c8e6-4668-a7da-fa120472bb38',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/credit/loans']}>
      <CreditLoansPage />
    </MemoryRouter>
  )
}

describe('CreditLoansPage → колонка «Видано»', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({ data: OVERVIEW, error: null } as ReturnType<
      typeof useCreditOverview
    >)
    vi.mocked(useCreditLoans).mockReturnValue({
      data: { items: [ROW], next_cursor: null, total: 1 },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditLoans>)
  })

  it('показывает дату выдачи из ответа модуля', async () => {
    renderPage()
    // i18n в тестах отдаёт голый ключ (src/test/setup.ts) — заголовок ищем по нему.
    expect(await screen.findByText('credit.columns.disbursed')).toBeInTheDocument()
    // Именно дата ВЫДАЧИ (31.08), а не срок погашения (12.10) в той же строке.
    expect(screen.getByText('31-08-2026')).toBeInTheDocument()
  })

  it('сортирует ПО СЕРВЕРУ: клик уходит в запрос ключом disbursed_at', async () => {
    renderPage()
    fireEvent.click(await screen.findByText('credit.columns.disbursed'))
    await waitFor(() => {
      expect(vi.mocked(useCreditLoans)).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'disbursed_at' })
      )
    })
    // Второй клик разворачивает порядок — тем же серверным ключом.
    fireEvent.click(screen.getByText('credit.columns.disbursed'))
    await waitFor(() => {
      expect(vi.mocked(useCreditLoans)).toHaveBeenCalledWith(
        expect.objectContaining({ sort: '-disbursed_at' })
      )
    })
  })
})
