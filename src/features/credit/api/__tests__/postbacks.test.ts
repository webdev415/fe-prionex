/**
 * Транспорт постбеков партнерам (18-13d-a1).
 *
 * Что держим:
 *  - двери — те, что объявил контракт модуля (18-13b): список под группой
 *    шлюза `admin`, правка — `PATCH`, удаление — `DELETE`, обе с
 *    `Idempotency-Key`, который задаёт вызывающий (граница нажатия — в хуках);
 *  - отказ модуля разбирается тем же `toCreditError`, что у всего раздела;
 *  - префикс модуля берётся по ссылке: литерала пути модуля в `postbacks.ts`
 *    нет (Р-18-13d-5), иначе копия разошлась бы с `creditApi.ts` молча.
 *
 * Свой адаптер, а не мок модуля: проверяем то, что реально соберёт axios.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { CREDIT_PREFIX, CreditApiError, creditHttp } from '../creditApi'
import { creditPostbacksApi, isKnownPostbackTrigger } from '../postbacks'

/** Исходник транспорта — глобом Vite с `?raw` (средства Node уронили бы `tsc -b`). */
const SOURCE = Object.values(
  import.meta.glob('../postbacks.ts', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >
)[0]

const RULES_PATH = '/api/v1/credit/admin/partner-postbacks/rules'

type Reply = { status: number; data: unknown }

let restore: (() => void) | null = null

/**
 * Подменяет адаптер `creditHttp` и пишет каждый ушедший конфиг. Ответ с
 * кодом ≥ 400 бросается так же, как его бросил бы штатный адаптер.
 */
function serve(reply: Reply): InternalAxiosRequestConfig[] {
  const seen: InternalAxiosRequestConfig[] = []
  const hadPrevious = 'adapter' in creditHttp.defaults
  const previous = creditHttp.defaults.adapter
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config)
    const response = {
      data: reply.data as never,
      status: reply.status,
      statusText: String(reply.status),
      headers: {},
      config,
    }
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response)
    }
    return response
  }
  creditHttp.defaults.adapter = adapter
  restore = () => {
    if (hadPrevious) creditHttp.defaults.adapter = previous
    else delete creditHttp.defaults.adapter
  }
  return seen
}

afterEach(() => {
  restore?.()
  restore = null
})

const RULE = {
  id: '9b0f6a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b',
  name: 'Partner one — lead',
  active: true,
  trigger: 'new_lead',
  utm_source: 'partner1',
  url_template: 'https://partner.example/pb?clickid={click_id}&action_id={action_id}',
  goal: '1',
  currency: null,
  created_at: '2026-10-02T10:00:00Z',
  updated_at: '2026-10-02T10:00:00Z',
  created_by: 7,
  updated_by: 7,
}

describe('creditPostbacksApi — двери модуля', () => {
  it('список правил — GET под группой admin, ответ отдаётся как есть', async () => {
    const list = {
      items: [RULE],
      triggers: [{ code: 'new_lead', amount_allowed: false }],
      macros: [],
    }
    const seen = serve({ status: 200, data: list })

    await expect(creditPostbacksApi.rules()).resolves.toEqual(list)

    expect(seen).toHaveLength(1)
    expect(seen[0].method).toBe('get')
    expect(seen[0].url).toBe(RULES_PATH)
  })

  it('вкл/выкл — PATCH только {active} с ключом вызывающего', async () => {
    const seen = serve({ status: 200, data: { ...RULE, active: false } })

    await creditPostbacksApi.updateRule(RULE.id, { active: false }, 'fe-postback-rule:k-1')

    expect(seen[0].method).toBe('patch')
    expect(seen[0].url).toBe(`${RULES_PATH}/${RULE.id}`)
    expect(JSON.parse(String(seen[0].data))).toEqual({ active: false })
    expect(seen[0].headers.get('Idempotency-Key')).toBe('fe-postback-rule:k-1')
  })

  it('удаление — DELETE с ключом вызывающего и без тела', async () => {
    const seen = serve({ status: 200, data: RULE })

    await creditPostbacksApi.deleteRule(RULE.id, 'fe-postback-rule:k-2')

    expect(seen[0].method).toBe('delete')
    expect(seen[0].url).toBe(`${RULES_PATH}/${RULE.id}`)
    expect(seen[0].headers.get('Idempotency-Key')).toBe('fe-postback-rule:k-2')
    expect(seen[0].data).toBeUndefined()
  })

  it('идентификатор правила кодируется в пути, а не вклеивается как есть', async () => {
    const seen = serve({ status: 200, data: RULE })
    await creditPostbacksApi.deleteRule('a/b', 'k')
    expect(seen[0].url).toBe(`${RULES_PATH}/a%2Fb`)
  })

  it('отказ модуля — CreditApiError со статусом и кодом Problem', async () => {
    serve({ status: 403, data: { title: 'Forbidden', code: 'forbidden' } })

    const error = await creditPostbacksApi.rules().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(CreditApiError)
    expect((error as CreditApiError).status).toBe(403)
    expect((error as CreditApiError).code).toBe('forbidden')
  })
})

/** Литерал пути модуля в исходнике — в любых кавычках. */
function hasPrefixLiteral(source: string): boolean {
  return /['"`]\/api\/v1\/credit/.test(source)
}

describe('postbacks.ts — префикс модуля по ссылке (Р-18-13d-5)', () => {
  it('исходник прочитан', () => {
    expect(typeof SOURCE === 'string' && SOURCE.length > 0, 'глоб потерял postbacks.ts').toBe(true)
  })

  it('литерала пути модуля нет — префикс берётся из creditApi', () => {
    expect(hasPrefixLiteral(SOURCE), 'в postbacks.ts лежит своя копия префикса').toBe(false)
    expect(SOURCE).toContain('CREDIT_PREFIX')
    expect(CREDIT_PREFIX).toBe('/api/v1/credit')
  })

  it('контроль: копия префикса в исходнике краснит проверку', () => {
    const mutated = SOURCE.replace('`${CREDIT_PREFIX}/admin', "'/api/v1/credit' + `/admin")
    expect(mutated, 'контроль не построен: исходник не изменился').not.toBe(SOURCE)
    expect(hasPrefixLiteral(mutated)).toBe(true)
  })
})

describe('isKnownPostbackTrigger', () => {
  it('знает триггеры снимка и не знает чужих', () => {
    expect(isKnownPostbackTrigger('new_lead')).toBe(true)
    expect(isKnownPostbackTrigger('new_loan')).toBe(true)
    expect(isKnownPostbackTrigger('loan_repaid')).toBe(false)
  })
})
