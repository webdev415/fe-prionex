/**
 * Транспорт двери «кредиты клиента» — сцена S-11 story 14-7.
 *
 * Предмет — АДРЕС и ПАРАМЕТР, по которым уходит запрос, и разбор двух ответов,
 * которые для блока карточки значат разное: 403 («права нет» — блок покажет
 * проекцию) и 404 («у шлюза ещё нет группы `clients`» — блок скажет об этом
 * словами). Проверяется по ПЕРЕХВАЧЕННОМУ запросу, а не по чтению кода:
 * утверждение «метод собирает такой путь» доказывается только тем, что этот
 * путь дошёл до транспорта.
 *
 * ⚠️ Отката на другой путь здесь быть НЕ должно, в отличие от портфельного
 * `loans`: там 404 объяснён отставанием стенда разработчика, здесь 404 —
 * законное состояние шлюза, и второй запрос спрятал бы ровно тот факт, ради
 * которого блок это состояние показывает.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { creditApi, creditHttp, CreditApiError } from '../creditApi'

type Seen = { configs: InternalAxiosRequestConfig[] }

/** Перехват: свой адаптер вместо сети, с ответом, который задаёт случай. */
function intercept(
  respond: (config: InternalAxiosRequestConfig) => {
    status: number
    data: unknown
  }
): { seen: Seen; restore: () => void } {
  const seen: Seen = { configs: [] }
  const previous = creditHttp.defaults.adapter
  const adapter: AxiosAdapter = async (config) => {
    seen.configs.push(config)
    const { status, data } = respond(config)
    if (status >= 400) {
      const error = Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        config,
        response: { status, data, statusText: '', headers: {}, config },
      })
      throw error
    }
    return { data, status, statusText: 'OK', headers: {}, config }
  }
  creditHttp.defaults.adapter = adapter
  return {
    seen,
    restore: () => {
      creditHttp.defaults.adapter = previous
    },
  }
}

const PAGE = { items: [], next_cursor: null }

describe('S-11 creditApi.clientLoans — адрес и параметр', () => {
  let harness: ReturnType<typeof intercept>

  beforeEach(() => {
    harness = intercept(() => ({ status: 200, data: PAGE }))
  })
  afterEach(() => harness.restore())

  it('уходит на /api/v1/credit/clients/{id}/loans', async () => {
    await creditApi.clientLoans(10)
    const config = harness.seen.configs[0]
    expect(config, 'адаптер не получил запрос — проверять нечего').toBeDefined()
    expect(config.url).toBe('/api/v1/credit/clients/10/loans')
    // Идентификатор клиента едет в ПУТИ, а не параметром запроса: дверь
    // объявлена как ресурс клиента, и `?client_id=` ушёл бы в портфельный
    // список, который класса А не считает.
    expect(config.params).not.toHaveProperty('client_id')
  })

  it('несёт status ОДНИМ значением, а не списком', async () => {
    await creditApi.clientLoans(10, { status: 'active' })
    const { params } = harness.seen.configs[0]
    expect(params).toEqual({ status: 'active' })
    // Положительный контроль соседней проверки: значение действительно дошло,
    // то есть «списка нет» сказано о непустом параметре.
    expect(String(params.status)).not.toContain(',')
  })

  it('без параметров не подставляет status сам', async () => {
    await creditApi.clientLoans(10)
    expect(harness.seen.configs[0].params).toEqual({ status: undefined })
  })
})

describe('S-11 creditApi.clientLoans — разбор отказов', () => {
  it('403 доезжает как CreditApiError со статусом — блок отличит «права нет»', async () => {
    const harness = intercept(() => ({
      status: 403,
      data: { title: 'Forbidden', detail: 'no permission', code: 'forbidden' },
    }))
    try {
      await expect(creditApi.clientLoans(10)).rejects.toBeInstanceOf(CreditApiError)
      await creditApi.clientLoans(10).catch((error: unknown) => {
        expect(error).toBeInstanceOf(CreditApiError)
        expect((error as CreditApiError).status).toBe(403)
      })
    } finally {
      harness.restore()
    }
  })

  it('404 НЕ приводит ко второму запросу на другой путь', async () => {
    const harness = intercept(() => ({ status: 404, data: { message: 'no Route matched' } }))
    try {
      await expect(creditApi.clientLoans(10)).rejects.toBeInstanceOf(CreditApiError)
      // Ровно один запрос: откат на `/admin/...`, как у портфельного списка,
      // сюда не скопирован.
      expect(harness.seen.configs).toHaveLength(1)
      expect(harness.seen.configs[0].url).toBe('/api/v1/credit/clients/10/loans')
    } finally {
      harness.restore()
    }
  })

  it('положительный контроль перехвата: успешный ответ доезжает целиком', async () => {
    // Без этого случая три проверки выше зеленели бы и на транспорте, который
    // не отдаёт ничего.
    const page = { items: [{ loan_id: 'L-1' }], next_cursor: null }
    const harness = intercept(() => ({ status: 200, data: page }))
    try {
      await expect(creditApi.clientLoans(7)).resolves.toEqual(page)
      expect(harness.seen.configs[0].url).toBe('/api/v1/credit/clients/7/loans')
    } finally {
      harness.restore()
    }
  })
})

describe('S-11 форма вызова не подменяется моком', () => {
  it('метод существует у экспортированного creditApi', () => {
    // Сцена, перехватывающая транспорт, зеленела бы и на методе, взятом из
    // мока: здесь проверяется, что предмет — настоящий экспорт модуля.
    expect(typeof creditApi.clientLoans).toBe('function')
    expect(vi.isMockFunction(creditApi.clientLoans)).toBe(false)
  })
})
