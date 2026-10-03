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
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { creditApi, creditHttp } from '../creditApi'

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
