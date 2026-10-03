/**
 * Ручное решение андеррайтера под боевым правилом повтора мутаций (18-13d-a2, Ф-6).
 *
 * `main.tsx` повторяет один раз любую мутацию при сетевом отказе без ответа, в
 * том числе `CreditApiError` с `transportCode` (Ф-5). Ключ идемпотентности
 * ручного решения минтится в `creditApi.decide` на каждый вызов, значит
 * автоповтор ушёл бы с НОВЫМ ключом: модуль, принявший первое решение, чей ответ
 * потерялся, записал бы второе. Поэтому `useCreditManualDecision` не повторяется
 * (`retry: false`), а контрольная сцена — та же мутация без этой опции под тем же
 * `QueryClient` — показывает, что сцена отличает правку от её отсутствия.
 *
 * Предикат повтора — копия `main.tsx` из `@/test/mutationRetry` (её страж — в
 * сценах постбеков).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { useCreditManualDecision } from '../hooks/useCredit'
import { creditApi, toCreditError } from '../api/creditApi'
import type { ManualDecisionPayload } from '../api/types'
import { isMutationRetryable } from '@/test/mutationRetry'

vi.mock('../api/creditApi', async () => {
  // `toCreditError` и `CreditApiError` — НАСТОЯЩИЕ: отказ собирается тем же путём,
  // что у транспорта раздела.
  const actual = await vi.importActual<typeof import('../api/creditApi')>('../api/creditApi')
  return { ...actual, creditApi: { decide: vi.fn() } }
})

const decide = vi.mocked(creditApi.decide)

const APPLICATION = '6a547e31-ba5e-4723-a2ea-ea55c8ef5197'
const PAYLOAD: ManualDecisionPayload = { outcome: 'approved', rationale: 'r' }

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Сетевой отказ без ответа — так его отдаёт транспорт раздела. */
const networkError = () => toCreditError(new AxiosError('Network Error', 'ERR_NETWORK'))

beforeEach(() => {
  vi.clearAllMocks()
  // Повтор мутаций — боевой (`defaultOptions.mutations.retry` из `main.tsx`).
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: {
        retry: (failureCount, error) => failureCount < 1 && isMutationRetryable(error),
        retryDelay: 0,
      },
    },
  })
})

describe('useCreditManualDecision — боевой повтор мутаций (Ф-6)', () => {
  it('сетевой отказ без ответа — решение не повторяется: decide ровно один раз, мутация в ошибке', async () => {
    const error = networkError()
    expect(error.transportCode).toBe('ERR_NETWORK')
    expect(error).not.toHaveProperty('response')
    expect(isMutationRetryable(error), 'the global rule would not retry this refusal').toBe(true)
    decide.mockRejectedValue(error)
    const { result } = renderHook(() => useCreditManualDecision(APPLICATION), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(PAYLOAD).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(error)
    expect(
      decide,
      'the decision was retried with a fresh idempotency key — the module could record it twice'
    ).toHaveBeenCalledTimes(1)
  })

  it('контроль: та же мутация без retry: false под тем же QueryClient — повтор уходит', async () => {
    decide.mockRejectedValue(networkError())
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: (payload: ManualDecisionPayload) => creditApi.decide(APPLICATION, payload),
        }),
      { wrapper }
    )

    await act(async () => {
      await result.current.mutateAsync(PAYLOAD).catch(() => undefined)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(
      decide,
      'the QueryClient does not retry — the first scene proves nothing'
    ).toHaveBeenCalledTimes(2)
  })
})
