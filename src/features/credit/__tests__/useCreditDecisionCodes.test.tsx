/**
 * Запрос справочника кодов решения.
 *
 * Четыре обещания хука: без права запрос не уходит (дверь ответила бы 403), с
 * правом — один запрос и индекс вместо сырого ответа, сбой модуля даёт ошибку
 * сразу, без повторов (форма показывает плашку с «Повторити», а не висит), а
 * перезапрос с тем же содержимым оставляет прежний индекс.
 *
 * Клиент запросов здесь — с повторами ПО УМОЛЧАНИЮ библиотеки: иначе сцена
 * H-3 проверяла бы настройку теста, а не `retry: false` самого хука.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { creditKeys, useCreditDecisionCodes } from '../hooks/useCredit'
import { creditApi } from '../api/creditApi'
import { DECISION_CODES_FIXTURE } from '../api/__tests__/decisionCodesFixture'

vi.mock('../api/creditApi', async () => {
  const actual = await vi.importActual<typeof import('../api/creditApi')>('../api/creditApi')
  return { ...actual, creditApi: { decisionCodes: vi.fn() } }
})

const decisionCodes = vi.mocked(creditApi.decisionCodes)

// Клиент — на сцену, а не на рендер обёртки: иначе кэш запроса жил бы ровно
// до первого перерисовывания.
let client: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** Дать запросу шанс уйти: «не вызван» сразу после рендера ничего не доказывает. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient()
})

describe('useCreditDecisionCodes', () => {
  it('H-1: без права запрос не уходит', async () => {
    decisionCodes.mockResolvedValue(DECISION_CODES_FIXTURE)
    const { result } = renderHook(() => useCreditDecisionCodes(false), { wrapper })

    await settle()

    expect(
      decisionCodes,
      'the directory was requested without credit.decisions.decide — the door answers 403'
    ).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('H-2: с правом — один запрос, и в data индекс, а не сырой ответ', async () => {
    decisionCodes.mockResolvedValue(DECISION_CODES_FIXTURE)
    const { result } = renderHook(() => useCreditDecisionCodes(true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(decisionCodes).toHaveBeenCalledTimes(1)
    expect(result.current.data?.version).toBe('book@1')
    expect(
      result.current.data?.byId,
      'the hook returned the raw registry instead of the index'
    ).toBeInstanceOf(Map)
    expect(result.current.data?.byId.get('AB-O-13')?.id).toBe('AB-O-13')
  })

  it('H-3: сбой модуля — ошибка сразу, без повторов', async () => {
    decisionCodes.mockRejectedValue(new Error('Синтетичний збій модуля'))
    const { result } = renderHook(() => useCreditDecisionCodes(true), { wrapper })

    await waitFor(() =>
      expect(
        result.current.isError,
        'the directory request did not fail at once — it is retried behind the operator'
      ).toBe(true)
    )
    await settle()

    expect(decisionCodes, 'a failed directory request was retried').toHaveBeenCalledTimes(1)
  })

  it('H-4: перезапрос с тем же содержимым — тот же индекс, с новым содержимым — новый', async () => {
    // Индекс кэшируется по объекту ответа; стабильность между перезапросами
    // держит React Query: одинаковый ответ он оставляет прежним объектом
    // `data` (structural sharing — чистая функция над JSON, от среды не зависит).
    //
    // Сравнение идёт по результату самого `refetch()`, а не по кадру хука:
    // наблюдатель отдаёт его, уже приняв ответ и пересчитав `select`. Кадр
    // хука перерисовывается позже, отдельным уведомлением, и «тот же индекс»
    // в старом кадре был бы правдой ни о чём. Кадр ждём только там, где он
    // обязан смениться, — и ждём состояние, а не тик.
    const key = creditKeys.decisionCodes()
    decisionCodes.mockResolvedValue(DECISION_CODES_FIXTURE)
    const { result } = renderHook(() => useCreditDecisionCodes(true), { wrapper })
    type Refetched = Awaited<ReturnType<typeof result.current.refetch>>
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const first = result.current.data
    expect(first?.version).toBe('book@1')

    decisionCodes.mockResolvedValue(
      JSON.parse(JSON.stringify(DECISION_CODES_FIXTURE)) as typeof DECISION_CODES_FIXTURE
    )
    let same: Refetched | undefined
    await act(async () => {
      same = await result.current.refetch()
    })
    // Второй ответ действительно принят, а не пропущен: иначе «тот же индекс»
    // ничего бы не доказывал.
    expect(decisionCodes).toHaveBeenCalledTimes(2)
    expect(client.getQueryState(key)?.dataUpdateCount).toBe(2)
    expect(
      client.getQueryData(key),
      'a same-content re-fetch replaced the registry object in the cache — structural sharing is off'
    ).toBe(DECISION_CODES_FIXTURE)
    expect(
      same?.data,
      'a re-fetch with the same registry content rebuilt the index — the form would reset its derived state'
    ).toBe(first)

    const NEW_TEXT = 'Синтетичний текст другої версії реєстру'
    decisionCodes.mockResolvedValue({
      version: 'book@2',
      codes: DECISION_CODES_FIXTURE.codes.map((entry) =>
        entry.id === 'AB-O-13' ? { ...entry, ru: NEW_TEXT } : entry
      ),
    })
    let bumped: Refetched | undefined
    await act(async () => {
      bumped = await result.current.refetch()
    })
    expect(decisionCodes).toHaveBeenCalledTimes(3)
    expect(bumped?.data, 'a new registry version kept the old index').not.toBe(first)
    expect(bumped?.data?.version).toBe('book@2')
    expect(
      bumped?.data?.byId.get('AB-O-13')?.ru,
      'a new registry version is shown with the text of the old one'
    ).toBe(NEW_TEXT)
    await waitFor(() =>
      expect(
        result.current.data,
        'the hook never rendered the index of the new registry version'
      ).toBe(bumped?.data)
    )
  })
})
