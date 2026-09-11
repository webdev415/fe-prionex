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
import { CreditApiError } from '@/features/credit/api/creditApi'

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

describe('401 — это не «модуль не развёрнут»', () => {
  // Три состояния, которые легко свалить в одно и тем соврать оператору:
  // модуль не развёрнут (маршрута нет), модуль требует ключ (401), модуль
  // работает. При 401 модуль ЖИВ и отвечает — отправлять человека искать
  // аварию значит тратить его час на исправное.
  const UNAUTHORIZED = new CreditApiError('Invalid X-Internal-Api-Key', 401, 'unauthorized')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({
      ...idle,
      error: UNAUTHORIZED,
    } as unknown as ReturnType<typeof useCreditOverview>)
    vi.mocked(useCreditLoans).mockReturnValue({ ...idle, error: UNAUTHORIZED } as never)
  })

  it('пропуск не принят — объясняет вход, а не предлагает служебный ключ', () => {
    // Здесь раньше показывалось поле для служебного ключа. Ключа у браузера
    // больше нет вовсе: модуль проверяет пропуск оператора у самой CRM.
    // Предлагать поле было бы предложением того, чего не существует, — а
    // человеку надо объяснить, почему его не пустили.
    render(
      <MemoryRouter>
        <CreditLoansPage />
      </MemoryRouter>
    )
    // Точное совпадение, не подстрока: ключ подсказки начинается так же,
    // и регулярка нашла бы оба узла.
    expect(screen.getByText('credit.access.notAuthenticated')).toBeInTheDocument()
    // Про сам ключ здесь больше не утверждаем: панели и её строк в проекте
    // нет, проверка не смогла бы покраснеть ни при каком коде. Настоящий
    // страж — `features/credit/api/__tests__/credentials.test.ts`: он ловит
    // и возврат заголовка, и ключ, забытый в хранилище.
    expect(screen.queryByText(/unavailable\.title/)).not.toBeInTheDocument()
  })

  it('прав не хватило — называет самую частую причину: не тот проект', () => {
    // 403 отличается от 401 по смыслу: пропуск ПРИНЯЛИ, прав не нашлось.
    // Кредитные права заведены в одном проекте, и оператор другого принесёт
    // права, среди которых кредитных нет. Сообщение «нет права
    // credit.applications.read» читается как «вам не выдали», хотя причина —
    // выбран не тот проект. Раньше 403 попадал в общую ветку «модуль не
    // развёрнут» и отправлял человека искать несуществующую аварию.
    const FORBIDDEN = new CreditApiError('forbidden', 403, 'forbidden')
    vi.mocked(useCreditOverview).mockReturnValue({
      ...idle,
      error: FORBIDDEN,
    } as unknown as ReturnType<typeof useCreditOverview>)
    vi.mocked(useCreditLoans).mockReturnValue({ ...idle, error: FORBIDDEN } as never)

    render(
      <MemoryRouter>
        <CreditLoansPage />
      </MemoryRouter>
    )
    expect(screen.getByText('credit.access.noRights')).toBeInTheDocument()
    expect(screen.queryByText(/unavailable\.title/)).not.toBeInTheDocument()
  })
})
