/**
 * Подтверждение условного одобрения (19-5f): ключ идемпотентности и сброс кэша.
 *
 * Ключ живёт на ДЕЙСТВИЕ (подпись — `proposal_decision_id`), а не на вызов.
 * Исход не определён — сетевой сбой без ответа, `5xx`, `408`, `429`: договор мог
 * уже выйти, повтор идёт с тем же ключом, модуль отдаёт реплей и не выпускает
 * второй договор. Определённый отказ `4xx` (кроме `408`/`429`) и успех действие
 * завершают — следующий вызов с новым ключом. После успеха сбрасываются
 * карточка, списки, сводка и очередь — префиксом `creditKeys.queues()` всех
 * статусов: ключ очереди не лежит под списками заявок.
 *
 * Ключ не сравнивается с образцом: важно, совпадает ли он у повтора и
 * различается ли у нового действия.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  creditKeys,
  useCreditConfirmConditional,
  useCreditManualDecision,
} from '../hooks/useCredit'
import { CreditApiError, creditApi } from '../api/creditApi'
import type { CreditDecision } from '../api/types'

vi.mock('../api/creditApi', async () => {
  // `newIdempotencyKey` и `CreditApiError` — НАСТОЯЩИЕ: подменённый генератор
  // проверял бы мок, а не то, что ключ переиспользуется.
  const actual = await vi.importActual<typeof import('../api/creditApi')>('../api/creditApi')
  return { ...actual, creditApi: { confirmConditional: vi.fn(), decide: vi.fn() } }
})

const confirmConditional = vi.mocked(creditApi.confirmConditional)
const decide = vi.mocked(creditApi.decide)

const APPLICATION = '6a547e31-ba5e-4723-a2ea-ea55c8ef5197'
const PROPOSAL = 'd2d2d2d2-2222-4222-8222-222222222222'
const OTHER_PROPOSAL = 'd3d3d3d3-3333-4333-8333-333333333333'
const DECISION = { decision_id: 'd4d4d4d4-4444-4444-8444-444444444444' } as CreditDecision

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Ключ, с которым ушёл n-й вызов (третий аргумент клиента). */
const keyOfCall = (n: number) => confirmConditional.mock.calls[n][2]

/** Ключи кэша, которые сбросил хук, — как массивы. */
const invalidated = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey)

/**
 * Очередь в кэше — настоящими ключами `creditKeys.queue` (без статуса и со
 * статусами двери). Проверяется не литерал префикса, а то, что сброс достал
 * КАЖДЫЙ из них: ключ статуса, собранный мимо `queues()`, остался бы свежим.
 */
const QUEUE_KEYS = [undefined, 'pending', 'in_review', 'done'].map((status) =>
  creditKeys.queue(status)
)
const seedQueues = () => QUEUE_KEYS.forEach((key) => queryClient.setQueryData(key, []))
const staleQueues = () =>
  QUEUE_KEYS.filter((key) => !queryClient.getQueryState(key)?.isInvalidated).map((key) =>
    key.join('/')
  )

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

describe('useCreditConfirmConditional', () => {
  it('H-5: успех — один вызов с proposal_decision_id и ключом; сброшены карточка, списки, сводка и префикс очереди', async () => {
    confirmConditional.mockResolvedValue(DECISION)
    seedQueues()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCreditConfirmConditional(APPLICATION), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL })
    })

    expect(confirmConditional).toHaveBeenCalledTimes(1)
    const [applicationId, payload, key] = confirmConditional.mock.calls[0]
    expect(applicationId).toBe(APPLICATION)
    expect(payload, 'the confirmation body carries more than the proposal id').toEqual({
      proposal_decision_id: PROPOSAL,
    })
    expect(key, 'the confirmation left without an idempotency key').toEqual(expect.any(String))
    expect(key).not.toBe('')
    const keys = invalidated(spy)
    expect(keys).toContainEqual(['credit', 'applications', 'detail', APPLICATION])
    expect(keys).toContainEqual(['credit', 'applications'])
    expect(keys).toContainEqual(['credit', 'overview'])
    expect(
      keys,
      'the queue is not reset — the «awaiting confirmation» badge stays until staleTime'
    ).toContainEqual(creditKeys.queues())
    expect(staleQueues(), 'a queue status was left fresh after the confirmation').toEqual([])
  })

  it('H-6: сетевой сбой без ответа — повтор несёт ТОТ ЖЕ ключ', async () => {
    confirmConditional
      .mockRejectedValueOnce(new CreditApiError('Network Error'))
      .mockResolvedValueOnce(DECISION)
    const { result } = renderHook(() => useCreditConfirmConditional(APPLICATION), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL }).catch(() => undefined)
    })
    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL })
    })

    expect(confirmConditional).toHaveBeenCalledTimes(2)
    expect(
      keyOfCall(1),
      'a retry after a network failure got a new key — the module would issue a second agreement'
    ).toBe(keyOfCall(0))
  })

  it('H-7: ответ 409 — повтор с НОВЫМ ключом; после успеха следующий вызов — тоже новый', async () => {
    confirmConditional
      .mockRejectedValueOnce(new CreditApiError('Синтетичний відказ', 409, 'invalid_state'))
      .mockResolvedValueOnce(DECISION)
      .mockResolvedValueOnce(DECISION)
    const { result } = renderHook(() => useCreditConfirmConditional(APPLICATION), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL }).catch(() => undefined)
    })
    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL })
    })
    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL })
    })

    expect(
      keyOfCall(1),
      'a retry after a server answer kept the key — the module would replay the refusal'
    ).not.toBe(keyOfCall(0))
    expect(
      keyOfCall(2),
      'the key outlived a success — the next action would get the replay'
    ).not.toBe(keyOfCall(1))
  })

  it.each([502, 503, 408, 429])(
    'H-10: ответ %i — исход не определён, повтор несёт ТОТ ЖЕ ключ',
    async (status) => {
      confirmConditional
        .mockRejectedValueOnce(new CreditApiError('Синтетичний збій', status))
        .mockResolvedValueOnce(DECISION)
      const { result } = renderHook(() => useCreditConfirmConditional(APPLICATION), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ proposal_decision_id: PROPOSAL }).catch(() => undefined)
      })
      await act(async () => {
        await result.current.mutateAsync({ proposal_decision_id: PROPOSAL })
      })

      expect(confirmConditional).toHaveBeenCalledTimes(2)
      expect(
        keyOfCall(1),
        `after ${status} the retry left with a new key — the agreement may already exist, the module would issue a second one`
      ).toBe(keyOfCall(0))
    }
  )

  it.each([400, 403, 404, 409, 422])(
    'H-11: ответ %i — отказ определён, повтор с НОВЫМ ключом',
    async (status) => {
      confirmConditional
        .mockRejectedValueOnce(new CreditApiError('Синтетичний відказ', status, 'synthetic'))
        .mockResolvedValueOnce(DECISION)
      const { result } = renderHook(() => useCreditConfirmConditional(APPLICATION), { wrapper })

      await act(async () => {
        await result.current.mutateAsync({ proposal_decision_id: PROPOSAL }).catch(() => undefined)
      })
      await act(async () => {
        await result.current.mutateAsync({ proposal_decision_id: PROPOSAL })
      })

      expect(
        keyOfCall(1),
        `after ${status} the retry kept the key — the module would replay the refusal`
      ).not.toBe(keyOfCall(0))
    }
  )

  it('H-8: другое предложение — другое действие и другой ключ', async () => {
    confirmConditional.mockRejectedValue(new CreditApiError('Network Error'))
    const { result } = renderHook(() => useCreditConfirmConditional(APPLICATION), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ proposal_decision_id: PROPOSAL }).catch(() => undefined)
    })
    await act(async () => {
      await result.current
        .mutateAsync({ proposal_decision_id: OTHER_PROPOSAL })
        .catch(() => undefined)
    })

    expect(keyOfCall(1), 'two proposals share one idempotency key').not.toBe(keyOfCall(0))
  })
})

describe('useCreditManualDecision', () => {
  it('H-9: успех — прежние три ключа и префикс очереди', async () => {
    decide.mockResolvedValue(DECISION)
    seedQueues()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCreditManualDecision(APPLICATION), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ outcome: 'referred', rationale: 'r' })
    })

    const keys = invalidated(spy)
    expect(keys).toContainEqual(['credit', 'applications', 'detail', APPLICATION])
    expect(keys).toContainEqual(['credit', 'applications'])
    expect(keys).toContainEqual(['credit', 'overview'])
    expect(keys, 'a conditional proposal does not reach the queue until staleTime').toContainEqual(
      creditKeys.queues()
    )
    expect(staleQueues(), 'a queue status was left fresh after the decision').toEqual([])
  })
})
