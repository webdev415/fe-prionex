/**
 * Ключ идемпотентности переключения рубильника.
 *
 * Проверяется ровно одно, зато то, ради чего ключ вообще существует: он живёт
 * на ОДНО действие пользователя. Раньше он минтился на каждый вызов, и защита
 * от повтора не работала ни разу — сеть моргнула на ответе, человек нажал ещё
 * раз, и в append-only историю (она же весь наш аудит рубильников) уходила
 * вторая запись о переключении, которого не было.
 *
 * Ключ здесь не сравнивается с образцом: важно не его содержимое, а то,
 * совпадает ли он у повтора и различается ли у нового действия.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSetCreditSwitch } from '../hooks/useCredit'
import { creditApi } from '../api/creditApi'

vi.mock('../api/creditApi', async () => {
  // `newIdempotencyKey` берём НАСТОЯЩИЙ: подменённый генератор проверял бы
  // мок, а не то, что ключ переиспользуется.
  const actual = await vi.importActual<typeof import('../api/creditApi')>('../api/creditApi')
  return { ...actual, creditApi: { setSwitch: vi.fn() } }
})

const setSwitch = vi.mocked(creditApi.setSwitch)

const STATE = {
  switches: { applications_intake: false, client_cabinet: true, crm_section: true },
  history: [],
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Ключ, с которым ушёл n-й вызов (третий аргумент клиента). */
const keyOfCall = (n: number) => setSwitch.mock.calls[n][2]

const OFF = {
  name: 'applications_intake' as const,
  payload: { enabled: false, reason: 'сверка тарифа' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSetCreditSwitch — ключ идемпотентности', () => {
  it('повтор после сетевого отказа несёт ТОТ ЖЕ ключ', async () => {
    setSwitch.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(STATE)
    const { result } = renderHook(() => useSetCreditSwitch(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(OFF).catch(() => undefined)
    })
    await act(async () => {
      await result.current.mutateAsync(OFF)
    })

    expect(setSwitch).toHaveBeenCalledTimes(2)
    // Один и тот же ключ — модуль отдаст сохранённый ответ первого выполнения
    // и НЕ припишет в историю вторую строку.
    expect(keyOfCall(1)).toBe(keyOfCall(0))
  })

  it('после успеха такое же переключение — уже другое действие и другой ключ', async () => {
    // Иначе «выключил → включил → снова выключил с той же причиной» получил бы
    // реплей прошлого ответа, и рубильник залип бы на экране.
    setSwitch.mockResolvedValue(STATE)
    const { result } = renderHook(() => useSetCreditSwitch(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(OFF)
    })
    await act(async () => {
      await result.current.mutateAsync(OFF)
    })

    expect(keyOfCall(1)).not.toBe(keyOfCall(0))
  })

  it('изменилась причина — это другое действие, ключ обязан быть другим', async () => {
    // Тот же ключ с другим телом модуль отвергает 409 `idempotency_key_reused`:
    // ответ по нему подтвердил бы не то, что просили.
    setSwitch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useSetCreditSwitch(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(OFF).catch(() => undefined)
    })
    await act(async () => {
      await result.current
        .mutateAsync({ ...OFF, payload: { enabled: false, reason: 'другая причина' } })
        .catch(() => undefined)
    })

    expect(keyOfCall(1)).not.toBe(keyOfCall(0))
  })

  it('ключ не совпадает у разных рубильников', async () => {
    setSwitch.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useSetCreditSwitch(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(OFF).catch(() => undefined)
    })
    await act(async () => {
      await result.current
        .mutateAsync({ name: 'crm_section', payload: { enabled: false, reason: 'сверка тарифа' } })
        .catch(() => undefined)
    })

    expect(keyOfCall(1)).not.toBe(keyOfCall(0))
  })
})
