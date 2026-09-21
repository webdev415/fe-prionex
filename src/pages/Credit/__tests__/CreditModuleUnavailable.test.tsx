/**
 * Экран «сервис кредитов не отвечает» — знак `T-FE-2-04`.
 *
 * Раздел виден в меню всем, а сервис кредитов может не ответить. Тест держит
 * три РАЗНЫЕ ветки экрана, которые легко свести в одну и тем соврать оператору:
 *  - 401 — пропуск не приняли: объясняем вход, служебный ключ не предлагаем;
 *  - 403 — пропуск приняли, прав не хватило: называем того, кто права выдаёт;
 *  - всё остальное — модуль не ответил: общий экран и техническая причина,
 *    которую подсказка обещает показать ниже.
 *
 * Утверждений о том, ГДЕ живёт модуль и каким кодом отвечает шлюз, здесь
 * больше нет намеренно: они устаревают быстрее, чем их правят (REQ-FE-2-02).
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
])('T-FE-2-04 %s: модуль не ответил', (_name, Page, listHook) => {
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

describe('T-FE-2-04: 401 — это не «модуль не ответил»', () => {
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
    // Вторая строка пары. До этой единицы подсказка не проверялась ни разу:
    // экран мог потерять её молча, и 401 остался бы без «что делать».
    expect(screen.getByText('credit.access.notAuthenticatedHint')).toBeInTheDocument()
    // Про сам ключ здесь больше не утверждаем: панели и её строк в проекте
    // нет, проверка не смогла бы покраснеть ни при каком коде. Настоящий
    // страж — `features/credit/api/__tests__/credentials.test.ts`: он ловит
    // и возврат заголовка, и ключ, забытый в хранилище.
    expect(screen.queryByText(/unavailable\.title/)).not.toBeInTheDocument()
  })

  it('прав не хватило — называет того, кто выдаёт права', () => {
    // 403 отличается от 401 по смыслу: пропуск ПРИНЯЛИ, прав не нашлось.
    // Экран называет не проект, а того, кто права выдаёт: причина «не тот
    // проект» со стороны фронта недоказуема — карты проектов модуля он не
    // знает. Сообщение «нет права credit.applications.read» читается как «вам
    // не выдали» и не говорит, к кому идти. Раньше 403 попадал в общую ветку
    // «модуль не ответил» и отправлял человека искать несуществующую аварию.
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
    // Вторая строка пары: подсказка 403 обязана отличаться от подсказки 401 —
    // слияние ветвей увело бы оператора не туда, и раньше это не краснило.
    expect(screen.getByText('credit.access.noRightsHint')).toBeInTheDocument()
    expect(screen.queryByText(/unavailable\.title/)).not.toBeInTheDocument()
  })
})

describe('T-FE-2-04: ошибка модуля, которая не про доступ', () => {
  // Различающий случай: status ОПРЕДЕЛЁН и не равен 401/403. Экран доступа
  // здесь был бы ложью — прав хватает, не ответил модуль. Плоский `new Error`
  // этого не различает (у него `status === undefined`), поэтому первым идёт
  // `CreditApiError`: подмена условия на `status !== undefined` обязана краснеть.
  //
  // Остальные три случая — про обещание подсказки «технічну причину показано
  // нижче». Оно обязано держаться и на ошибке без статуса, и на 404 шлюза с
  // чужим телом, и на ошибке с пустым сообщением: раньше последняя рисовала
  // пустую красную полосу, а не-Error — один прочерк.
  const renderWithError = (error: unknown) => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({ ...idle, error } as never)
    vi.mocked(useCreditLoans).mockReturnValue({ ...idle, error } as never)
    render(
      <MemoryRouter>
        <CreditLoansPage />
      </MemoryRouter>
    )
  }

  const expectGeneralScreen = () => {
    expect(screen.getByText('credit.unavailable.title')).toBeInTheDocument()
    expect(screen.getByText('credit.unavailable.hint')).toBeInTheDocument()
    expect(screen.queryByText(/credit\.access\./)).not.toBeInTheDocument()
    // Обещанная причина обязана быть непустой: «—» означает, что подсказка
    // обещала строку, которой на экране нет.
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  }

  it('различающий случай 5xx: общий экран, статус и сообщение', () => {
    renderWithError(new CreditApiError('boom', 500, 'internal_error'))
    expectGeneralScreen()
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
  })

  it('ошибка без статуса (сетевой обрыв): экран тот же, причина названа', () => {
    renderWithError(new Error('Network Error'))
    expectGeneralScreen()
    expect(screen.getByText(/Network Error/)).toBeInTheDocument()
  })

  it('404 шлюза с чужим телом: статус попадает в причину', () => {
    // Тело шлюза приходит в формате, которого модуль не отдаёт, и разобрать
    // его как ошибку модуля нечем — остаётся показать код.
    renderWithError(new CreditApiError('Request failed with status code 404', 404))
    expectGeneralScreen()
    expect(screen.getByText(/HTTP 404/)).toBeInTheDocument()
  })

  it('ошибка с пустым сообщением: вместо пустой полосы — статус и код', () => {
    renderWithError(new CreditApiError('', 503, 'service_unavailable'))
    expectGeneralScreen()
    expect(screen.getByText(/HTTP 503/)).toBeInTheDocument()
    expect(screen.getByText(/service_unavailable/)).toBeInTheDocument()
  })
})
