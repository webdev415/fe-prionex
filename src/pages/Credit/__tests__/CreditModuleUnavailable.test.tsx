/**
 * Раздел на стенде, где модуля нет.
 *
 * На dev-сервере фронт — статика за nginx, и весь `/api/` уходит в Kong;
 * маршрута `/api/v1/credit` там нет. Проверено вызовом: Kong отвечает 404 с
 * телом `{"message":"no Route matched with those values"}`. Формат чужой —
 * `detail`/`title` в нём нет, поэтому в Alert попадала строка axios «Request
 * failed with status code 404». Раздел виден в меню всем, так что первый же
 * сотрудник получал бы техническую ошибку вместо объяснения.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditLoansPage } from '../CreditLoansPage'
import { CreditApplicationsPage } from '../CreditApplicationsPage'
import {
  useCreditOverview,
  useCreditLoans,
  useCreditApplications,
} from '@/features/credit/hooks/useCredit'

vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditLoans: vi.fn(),
  useCreditApplications: vi.fn(),
}))

const KONG_404 = new Error('Request failed with status code 404')
const idle = { data: undefined, isLoading: false, error: null, refetch: vi.fn() }

describe.each([
  ['кредиты', CreditLoansPage, useCreditLoans],
  ['заявки', CreditApplicationsPage, useCreditApplications],
])('%s: модуль не развёрнут', (_name, Page, listHook) => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({
      ...idle,
      error: KONG_404,
    } as unknown as ReturnType<typeof useCreditOverview>)
    vi.mocked(listHook).mockReturnValue({ ...idle, error: KONG_404 } as never)
  })

  it('объясняет причину вместо технической ошибки', () => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    )
    expect(screen.getByText(/credit\.unavailable\.title/)).toBeInTheDocument()
    expect(screen.getByText(/credit\.unavailable\.hint/)).toBeInTheDocument()
    // Таблицы быть не должно: строить её не из чего, а пустая таблица со
    // словами «Кредитів немає» — прямая ложь, кредиты есть, их не видно.
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/credit\.loans\.empty|credit\.applications\.empty/)).toBeNull()
  })

  it('оставляет техническую причину для разработчика', () => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    )
    expect(screen.getByText(/status code 404/)).toBeInTheDocument()
  })
})
