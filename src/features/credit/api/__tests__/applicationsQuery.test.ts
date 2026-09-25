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
