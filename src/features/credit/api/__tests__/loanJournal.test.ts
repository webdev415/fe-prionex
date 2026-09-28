/**
 * Дверь журнала кредита: транспорт отбора, ключ кэша и хук — сцены A-1…A-5,
 * K-1…K-4, H-1…H-3 story 11-4b.
 *
 * Предмет — что именно уходит в запрос и какой ключ кэша этому запросу
 * соответствует. И то и другое проверяется по ПЕРЕХВАЧЕННОМУ запросу и по
 * настоящему реестру `creditKeys`, а не по чтению кода.
 *
 * ⚠️ Ключ кэша проверяется здесь, а не в тесте страницы: страничный тест
 * подменяет весь модуль `useCredit` целиком (`vi.mock`), вместе с реестром
 * `creditKeys`, — и утверждение о ключе там было бы утверждением о моке.
 *
 * ⚠️ «Параметр не отправлен» проверяется `toStrictEqual({})` и счётом ключей:
 * `toEqual` считает `{ bucket: undefined }` равным `{}` и отсутствующий ключ
 * от заданного `undefined` НЕ отличает.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { creditApi, creditHttp, CreditApiError } from '../creditApi'
import { creditKeys, useCreditLoanJournal } from '@/features/credit/hooks/useCredit'
import type { CreditJournalParams } from '../types'

type Seen = { configs: InternalAxiosRequestConfig[] }

/**
 * Перехват: свой адаптер вместо сети. По умолчанию — пустая страница журнала;
 * со `status` ≥ 400 — отказ в той форме, в какой его бросает axios (форма —
 * `clientLoans.test.ts`).
 */
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
    return {
      data: { items: [], next_cursor: null },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  creditHttp.defaults.adapter = adapter
  return {
    seen,
    restore: () => {
      creditHttp.defaults.adapter = previous
    },
  }
}

describe('creditApi.loanJournal — отбор уходит на сервер', () => {
  let harness: ReturnType<typeof intercept>

  beforeEach(() => {
    harness = intercept()
  })
  afterEach(() => harness.restore())

  it('A-1 несёт bucket в запросе', async () => {
    await creditApi.loanJournal('L1', { bucket: 'principal' })
    const config = harness.seen.configs[0]
    expect(config, 'адаптер не получил запрос — проверять нечего').toBeDefined()
    // Идентификатор кредита — в ПУТИ, отбор — параметром.
    expect(config.url).toBe('/api/v1/credit/loans/L1/journal')
    expect(config.params).toStrictEqual({ bucket: 'principal' })
  })

  it('A-2 несёт as_of в запросе', async () => {
    await creditApi.loanJournal('L1', { as_of: '2026-09-01' })
    const { params, url } = harness.seen.configs[0]
    expect(url).toBe('/api/v1/credit/loans/L1/journal')
    expect(params).toStrictEqual({ as_of: '2026-09-01' })
  })

  it('A-3 несёт оба параметра и ровно два', async () => {
    await creditApi.loanJournal('L1', { bucket: 'penalty', as_of: '2026-09-01' })
    const { params } = harness.seen.configs[0]
    expect(params).toStrictEqual({ bucket: 'penalty', as_of: '2026-09-01' })
    expect(Object.keys(params as Record<string, unknown>)).toHaveLength(2)
  })

  it('A-4 без параметров query ПУСТ — ни одного ключа, включая undefined', async () => {
    await creditApi.loanJournal('L1')
    await creditApi.loanJournal('L1', {})
    for (const config of harness.seen.configs) {
      const params = (config.params ?? {}) as Record<string, unknown>
      // `toStrictEqual`, а не `toEqual`: второй считает `{ bucket: undefined }`
      // пустым объектом и мутацию «класть ключ со значением undefined» пропустил бы.
      expect(params).toStrictEqual({})
      expect(Object.keys(params)).toHaveLength(0)
    }
    // Положительный контроль: перехват работает, запросы действительно дошли.
    expect(harness.seen.configs).toHaveLength(2)
  })

  it('A-5 limit и cursor не уходят никогда — двери их нет', async () => {
    await creditApi.loanJournal('L1', { bucket: 'fee' })
    const { params } = harness.seen.configs[0]
    expect(params).not.toHaveProperty('limit')
    expect(params).not.toHaveProperty('cursor')
    // Положительный контроль: сказано о НЕПУСТЫХ параметрах, а не о том,
    // что запрос ушёл без параметров вовсе.
    expect(params).toHaveProperty('bucket', 'fee')
  })

  it('положительный контроль перехвата: ответ двери доезжает целиком', async () => {
    // Без него пять сцен выше зеленели бы и на транспорте, который ничего не
    // возвращает: перехват отвечал бы, а разбор ответа был бы не проверен.
    await expect(creditApi.loanJournal('L1')).resolves.toStrictEqual({
      items: [],
      next_cursor: null,
    })
  })
})

describe('creditKeys.loanJournal — ключ кэша несёт отбор', () => {
  const base = creditKeys.loanJournal('L1')

  it('положительный контроль: реестр строит ожидаемый префикс', () => {
    expect(base.slice(0, 4)).toEqual(['credit', 'loans', 'journal', 'L1'])
  })

  it('K-1 разные корзины — разные ключи', () => {
    expect(creditKeys.loanJournal('L1', { bucket: 'penalty' })).not.toEqual(
      creditKeys.loanJournal('L1', { bucket: 'principal' })
    )
  })

  it('K-2 «все корзины» и «параметров нет» — ОДИН ключ', () => {
    // Иначе у одного и того же ответа два кэша: вернувшись к «всем корзинам»,
    // экран сходил бы на сервер вторично за тем, что уже лежит в кэше.
    expect(creditKeys.loanJournal('L1', {})).toEqual(base)
  })

  it('K-3 ключ с отбором не равен ключу без отбора', () => {
    const filtered = creditKeys.loanJournal('L1', { bucket: 'penalty' })
    expect(filtered).not.toEqual(base)
    // Положительный контроль: оба ключа — про один и тот же журнал одного кредита.
    expect(filtered.slice(0, 4)).toEqual(base.slice(0, 4))
  })

  it('K-4 as_of входит в ключ наравне с bucket', () => {
    const sliced = creditKeys.loanJournal('L1', { as_of: '2026-09-01' })
    const withBucket = creditKeys.loanJournal('L1', { bucket: 'penalty' })
    const withBoth = creditKeys.loanJournal('L1', { bucket: 'penalty', as_of: '2026-09-01' })
    expect(sliced).not.toEqual(base)
    expect(withBoth).not.toEqual(withBucket)
    // Положительный контроль: все три — ключи журнала того же кредита.
    for (const key of [sliced, withBucket, withBoth]) {
      expect(key.slice(0, 4)).toEqual(['credit', 'loans', 'journal', 'L1'])
    }
  })
})

/**
 * Хук исполняется НАСТОЯЩИМ: живой `QueryClient`, настоящие `creditKeys` и
 * `creditApi`, сеть подменена адаптером. Сцены A и K проверяют дверь и реестр
 * по отдельности; что хук кладёт отбор и в запрос, и в ключ, видно только
 * здесь — снятие `params` с `queryFn` или с `queryKey` обе группы пропускают.
 *
 * `retry: 1` по умолчанию клиента — то же действие, что глобальное правило
 * `main.tsx` для `CreditApiError` (у него нет `response`, отказ читается как
 * повторяемый); без него H-3 не отличала бы `retry: false` хука от умолчания.
 *
 * Уборка в `finally`: сюита параллельна, а `creditHttp` — модульный синглтон.
 */
describe('useCreditLoanJournal — отбор уходит и в запрос, и в ключ', () => {
  function mount(initialProps: CreditJournalParams, status = 200) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } })
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children)
    const harness = intercept(status)
    const view = renderHook((params: CreditJournalParams) => useCreditLoanJournal('L1', params), {
      wrapper,
      initialProps,
    })
    return {
      client,
      harness,
      view,
      cleanup: () => {
        view.unmount()
        client.clear()
        harness.restore()
      },
    }
  }

  it('H-1 корзина уходит в запрос, и ответ лежит под ключом с этой корзиной', async () => {
    const { client, harness, view, cleanup } = mount({ bucket: 'penalty' })
    try {
      await waitFor(() => expect(harness.seen.configs).toHaveLength(1))
      expect(
        harness.seen.configs[0].params,
        'the hook sent the journal request without the bucket it was given — queryFn dropped params'
      ).toStrictEqual({ bucket: 'penalty' })
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true))
      const cached = client.getQueryCache().find({
        queryKey: creditKeys.loanJournal('L1', { bucket: 'penalty' }),
        exact: true,
      })
      expect(cached, 'the response is not cached under the key with the bucket').toBeDefined()
      expect(cached?.state.data).toStrictEqual({ items: [], next_cursor: null })
    } finally {
      cleanup()
    }
  })

  it('H-2 смена корзины — новый запрос и вторая запись кэша, а не кэш прежней', async () => {
    const { client, harness, view, cleanup } = mount({ bucket: 'penalty' })
    try {
      await waitFor(() => expect(harness.seen.configs).toHaveLength(1))
      view.rerender({ bucket: 'principal' })
      await waitFor(() =>
        expect(
          harness.seen.configs,
          'switching the bucket sent no second request — the cache key does not carry params'
        ).toHaveLength(2)
      )
      expect(harness.seen.configs[1].params).toStrictEqual({ bucket: 'principal' })
      const hashes = client
        .getQueryCache()
        .getAll()
        .map((query) => query.queryHash)
      expect(hashes).toHaveLength(2)
      expect(new Set(hashes).size).toBe(2)
    } finally {
      cleanup()
    }
  })

  it('H-3 отказ двери не повторяется', async () => {
    const { harness, view, cleanup } = mount({ bucket: 'penalty' }, 403)
    try {
      await waitFor(() => expect(view.result.current.isError).toBe(true))
      // Положительный контроль: ошибка — ровно посеянный отказ, а не падение
      // до транспорта (тогда запросов было бы ноль, и «не повторился» — пусто).
      const { error } = view.result.current
      expect(error).toBeInstanceOf(CreditApiError)
      expect((error as CreditApiError).status).toBe(403)
      expect(
        harness.seen.configs,
        'a refused journal read was sent twice — retry: false is gone'
      ).toHaveLength(1)
    } finally {
      cleanup()
    }
  })
})
