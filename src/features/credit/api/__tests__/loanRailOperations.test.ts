/**
 * Дверь операций рельса кредита: путь запроса, ключ кэша и хук (story 17-6f,
 * AC-2 п. 1, 6, 7).
 *
 * Форма — `loanJournal.test.ts`: запрос проверяется ПЕРЕХВАЧЕННЫМ, ключ — по
 * настоящему реестру `creditKeys`. Страничный тест подменяет `useCredit`
 * целиком, и утверждение о ключе там было бы утверждением о моке.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { creditApi, creditHttp, CreditApiError } from '../creditApi'
import { creditKeys, useCreditLoanRailOperations } from '@/features/credit/hooks/useCredit'

type Seen = { configs: InternalAxiosRequestConfig[] }

/** Пустая страница двери в форме контракта: все операции, курсора нет. */
const EMPTY_PAGE = { items: [], total: 0, next_cursor: null }

/** Свой адаптер вместо сети; со `status` ≥ 400 — отказ в форме axios. */
function intercept(status = 200): { seen: Seen; restore: () => void } {
  const seen: Seen = { configs: [] }
  const previous = creditHttp.defaults.adapter
  const adapter: AxiosAdapter = async (config) => {
    seen.configs.push(config)
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        config,
        response: { status, data: {}, statusText: '', headers: {}, config },
      })
    }
    return { data: EMPTY_PAGE, status: 200, statusText: 'OK', headers: {}, config }
  }
  creditHttp.defaults.adapter = adapter
  return {
    seen,
    restore: () => {
      creditHttp.defaults.adapter = previous
    },
  }
}

describe('creditApi.loanRailOperations — путь двери', () => {
  let harness: ReturnType<typeof intercept>

  beforeEach(() => {
    harness = intercept()
  })
  afterEach(() => harness.restore())

  it('AC-2 п. 1 GET /api/v1/credit/loans/L/rail-operations без параметров', async () => {
    await creditApi.loanRailOperations('L')
    const config = harness.seen.configs[0]
    expect(config, 'адаптер не получил запрос — проверять нечего').toBeDefined()
    expect(config.method).toBe('get')
    expect(config.url).toBe('/api/v1/credit/loans/L/rail-operations')
    // Дверь отдаёт все операции одной страницей: ни `limit`, ни `cursor`.
    const params = (config.params ?? {}) as Record<string, unknown>
    expect(params).toStrictEqual({})
  })

  it('положительный контроль перехвата: ответ двери доезжает целиком', async () => {
    await expect(creditApi.loanRailOperations('L')).resolves.toStrictEqual(EMPTY_PAGE)
  })
})

describe('creditKeys.loanRailOperations — ключ под кредитами (AC-2 п. 7)', () => {
  it('начинается с creditKeys.loans() — инвалидация кредитов достаёт и операции', () => {
    const key = creditKeys.loanRailOperations('L1')
    const prefix = creditKeys.loans()
    expect(key.slice(0, prefix.length)).toEqual([...prefix])
    expect(key.length, 'ключ не длиннее корня — операций в нём нет').toBeGreaterThan(prefix.length)
  })

  it('несёт id кредита и отличается от ключа другого кредита и от состояния', () => {
    const key = creditKeys.loanRailOperations('L1')
    expect(key).toContain('L1')
    expect(key).not.toEqual(creditKeys.loanRailOperations('L2'))
    expect(key).not.toEqual(creditKeys.loanState('L1'))
  })
})

/**
 * Хук НАСТОЯЩИЙ: живой `QueryClient`, настоящие `creditKeys` и `creditApi`,
 * сеть подменена адаптером. `retry: 3` у клиента — то, что сделало бы
 * глобальное правило с `CreditApiError`; без него «один запрос» не отличал бы
 * `retry: false` хука от умолчания.
 */
describe('useCreditLoanRailOperations — отказ не повторяется (AC-2 п. 6)', () => {
  function mount(status: number) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 0 } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const harness = intercept(status)
    const view = renderHook(() => useCreditLoanRailOperations('L1'), { wrapper })
    return {
      harness,
      view,
      client,
      cleanup: () => {
        view.unmount()
        client.clear()
        harness.restore()
      },
    }
  }

  it('503 двери → ровно один запрос к моменту isError', async () => {
    const { harness, view, cleanup } = mount(503)
    try {
      await waitFor(() => expect(view.result.current.isError).toBe(true))
      const { error } = view.result.current
      expect(error).toBeInstanceOf(CreditApiError)
      expect((error as CreditApiError).status).toBe(503)
      expect(
        harness.seen.configs,
        'a refused rail-operations read was sent more than once — retry: false is gone'
      ).toHaveLength(1)
    } finally {
      cleanup()
    }
  })

  it('ответ ложится под ключ этого кредита', async () => {
    const { client, harness, view, cleanup } = mount(200)
    try {
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
      expect(harness.seen.configs[0].url).toBe('/api/v1/credit/loans/L1/rail-operations')
      const cached = client
        .getQueryCache()
        .find({ queryKey: creditKeys.loanRailOperations('L1'), exact: true })
      expect(cached?.state.data).toStrictEqual(EMPTY_PAGE)
    } finally {
      cleanup()
    }
  })
})
