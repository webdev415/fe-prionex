/**
 * Рубильник раздела на маршрутах.
 *
 * Пункт меню исчезал, а прямая ссылка `/dashboard/credit/applications`
 * открывала выключенный раздел как ни в чём не бывало. Здесь проверяется, что
 * страница закрыта — и, не менее важно, что она НЕ закрывается от поломки
 * связи: пропавший раздел читается как авария CRM, а не как решение
 * риск-менеджера, и оператор пойдёт заводить задачу вместо того, чтобы
 * дождаться модуля.
 *
 * Хук `useCreditSectionEnabled` здесь НЕ подменён намеренно: подменив его, мы
 * проверяли бы мок, а не правило «скрываем только по явному false».
 * Подменяется транспорт — ровно то, что в бою и ломается.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreditSectionGate } from '../components/CreditSectionGate'
import { creditApi } from '@/features/credit/api/creditApi'

vi.mock('@/features/credit/api/creditApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/credit/api/creditApi')>(
      '@/features/credit/api/creditApi'
    )
  return { ...actual, creditApi: { switches: vi.fn() } }
})

const switches = vi.mocked(creditApi.switches)

const stateWith = (crmSection: boolean) => ({
  switches: { applications_intake: true, client_cabinet: true, crm_section: crmSection },
  history: [],
})

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditSectionGate>
        <div>содержимое раздела</div>
      </CreditSectionGate>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreditSectionGate', () => {
  it('рубильник выключен — вместо страницы объяснение, а содержимого нет', async () => {
    switches.mockResolvedValue(stateWith(false))
    renderGate()

    expect(await screen.findByText('credit.switches.sectionOff')).toBeInTheDocument()
    expect(screen.queryByText('содержимое раздела')).not.toBeInTheDocument()
  })

  it('рубильник включён — страница открыта', async () => {
    switches.mockResolvedValue(stateWith(true))
    renderGate()

    await waitFor(() => expect(switches).toHaveBeenCalled())
    expect(await screen.findByText('содержимое раздела')).toBeInTheDocument()
    expect(screen.queryByText('credit.switches.sectionOff')).not.toBeInTheDocument()
  })

  it('модуль недоступен — раздел ОСТАЁТСЯ: это поломка связи, а не решение риск-менеджера', async () => {
    switches.mockRejectedValue(new Error('network'))
    renderGate()

    await waitFor(() => expect(switches).toHaveBeenCalled())
    // Дождаться, пока запрос действительно провалится: до этого «остался» ещё
    // ничего не доказывает — раздел мог держаться на незавершённой загрузке.
    await act(async () => undefined)
    expect(screen.getByText('содержимое раздела')).toBeInTheDocument()
    expect(screen.queryByText('credit.switches.sectionOff')).not.toBeInTheDocument()
  })

  it('ответ ещё не пришёл — раздел работает, а не мигает заглушкой', () => {
    switches.mockReturnValue(new Promise(() => undefined))
    renderGate()

    expect(screen.getByText('содержимое раздела')).toBeInTheDocument()
    expect(screen.queryByText('credit.switches.sectionOff')).not.toBeInTheDocument()
  })
})
