/**
 * Запрос справочника кодов решения.
 *
 * Три обещания хука: без права запрос не уходит (дверь ответила бы 403), с
 * правом — один запрос и индекс вместо сырого ответа, а сбой модуля даёт ошибку
 * сразу, без повторов: форма показывает плашку с «Повторити», а не висит.
 *
 * Клиент запросов здесь — с повторами ПО УМОЛЧАНИЮ библиотеки: иначе сцена
 * H-3 проверяла бы настройку теста, а не `retry: false` самого хука.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCreditDecisionCodes } from '../hooks/useCredit'
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
})
