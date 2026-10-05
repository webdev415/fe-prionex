/**
 * Провод списка заявок: даты уходят в модуль днём и только при значении.
 *
 * Предмет — то, что дошло до транспорта, а не то, что написано в коде:
 * свой адаптер перехватывает собранный запрос. Даты — параметры
 * `created_from`/`created_to`/`updated_from`/`updated_to` двери
 * `listInternalApplications`; границы суток по календарю юрисдикции заявки
 * считает модуль, поэтому фронт шлёт день `YYYY-MM-DD` как есть и ни во что
 * его не переводит. Без дат запрос обязан быть прежним: ключа даты в нём нет
 * вовсе, а не «есть, но пустой».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import {
  CreditApiError,
  creditApi,
  creditHttp,
  type CreditApplicationsExportParams,
} from '../creditApi'

const DATE_KEYS = ['created_from', 'created_to', 'updated_from', 'updated_to'] as const

const DAYS = {
  created_from: '2026-08-31',
  created_to: '2026-09-01',
  updated_from: '2026-09-20',
  updated_to: '2026-09-24',
}

/** Перехват: свой адаптер вместо сети; собранные запросы — в `configs`. */
function intercept(): { configs: InternalAxiosRequestConfig[]; restore: () => void } {
  const configs: InternalAxiosRequestConfig[] = []
  const previous = creditHttp.defaults.adapter
  const adapter: AxiosAdapter = async (config) => {
    configs.push(config)
    return {
      data: { items: [], next_cursor: null, total: 0 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  creditHttp.defaults.adapter = adapter
  return {
    configs,
    restore: () => {
      creditHttp.defaults.adapter = previous
    },
  }
}

describe('creditApi.applications — даты на проводе', () => {
  let harness: ReturnType<typeof intercept>

  beforeEach(() => {
    harness = intercept()
  })
  afterEach(() => harness.restore())

  function sent(): InternalAxiosRequestConfig {
    const config = harness.configs[0]
    expect(config, 'адаптер не получил запрос — проверять нечего').toBeDefined()
    return config
  }

  it('четыре даты уходят днём, каждая в свой ключ', async () => {
    await creditApi.applications({ ...DAYS })
    const config = sent()
    for (const key of DATE_KEYS) {
      expect(config.params?.[key], `${key} не дошёл до запроса днём`).toBe(DAYS[key])
    }
    const url = creditHttp.getUri(config)
    for (const key of DATE_KEYS) {
      expect(
        url,
        `в собранном адресе нет ${key}=${DAYS[key]} — день переведён или потерян`
      ).toContain(`${key}=${DAYS[key]}`)
    }
    expect(url, 'день ушёл моментом со временем, а не датой').not.toMatch(/T\d{2}(:|%3A)/)
  })

  it('без дат ключей дат в запросе нет вовсе', async () => {
    await creditApi.applications({})
    const { params } = sent()
    for (const key of DATE_KEYS) {
      expect(key in params, `ключ ${key} ушёл в запрос без значения`).toBe(false)
    }
  })

  it('пустая строка — не значение: ключа даты нет', async () => {
    await creditApi.applications({
      created_from: '',
      created_to: '',
      updated_from: '',
      updated_to: '',
    })
    const { params } = sent()
    for (const key of DATE_KEYS) {
      expect(key in params, `пустой ${key} ушёл в запрос`).toBe(false)
    }
  })

  it('прежние параметры на месте: повторяемый статус и limit по умолчанию', async () => {
    await creditApi.applications({ status: ['referred', 'declined'] })
    const url = creditHttp.getUri(sent())
    expect(url, 'статус ушёл не повторяемым параметром').toContain(
      'status=referred&status=declined'
    )
    expect(url, 'limit по умолчанию не ушёл').toContain('limit=25')
  })
})

/**
 * Метки (18-13c): `utm_source`, `utm_campaign`, `click_id`, `has_click_id` —
 * параметры двери `listInternalApplications` (контракт 0.1.44). Тем же
 * правилом, что даты: нет значения — нет ключа; совпадение и регистр решает
 * модуль, фронт только обрезает края и не переписывает значение.
 */
describe('creditApi.applications — метки на проводе', () => {
  const TAG_KEYS = ['utm_source', 'utm_campaign', 'click_id', 'has_click_id'] as const
  let harness: ReturnType<typeof intercept>

  beforeEach(() => {
    harness = intercept()
  })
  afterEach(() => harness.restore())

  function sent(): InternalAxiosRequestConfig {
    const config = harness.configs[0]
    expect(config, 'адаптер не получил запрос — проверять нечего').toBeDefined()
    return config
  }

  it('заданные метки уходят обрезанными, пустая — без ключа', async () => {
    await creditApi.applications({
      utm_source: ' google ',
      utm_campaign: '',
      click_id: 'abc',
      has_click_id: true,
    })
    const config = sent()
    expect(config.params?.utm_source, 'края utm_source не обрезаны').toBe('google')
    expect(config.params?.click_id).toBe('abc')
    expect('utm_campaign' in config.params, 'пустой utm_campaign ушёл в запрос').toBe(false)
    const url = creditHttp.getUri(config)
    expect(url).toContain('utm_source=google')
    expect(url).toContain('click_id=abc')
    expect(url, 'has_click_id не ушёл строкой true').toContain('has_click_id=true')
    expect(url, 'метка ушла массивом, а не одиночной строкой').not.toMatch(/utm_source%5B|\[\]/)
  })

  it('has_click_id: false уходит явно — это фильтр «без клика», а не его отсутствие', async () => {
    await creditApi.applications({ has_click_id: false })
    expect(creditHttp.getUri(sent())).toContain('has_click_id=false')
  })

  it('click_id не переписывается: регистр значим', async () => {
    await creditApi.applications({ click_id: 'AbC-1' })
    expect(sent().params?.click_id).toBe('AbC-1')
  })

  it('пробельная метка — не значение: ключа нет', async () => {
    await creditApi.applications({ utm_source: '   ', utm_campaign: ' ', click_id: '  ' })
    const { params } = sent()
    for (const key of TAG_KEYS) {
      expect(key in params, `пробельный ${key} ушёл в запрос`).toBe(false)
    }
  })

  it('без меток запрос прежний: ни одного ключа меток', async () => {
    await creditApi.applications({ status: ['referred'], query: 'demo' })
    const { params } = sent()
    for (const key of TAG_KEYS) {
      expect(key in params, `ключ ${key} ушёл в запрос без значения`).toBe(false)
    }
    // Положительный контроль: прежние параметры на месте.
    expect(params.query).toBe('demo')
    expect(params.limit).toBe(25)
  })
})

/**
 * Выгрузка CSV (18-13c-b): дверь `exportInternalApplications` (контракт 0.1.45).
 * Выборка обязана совпасть с выборкой списка под теми же фильтрами — контракт
 * обещает «множество файла = множество списка», и держится это только если
 * параметры собраны одинаково; страницы (`limit`/`cursor`) у файла нет. Тело
 * отказа приходит blob'ом: «слишком много» читается из `details` числами.
 */
describe('creditApi.exportApplications — выгрузка на проводе', () => {
  type Reply = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>
  const FILTERS = {
    status: ['referred', 'declined'],
    query: 'demo',
    sort: '-created_at',
    created_from: '2026-08-31',
    updated_to: '2026-09-24',
    utm_source: ' google ',
    utm_campaign: '',
    click_id: 'AbC-1',
    has_click_id: false,
  } as CreditApplicationsExportParams
  const csv = () => new Blob(['﻿number,utm_source\r\nCA-1,google\r\n'], { type: 'text/csv' })
  const problem = (body: unknown) =>
    new Blob([JSON.stringify(body)], { type: 'application/problem+json' })

  let configs: InternalAxiosRequestConfig[]
  let restore: () => void

  /** Свой адаптер с заданным ответом; отказ адаптер бросает сам — статус он не проверяет. */
  function answer(reply: Reply): void {
    const hadPrevious = 'adapter' in creditHttp.defaults
    const previous = creditHttp.defaults.adapter
    creditHttp.defaults.adapter = async (config) => {
      configs.push(config)
      return reply(config)
    }
    restore = () => {
      if (hadPrevious) creditHttp.defaults.adapter = previous
      else delete creditHttp.defaults.adapter
    }
  }
  const ok =
    (blob: Blob, headers: Record<string, string> = {}): Reply =>
    async (config) => ({ data: blob, status: 200, statusText: 'OK', headers, config })
  const fail =
    (status: number, body: unknown): Reply =>
    async (config) => {
      const response = { data: body, status, statusText: '', headers: {}, config } as AxiosResponse
      throw new AxiosError(
        `Request failed with status code ${status}`,
        'ERR_BAD_REQUEST',
        config,
        null,
        response
      )
    }

  beforeEach(() => {
    configs = []
    restore = () => undefined
  })
  afterEach(() => {
    restore()
    vi.useRealTimers()
  })

  async function refusal(): Promise<CreditApiError> {
    const caught = await creditApi.exportApplications(FILTERS).catch((error: unknown) => error)
    expect(caught, 'выгрузка не отказала').toBeInstanceOf(CreditApiError)
    return caught as CreditApiError
  }

  it('AC-5: выборка файла = выборка списка без страницы; повторяемый status; blob; свой таймаут', async () => {
    answer(ok(csv()))
    await creditApi.applications(FILTERS)
    await creditApi.exportApplications(FILTERS)
    const [list, file] = configs
    const { limit, cursor, ...listSelection } = list.params as Record<string, unknown>
    expect(limit, 'положительный контроль: у списка страница есть').toBe(25)
    void cursor
    expect(file.params, 'параметры выгрузки разошлись с параметрами списка').toEqual(listSelection)
    expect(Object.keys(file.params), 'порядок/набор ключей выгрузки не тот, что у списка').toEqual(
      Object.keys(listSelection).filter((key) => listSelection[key] !== undefined)
    )
    for (const key of ['limit', 'cursor']) {
      expect(key in file.params, `${key} ушёл в запрос выгрузки`).toBe(false)
    }
    const url = creditHttp.getUri(file)
    expect(url).toContain('/api/v1/credit/applications/export?')
    expect(url, 'статус ушёл не повторяемым параметром').toContain(
      'status=referred&status=declined'
    )
    expect(url).toContain('utm_source=google')
    expect(url).toContain('has_click_id=false')
    expect(url, 'пустая метка ушла в выгрузку').not.toContain('utm_campaign')
    expect(file.responseType, 'файл просится не blob’ом — BOM и байты пропадут').toBe('blob')
    expect(file.timeout, 'у выгрузки нет своего таймаута').toBe(55_000)
    expect(list.timeout, 'долгий таймаут выгрузки утёк в список').toBe(30_000)
  })

  it('AC-5: limit/cursor, переданные в обход типа, в выгрузку не уходят', async () => {
    answer(ok(csv()))
    await creditApi.exportApplications({ ...FILTERS, limit: 5, cursor: 'c-2' } as never)
    const url = creditHttp.getUri(configs[0])
    expect(url).not.toMatch(/[?&](limit|cursor)=/)
  })

  it('AC-5: 200 — тот же blob без перекодировки, имя из Content-Disposition модуля', async () => {
    const blob = csv()
    answer(
      ok(blob, {
        'content-disposition': 'attachment; filename="credit-applications-2001-02-03.csv"',
      })
    )
    const file = await creditApi.exportApplications(FILTERS)
    expect(file.blob, 'blob подменён — BOM и \\r\\n могли пропасть').toBe(blob)
    expect(file.filename).toBe('credit-applications-2001-02-03.csv')
  })

  it.each([
    ['заголовка нет', undefined],
    ['имя с путём и пробелом', 'attachment; filename="../x y.csv"'],
  ])('AC-5: %s — запасное имя с днём по часам браузера', async (_case, disposition) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 0, 5, 23, 30))
    answer(ok(csv(), disposition ? { 'content-disposition': disposition } : {}))
    const file = await creditApi.exportApplications(FILTERS)
    expect(file.filename).toBe('credit-applications-2026-01-05.csv')
  })

  it('AC-5: 422 сверх предела blob’ом — CreditApiError с числами total и max_rows', async () => {
    answer(
      fail(
        422,
        problem({
          title: 'Validation failed',
          code: 'validation_failed',
          detail: 'too many rows',
          errors: [{ field: 'query', code: 'out_of_range' }],
          details: { total: 10001, max_rows: 10000 },
        })
      )
    )
    const error = await refusal()
    expect(error.status).toBe(422)
    expect(error.code).toBe('validation_failed')
    expect(error.details?.total).toBe(10001)
    expect(error.details?.max_rows).toBe(10000)
  })

  it.each([
    [403, 'forbidden', 'Нет права credit.applications.export'],
    [503, 'module_unavailable', 'Модуль недоступен'],
  ])(
    'AC-5: %s Problem — CreditApiError с текстом detail, без details',
    async (status, code, detail) => {
      answer(fail(status, problem({ title: 'x', status, code, detail })))
      const error = await refusal()
      expect(error.status).toBe(status)
      expect(error.message).toBe(detail)
      expect(error.details).toBeUndefined()
    }
  )

  it('AC-5: не-JSON тело (ответ шлюза) — CreditApiError со статусом, без details', async () => {
    answer(fail(502, new Blob(['<html>bad gateway</html>'], { type: 'text/html' })))
    const error = await refusal()
    expect(error.status).toBe(502)
    expect(error.details).toBeUndefined()
  })

  it('AC-5: таймаут — CreditApiError без статуса, с кодом транспорта', async () => {
    answer(async (config) => {
      throw new AxiosError('timeout of 55000ms exceeded', 'ECONNABORTED', config)
    })
    const error = await refusal()
    expect(error.status).toBeUndefined()
    expect(error.transportCode).toBe('ECONNABORTED')
    expect(error.message).toContain('timeout')
  })
})
