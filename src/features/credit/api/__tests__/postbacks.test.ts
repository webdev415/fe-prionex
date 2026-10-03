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
 *
 * a2: создание — `POST` с ключом вызывающего; `checkPostbackUrl` — зеркало трёх
 * проверок модуля таблицей; отказ модуля несёт `details` (уточнения 422) и код
 * сетевого отказа axios (`transportCode`) — аддитивно, прежние поля как были;
 * перечни — в файле без импортов, `enums.ts` транспорт не тянет.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { CREDIT_PREFIX, CreditApiError, creditApi, creditHttp, toCreditError } from '../creditApi'
import { CREDIT_DYNAMIC_NAMESPACES } from '../enums'
import * as postbackEnums from '../postbackEnums'
import * as postbacks from '../postbacks'
import { checkPostbackUrl, creditPostbacksApi, isKnownPostbackTrigger } from '../postbacks'

/** Исходник транспорта — глобом Vite с `?raw` (средства Node уронили бы `tsc -b`). */
const SOURCE = Object.values(
  import.meta.glob('../postbacks.ts', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >
)[0]

const RULES_PATH = '/api/v1/credit/admin/partner-postbacks/rules'

/** Исходники перечней и реестра пространств — тем же глобом. */
const ENUM_SOURCES = import.meta.glob(['../postbackEnums.ts', '../enums.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const sourceOf = (name: string) =>
  Object.entries(ENUM_SOURCES).find(([path]) => path.endsWith(`/${name}`))?.[1] ?? ''

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

describe('создание правила (a2)', () => {
  it('POST тела формы с ключом вызывающего', async () => {
    const seen = serve({ status: 201, data: RULE })
    const input = {
      name: RULE.name,
      active: true,
      trigger: 'new_lead',
      utm_source: 'partner1',
      url_template: RULE.url_template,
      goal: '1',
      currency: null,
    }

    await expect(creditPostbacksApi.createRule(input, 'fe-postback-rule:k-3')).resolves.toEqual(
      RULE
    )

    expect(seen[0].method).toBe('post')
    expect(seen[0].url).toBe(RULES_PATH)
    expect(JSON.parse(String(seen[0].data))).toEqual(input)
    expect(seen[0].headers.get('Idempotency-Key')).toBe('fe-postback-rule:k-3')
  })
})

describe('checkPostbackUrl — зеркало трёх проверок модуля (Р-18-13d-6)', () => {
  const LIST = {
    triggers: [
      { code: 'new_lead', amount_allowed: false },
      { code: 'new_loan', amount_allowed: true },
    ],
    macros: ['click_id', 'action_id', 'goal', 'amount', 'currency'],
  }
  const BASE = 'https://p.example/pb'

  it.each([
    ['всё на месте', `${BASE}?c={click_id}&a={action_id}&g={goal}`, 'new_lead', []],
    ['сумма на кредите', `${BASE}?c={click_id}&s={amount}&cur={currency}`, 'new_loan', []],
    ['без {click_id}', `${BASE}?a={action_id}`, 'new_lead', ['url_click_id_required']],
    [
      '{click_id} в пути, не в query',
      `${BASE}/{click_id}?a=1`,
      'new_lead',
      ['url_click_id_required'],
    ],
    ['{click_id} после #', `${BASE}?a=1#{click_id}`, 'new_lead', ['url_click_id_required']],
    ['неизвестный макрос', `${BASE}?c={click_id}&x={foo}`, 'new_lead', ['url_macro_unknown']],
    ['непарная скобка', `${BASE}?c={click_id}&x={goal`, 'new_lead', ['url_macro_unknown']],
    [
      '{amount} на лиде',
      `${BASE}?c={click_id}&s={amount}`,
      'new_lead',
      ['url_macro_not_for_trigger'],
    ],
    ['{amount} без триггера — решит модуль', `${BASE}?c={click_id}&s={amount}`, '', []],
    ['{amount} у неизвестного триггера — решит модуль', `${BASE}?c={click_id}&s={amount}`, 'x', []],
  ])('%s', (_name, url, trigger, expected) => {
    expect(checkPostbackUrl(url, trigger, LIST).map((problem) => problem.reason)).toEqual(expected)
  })

  it('неизвестный макрос назван по имени', () => {
    expect(checkPostbackUrl(`${BASE}?c={click_id}&x={foo}&y={bar}`, 'new_lead', LIST)).toEqual([
      { reason: 'url_macro_unknown', macros: ['{foo}', '{bar}'] },
    ])
  })

  it('перечень макросов — из ответа двери: новый макрос модуля принят, пропавший — нет', () => {
    const list = { ...LIST, macros: ['click_id', 'sub_id'] }
    expect(checkPostbackUrl(`${BASE}?c={click_id}&s={sub_id}`, 'new_lead', list)).toEqual([])
    expect(checkPostbackUrl(`${BASE}?c={click_id}&g={goal}`, 'new_lead', list)).toEqual([
      { reason: 'url_macro_unknown', macros: ['{goal}'] },
    ])
  })

  it('признак «допускает {amount}» — из ответа двери, а не из снимка', () => {
    const list = { ...LIST, triggers: [{ code: 'new_lead', amount_allowed: true }] }
    expect(checkPostbackUrl(`${BASE}?c={click_id}&s={amount}`, 'new_lead', list)).toEqual([])
  })
})

describe('отказ модуля: details и код сетевого отказа (К-1, аддитивно)', () => {
  const PROBLEM_422 = {
    title: 'Validation failed',
    detail: 'Правило постбека не прошло проверку',
    code: 'validation_failed',
    errors: [{ field: 'url_template', code: 'invalid_value' }],
    details: { reason: { url_template: ['url_macro_outside_query'] } },
  }

  it('422 — details доходят до CreditApiError, прежние поля как были', async () => {
    serve({ status: 422, data: PROBLEM_422 })
    const error = (await creditPostbacksApi
      .createRule({} as never, 'k')
      .catch((caught: unknown) => caught)) as CreditApiError

    expect(error).toBeInstanceOf(CreditApiError)
    expect(error.details).toEqual(PROBLEM_422.details)
    expect(error.status).toBe(422)
    expect(error.code).toBe('validation_failed')
    expect(error.fields).toEqual(PROBLEM_422.errors)
    expect(error.message).toBe(PROBLEM_422.detail)
    expect(error.transportCode).toBeUndefined()
  })

  it('details не объектом — уточнений нет', () => {
    for (const details of ['x', ['a'], null]) {
      const error = toCreditError(
        new AxiosError('Bad', 'ERR_BAD_REQUEST', undefined, null, {
          data: { details },
          status: 422,
        } as never)
      )
      expect(error.details).toBeUndefined()
    }
  })

  it.each(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'])(
    'сетевой отказ %s без ответа — код в transportCode, code Problem пуст',
    (code) => {
      const error = toCreditError(new AxiosError('Network Error', code))
      expect(error.transportCode).toBe(code)
      expect(error.code).toBeUndefined()
      expect(error.status).toBeUndefined()
    }
  )

  it('отказ с ответом — transportCode пуст: это не сетевой сбой', async () => {
    serve({ status: 503, data: { title: 'Unavailable' } })
    const error = (await creditPostbacksApi
      .rules()
      .catch((caught: unknown) => caught)) as CreditApiError
    expect(error.status).toBe(503)
    expect(error.transportCode).toBeUndefined()
  })

  it('тело отказа blob-ом (содержимое документа) — details и transportCode тем же путём', async () => {
    const blob = new Blob([JSON.stringify(PROBLEM_422)], { type: 'application/problem+json' })
    serve({ status: 422, data: blob })
    const refused = (await creditApi
      .applicationDocumentContent('a-1', 'd-1')
      .catch((caught: unknown) => caught)) as CreditApiError
    expect(refused.details).toEqual(PROBLEM_422.details)
    expect(refused.code).toBe('validation_failed')

    const previous = creditHttp.defaults.adapter
    creditHttp.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    }
    try {
      const offline = (await creditApi
        .applicationDocumentContent('a-1', 'd-1')
        .catch((caught: unknown) => caught)) as CreditApiError
      expect(offline.transportCode).toBe('ERR_NETWORK')
    } finally {
      creditHttp.defaults.adapter = previous
    }
  })

  it('прежний вызов конструктора — без новых полей', () => {
    const error = new CreditApiError('Boom', 500, 'x', [{ field: 'a' }])
    expect([error.status, error.code, error.fields]).toEqual([500, 'x', [{ field: 'a' }]])
    expect(error.details).toBeUndefined()
    expect(error.transportCode).toBeUndefined()
  })
})

describe('перечни — в файле без импортов (К-3в)', () => {
  it('postbackEnums.ts ничего не импортирует', () => {
    const source = sourceOf('postbackEnums.ts')
    expect(source.length, 'глоб потерял postbackEnums.ts').toBeGreaterThan(0)
    expect(source).not.toMatch(/^\s*import\b/m)
  })

  it('enums.ts берёт перечни постбеков из postbackEnums, а не из транспорта', () => {
    const source = sourceOf('enums.ts')
    expect(source).toContain("from './postbackEnums'")
    expect(source).not.toMatch(/from '\.\/postbacks'/)
  })

  it('postbacks.ts реэкспортирует те же перечни — прежние импортёры не сломаны', () => {
    expect(postbacks.CREDIT_POSTBACK_TRIGGERS).toBe(postbackEnums.CREDIT_POSTBACK_TRIGGERS)
    expect(postbacks.CREDIT_POSTBACK_AMOUNT_TRIGGERS).toBe(
      postbackEnums.CREDIT_POSTBACK_AMOUNT_TRIGGERS
    )
    expect(postbacks.CREDIT_POSTBACK_MACROS).toBe(postbackEnums.CREDIT_POSTBACK_MACROS)
    expect(postbacks.isKnownPostbackTrigger).toBe(postbackEnums.isKnownPostbackTrigger)
  })
})

describe('пространства словаря формы зарегистрированы (К-6)', () => {
  it('postbacks.macro — перечень макросов, postbacks.form.errors — уточнения отказа', () => {
    expect(CREDIT_DYNAMIC_NAMESPACES['postbacks.macro']).toBe(postbackEnums.CREDIT_POSTBACK_MACROS)
    expect(CREDIT_DYNAMIC_NAMESPACES['postbacks.form.errors']).toBe(
      postbackEnums.CREDIT_POSTBACK_RULE_REASONS
    )
  })
})

describe('лог отправок (18-13d-b) — дверь listPartnerPostbackDeliveries', () => {
  const DELIVERIES_PATH = '/api/v1/credit/admin/partner-postbacks/deliveries'
  const RULE_ID = '9b0f6a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b'
  const ACTION_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

  /** Строка запроса так, как её соберёт axios из конфига вызова. */
  const query = (config: InternalAxiosRequestConfig) =>
    new URL(creditHttp.getUri(config), 'http://crm.test').searchParams

  it('GET под группой admin: фильтры — имена параметров двери, limit и cursor', async () => {
    const page = { items: [], next_cursor: null }
    const seen = serve({ status: 200, data: page })

    await expect(
      creditPostbacksApi.listDeliveries({
        rule_id: RULE_ID,
        status: 'skipped',
        trigger: 'new_lead',
        action_id: ACTION_ID,
        created_from: '2026-10-01',
        created_to: '2026-10-03',
        limit: postbacks.CREDIT_POSTBACK_LOG_PAGE_SIZE,
        cursor: '42',
      })
    ).resolves.toEqual(page)

    expect(seen).toHaveLength(1)
    expect(seen[0].method).toBe('get')
    expect(seen[0].url).toBe(DELIVERIES_PATH)
    const params = query(seen[0])
    expect(Object.fromEntries(params)).toEqual({
      rule_id: RULE_ID,
      status: 'skipped',
      trigger: 'new_lead',
      action_id: ACTION_ID,
      created_from: '2026-10-01',
      created_to: '2026-10-03',
      limit: '25',
      cursor: '42',
    })
    // Повторяемых параметров нет: у каждого имени — ровно одно значение.
    expect([...params.keys()]).toHaveLength(new Set(params.keys()).size)
  })

  it('размер страницы — умолчание двери, 25', () => {
    expect(postbacks.CREDIT_POSTBACK_LOG_PAGE_SIZE).toBe(25)
  })

  it('незаданный фильтр в запрос не уходит', async () => {
    const seen = serve({ status: 200, data: { items: [], next_cursor: null } })

    await creditPostbacksApi.listDeliveries({ limit: 25, status: undefined, cursor: undefined })

    expect(Object.fromEntries(query(seen[0]))).toEqual({ limit: '25' })
  })

  it('отказ двери — CreditApiError тем же разбором', async () => {
    serve({ status: 403, data: { title: 'Forbidden', code: 'forbidden' } })

    const error = await creditPostbacksApi
      .listDeliveries({ limit: 25 })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(CreditApiError)
    expect((error as CreditApiError).status).toBe(403)
  })

  // Подпись «известен ли код» таблица лога берёт из этого реестра (вместо isKnown*):
  // сырой код с пометкой у неизвестного держит сцена таблицы CreditPostbackDeliveries.
  it('перечни лога зарегистрированы пространствами словаря', () => {
    expect(CREDIT_DYNAMIC_NAMESPACES['postbacks.outcome']).toBe(
      postbackEnums.CREDIT_POSTBACK_OUTCOMES
    )
    expect(CREDIT_DYNAMIC_NAMESPACES['postbacks.skipReason']).toBe(
      postbackEnums.CREDIT_POSTBACK_SKIP_REASONS
    )
    expect(CREDIT_DYNAMIC_NAMESPACES['postbacks.lastError']).toBe(
      postbackEnums.CREDIT_POSTBACK_LAST_ERRORS
    )
  })
})

describe('postbackLogRequest — поля фильтров лога → параметры двери (Р-18-13d-10)', () => {
  const UUID_A = '9b0f6a1e-2c3d-4e5f-8a9b-0c1d2e3f4a5b'
  const EMPTY = { rule: '', outcome: '', trigger: '', action: '', from: '', to: '' }

  it('пустые поля — ни одного фильтра', () => {
    expect(postbacks.postbackLogRequest(EMPTY)).toEqual({
      filters: {
        rule_id: undefined,
        status: undefined,
        trigger: undefined,
        action_id: undefined,
        created_from: undefined,
        created_to: undefined,
      },
      rangeInverted: false,
      actionInvalid: false,
    })
  })

  it('годные значения уходят под именами двери; ID обрезается по краям', () => {
    const { filters } = postbacks.postbackLogRequest({
      rule: UUID_A,
      outcome: 'failed',
      trigger: 'new_loan',
      action: ` ${UUID_A} `,
      from: '2026-10-01',
      to: '2026-10-01',
    })
    expect(filters).toEqual({
      rule_id: UUID_A,
      status: 'failed',
      trigger: 'new_loan',
      action_id: UUID_A,
      created_from: '2026-10-01',
      created_to: '2026-10-01',
    })
  })

  it('мусор ссылки не уходит: не-UUID, чужой исход и триггер, дата не YYYY-MM-DD', () => {
    const result = postbacks.postbackLogRequest({
      rule: 'r-1',
      outcome: 'bounced',
      trigger: 'loan_repaid',
      action: '9b0f6a1e',
      from: '01.10.2026',
      to: '',
    })
    expect(Object.values(result.filters).every((value) => value === undefined)).toBe(true)
    expect(result.actionInvalid).toBe(true)
  })

  it('перевёрнутый период не уходит целиком и помечен', () => {
    const result = postbacks.postbackLogRequest({ ...EMPTY, from: '2026-10-05', to: '2026-10-01' })
    expect(result.rangeInverted).toBe(true)
    expect(result.filters.created_from).toBeUndefined()
    expect(result.filters.created_to).toBeUndefined()
  })
})
