/**
 * Служебного ключа в браузере больше нет — и это проверяется, а не заявляется.
 *
 * До перехода на пропуск раздел работал так: оператор вписывал общий ключ
 * модуля, тот ложился в `sessionStorage`, и каждый запрос уносил его вместе
 * с заголовком роли, который человек выбирал сам. Кто знал ключ — назначал
 * себе любую роль поверх настоящих прав.
 *
 * Здесь четыре разных утверждения, и все нужны:
 *  1) перечень перебора равен экспорту `creditApi` — иначе всё остальное
 *     проверяет подмножество, которое может молча усохнуть;
 *  2) НИ ОДИН вызов не уносит ключ и роль — перебором по всем методам,
 *     с требованием «у каждого имени хотя бы один запрос дошёл до транспорта»;
 *  3) интерцептор чист и сам по себе, даже когда мусор прежней схемы лежит
 *     в хранилище рядом;
 *  4) ключ и роль, оставшиеся с прежних сессий, СТИРАЮТСЯ.
 * Второе без четвёртого оставляет секрет на общей машине кол-центра.
 *
 * ⚠️ Почему перебор ВЫЗОВАМИ, а не прогоном интерцептора. Прежняя форма этого
 * файла доставала обработчики из `creditHttp.interceptors.request.handlers` и
 * гнала через них синтетический пустой конфиг. Заголовки, которые метод ставит
 * НА ВЫЗОВ, в такой проверке не участвуют вовсе: `setSwitch` и `decide` кладут
 * свои `headers` мимо интерцептора, и вернуть через них служебный ключ можно
 * было бы, не покраснев ни разу. Техника перехвата ниже — та же, что в
 * соседнем `creditApi.test.ts` (подмена `creditHttp.defaults.adapter`): свой
 * адаптер и чтение ИТОГОВОГО конфига запроса.
 *
 * ⚠️ Почему ищем ЗНАЧЕНИЕ, а не имена заголовков. Дверь, закрытая по имени
 * механизма, оставляет соседние: тот же ключ уходит в `params`, в `url` или
 * в теле запроса, и проверка заголовков молчит. Предмет `REQ-FE-6-07` —
 * «пропуск единственный канал», то есть значение секрета не покидает браузер
 * НИКАКИМ полем запроса. Поэтому маркеры ищутся по сериализованному конфигу
 * целиком: заголовки, url, params, data.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { setAccessToken } from '@/lib/api'
import { creditApi, creditHttp } from '../creditApi'

const STORED_KEY = 'credit.stand.apiKey'
const STORED_ROLE = 'credit.stand.role'
/**
 * Ключ, под которым CRM держит пропуск оператора, — `TOKEN_KEY` в
 * `src/lib/api.ts`. Раньше здесь стояло `access_token`: это имя поля в ТЕЛЕ
 * ответа логина, а не ключ хранилища, и под ним в браузере не лежит ничего.
 * «Запрос уносит пропуск» проверялось, стало быть, на токене, которого в CRM
 * не бывает (#1213). Модуль спрашивает токен у `getAccessToken()` — тест сеет
 * его туда же, откуда помощник его берёт.
 */
const CRM_TOKEN_KEY = 'prionex_token'

/**
 * Маркеры-пустышки. Оба СИНТЕТИЧЕСКИЕ и не значат ничего нигде: значение
 * секрета сеет сам тест, поэтому живое умолчание портального ключа модуля
 * здесь не нужно, а в логах упавшего прогона и в истории репозитория оно
 * оказалось бы настоящим ключом DEV-стенда.
 */
const PLANTED_SECRET = 'planted-not-a-real-key-6h'
const PLANTED_ROLE = 'planted-role-6h'

/**
 * Ловит ВСЕ конфиги, ушедшие в транспорт за время вызова.
 *
 * Адаптер обязан восстанавливаться в `finally`: сюита с 16.09.2026 идёт
 * параллельно, но `creditHttp` — модульный синглтон, и незакрытая подмена
 * уехала бы в соседний файл того же воркера. Если своего адаптера у инстанса
 * не было, его надо СНЯТЬ, а не записать `undefined`: записанный `undefined`
 * — это «адаптера нет», и axios перестаёт выбирать транспорт по умолчанию.
 */
function captureRequests(): { seen: InternalAxiosRequestConfig[]; restore: () => void } {
  const seen: InternalAxiosRequestConfig[] = []
  const hadPrevious = 'adapter' in creditHttp.defaults
  const previous = creditHttp.defaults.adapter
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config)
    return {
      // `documentContent` просит `responseType: 'blob'`; пустой объект его
      // устраивает — тело мы не читаем, читаем заголовки ЗАПРОСА.
      data: {} as never,
      status: 200,
      statusText: 'OK',
      headers: config.headers,
      config,
    }
  }
  creditHttp.defaults.adapter = adapter
  return {
    seen,
    restore: () => {
      if (hadPrevious) creditHttp.defaults.adapter = previous
      else delete creditHttp.defaults.adapter
    },
  }
}

/**
 * Перебор по ВСЕМ экспортированным методам: имя и вызов с минимально
 * валидными аргументами. Равенство этого перечня экспорту `creditApi`
 * проверяется отдельным случаем ДО перебора — иначе усохший список молча
 * сузил бы всё, что ниже.
 */
const CALLS: Array<{ name: string; invoke: () => Promise<unknown> }> = [
  { name: 'overview', invoke: () => creditApi.overview() },
  { name: 'applications', invoke: () => creditApi.applications({}) },
  { name: 'application', invoke: () => creditApi.application('a1') },
  { name: 'applicationDocuments', invoke: () => creditApi.applicationDocuments('a1') },
  { name: 'underwritingQueue', invoke: () => creditApi.underwritingQueue('pending') },
  { name: 'switches', invoke: () => creditApi.switches() },
  {
    name: 'setSwitch',
    invoke: () => creditApi.setSwitch('crm_section', { enabled: true }, 'idem-1'),
  },
  {
    name: 'decide',
    invoke: () => creditApi.decide('a1', { outcome: 'approved', rationale: 'r' }),
  },
  { name: 'loans', invoke: () => creditApi.loans({}) },
  // Дверь карточки клиента CRM (WS-11): её вызов уносит id клиента, и уже
  // поэтому обязан быть в переборе — иначе первый же метод, добавленный мимо
  // этого списка, уносил бы служебный ключ незамеченным.
  { name: 'clientLoans', invoke: () => creditApi.clientLoans(42) },
  { name: 'loan', invoke: () => creditApi.loan('l1') },
  { name: 'products', invoke: () => creditApi.products() },
  { name: 'parameters', invoke: () => creditApi.parameters() },
  { name: 'loanState', invoke: () => creditApi.loanState('l1') },
  { name: 'loanSchedule', invoke: () => creditApi.loanSchedule('l1') },
  { name: 'loanScheduleVersions', invoke: () => creditApi.loanScheduleVersions('l1') },
  // Дважды: у двери журнала своя ветка сборки query (`journalQuery`), и вызов
  // с одним `loanId` до неё не доходит — запрос с отбором остался бы вне перебора.
  {
    name: 'loanJournal',
    invoke: async () => {
      await creditApi.loanJournal('l1')
      return creditApi.loanJournal('l1', { bucket: 'principal', as_of: '2026-09-01' })
    },
  },
  { name: 'loanDocuments', invoke: () => creditApi.loanDocuments('l1') },
  { name: 'documentContent', invoke: () => creditApi.documentContent('d1') },
]

/** Весь запрос одной строкой: заголовки, адрес, параметры, тело. */
function serialiseRequest(config: InternalAxiosRequestConfig): string {
  return JSON.stringify({
    headers: config.headers.toJSON(),
    url: config.url,
    params: config.params,
    data: config.data,
  })
}

/** Один запрос: только пропуск и ничего служебного НИ В КАКОМ поле. */
function expectPassOnly(config: InternalAxiosRequestConfig, where: string): void {
  expect(config.headers.get('Authorization'), where).toBe('Bearer pass-token')
  expect(config.headers.get('X-Operator-Role'), where).toBeFalsy()
  expect(config.headers.get('X-Internal-Api-Key'), where).toBeFalsy()
  const wire = serialiseRequest(config)
  // Ни значение ключа, ни значение роли не уходят НИ ПОД КАКИМ именем и ни в
  // каком поле запроса — в том числе `params`, `url` и теле.
  expect(wire, `${where}: ключ стенда ушёл в запрос`).not.toContain(PLANTED_SECRET)
  expect(wire, `${where}: роль стенда ушла в запрос`).not.toContain(PLANTED_ROLE)
}

/** Сеет пропуск и мусор прежней схемы в ОБЕ точки хранения. */
function seedPassAndJunk(): void {
  window.localStorage.setItem(CRM_TOKEN_KEY, 'pass-token')
  // Ключ модуль чистил и в session-, и в localStorage — сеем в обе, иначе
  // утечка из второй точки прошла бы мимо.
  window.sessionStorage.setItem(STORED_KEY, PLANTED_SECRET)
  window.localStorage.setItem(STORED_KEY, PLANTED_SECRET)
  window.localStorage.setItem(STORED_ROLE, PLANTED_ROLE)
}

function resetAuthState(): void {
  window.localStorage.clear()
  window.sessionStorage.clear()
  // Гасим и копию токена в памяти `lib/api`: иначе соседний случай увидит
  // чужой токен и «пустое хранилище» перестанет быть пустым.
  setAccessToken(null)
}

describe('пропуск оператора — единственный канал кредитного модуля', () => {
  beforeEach(resetAuthState)
  afterEach(resetAuthState)

  it('перебор охватывает ВСЕ экспортированные методы', () => {
    // Контроль от пустой выборки, и он идёт ПЕРВЫМ: всё, что ниже, проверяет
    // ровно этот перечень, поэтому его равенство экспорту должно быть
    // установлено до, а не после. Норма даёт «≥ 16» нижней границей;
    // равенство туже и не даёт выборке усохнуть молча, когда у `creditApi`
    // появится девятнадцатый метод.
    expect(CALLS.map((call) => call.name).sort()).toEqual(Object.keys(creditApi).sort())
  })

  it('каждый вызов уносит Bearer и НИЧЕГО служебного', async () => {
    seedPassAndJunk()

    const { seen, restore } = captureRequests()
    const captured: Array<{ name: string; config: InternalAxiosRequestConfig }> = []
    try {
      for (const call of CALLS) {
        const before = seen.length
        // Исход вызова утверждается: проглоченное исключение неотличимо от
        // прохода, и метод, упавший до транспорта, иначе выглядел бы проверенным.
        await expect(call.invoke(), `${call.name}: вызов не должен бросать`).resolves.toBeDefined()
        const mine = seen.slice(before)
        // Связь «метод ↔ запрос» именная: суммарный счётчик её не даёт —
        // один метод мог уйти дважды, а другой не дойти до транспорта вовсе.
        expect(
          mine.length,
          `${call.name}: ни одного запроса не дошло до транспорта`
        ).toBeGreaterThanOrEqual(1)
        for (const config of mine) captured.push({ name: call.name, config })
      }
    } finally {
      restore()
    }

    expect(captured.length).toBeGreaterThanOrEqual(CALLS.length)
    for (const { name, config } of captured) {
      expectPassOnly(config, `${name} → ${String(config.url)}`)
    }
  })

  it('вызовы с собственными заголовками — тоже', async () => {
    // Прицельно `setSwitch` и `decide`: их `headers` идут МИМО интерцептора,
    // и прежняя форма файла их не видела вовсе.
    seedPassAndJunk()

    const { seen, restore } = captureRequests()
    try {
      await creditApi.setSwitch('crm_section', { enabled: true }, 'idem-1')
      await creditApi.decide('a1', { outcome: 'approved', rationale: 'r' })
    } finally {
      restore()
    }

    expect(seen).toHaveLength(2)
    seen.forEach((config, index) => expectPassOnly(config, `вызов #${index}`))
    // Положительный контроль: собственные заголовки у этих вызовов ЕСТЬ и
    // доходят до транспорта. Без него «служебных заголовков нет» было бы
    // зелёным и в мире, где per-call `headers` вообще теряются, — то есть
    // проверкой пустого множества.
    expect(seen[0].headers.get('Idempotency-Key')).toBe('idem-1')
    expect(String(seen[1].headers.get('Idempotency-Key'))).toContain('fe-decision:a1')
  })

  it('интерцептор чист даже при мусоре в хранилище', async () => {
    // Сохранённый случай прежнего файла: проверка на уровне интерцептора.
    // Ценность отдельно от перебора — он краснеет и тогда, когда служебный
    // заголовок вернулся в интерцептор, а перечень `CALLS` кто-то усёк.
    seedPassAndJunk()

    const handlers = (
      creditHttp.interceptors.request as unknown as {
        handlers: Array<{
          fulfilled: (c: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
        } | null>
      }
    ).handlers.filter(Boolean)
    expect(handlers.length).toBeGreaterThan(0)

    const config = handlers.reduce((acc, handler) => handler!.fulfilled(acc), {
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig)

    expectPassOnly(config, 'интерцептор')
  })

  it('стирает ключ и роль, оставшиеся с прежних сессий', async () => {
    // ⚠️ Модуль импортируется ЗАНОВО уже после посева секретов: уборка идёт
    // НА ИМПОРТЕ (`purgeStandCredentials` в `creditApi.ts` зовётся на верхнем
    // уровне модуля), и без `resetModules` + повторного `import` отработал бы
    // импорт в шапке этого файла — то есть раньше теста. Чистить было бы
    // нечего, а случай стал бы зелёным на пустом множестве.
    vi.resetModules()
    // Посев ЯВНЫЙ, а не через общий помощник: этот случай о самой уборке, и
    // из него должно быть видно, что именно лежало в хранилище до импорта.
    window.sessionStorage.setItem(STORED_KEY, PLANTED_SECRET)
    window.localStorage.setItem(STORED_KEY, PLANTED_SECRET)
    window.localStorage.setItem(STORED_ROLE, PLANTED_ROLE)
    window.localStorage.setItem(CRM_TOKEN_KEY, 'pass-token')

    await import('../creditApi')

    expect(window.sessionStorage.getItem(STORED_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORED_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORED_ROLE)).toBeNull()
    // Уборка прицельная: пропуск оператора она трогать не должна.
    expect(window.localStorage.getItem(CRM_TOKEN_KEY)).toBe('pass-token')
  })
})
