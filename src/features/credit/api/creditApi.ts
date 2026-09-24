/**
 * HTTP-клиент кредитного модуля (credit-service).
 *
 * Отдельный инстанс, а не общий `@/lib/api`, по одной причине: у модуля свой
 * адрес. Куда именно уходит запрос, решает одна константа `CREDIT_API_BASE_URL`
 * ниже, а не рассказ в этом комментарии: пусто = тот же origin, что у CRM.
 * Интерцептор авторизации ставим тот же, что у CRM: модуль проверяет пропуск
 * оператора у самой CRM и берёт права из её ответа.
 *
 * Правило 28: фронт разговаривает ТОЛЬКО с API модуля. Никаких обращений в
 * credit_db и никакой бизнес-логики здесь — только транспорт и адаптация
 * контрактных форм ответа.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getAccessToken } from '@/lib/api'
import type {
  ClientLoanCardPage,
  ClientLoanCardParams,
  CreditApplicationDetail,
  CreditApplicationsParams,
  CreditApplicationSummary,
  CreditDecision,
  CreditDocumentMeta,
  CreditJournalEntry,
  CreditJournalParams,
  CreditLoanDetail,
  CreditLoanState,
  CreditLoanSummary,
  CreditLoansParams,
  CreditOverview,
  CreditPage,
  CreditParameter,
  CreditProduct,
  CreditQueueItem,
  CreditQueueStatus,
  CreditSwitchName,
  CreditSwitchPayload,
  CreditSwitchState,
  CreditScheduleVersion,
  ManualDecisionPayload,
} from './types'

/**
 * База API модуля. Пусто = тот же origin, что у CRM. Отдельная переменная
 * нужна, чтобы фронт можно было направить на чужой стенд, не трогая общий
 * VITE_API_BASE_URL.
 */
export const CREDIT_API_BASE_URL = import.meta.env.VITE_CREDIT_API_BASE_URL ?? ''

const CREDIT_PREFIX = '/api/v1/credit'

/**
 * Уборка за прежней схемой доступа.
 *
 * До перехода на пропуск браузер хранил служебный ключ модуля в
 * `sessionStorage`, а выбранную роль стенда — в `localStorage`. Ключа больше
 * никто не читает, но у всех, кто открывал раздел раньше, он ЛЕЖИТ в браузере
 * до сих пор: перестать отправлять секрет и убрать секрет с машины — разные
 * вещи. Стираем оба ключа при загрузке модуля, один раз.
 *
 * `credit.stand.apiKey` чистим и в session-, и в localStorage: в ранних
 * версиях он попадал во второй.
 */
function purgeStandCredentials(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem('credit.stand.apiKey')
    window.localStorage.removeItem('credit.stand.apiKey')
    window.localStorage.removeItem('credit.stand.role')
  } catch {
    /* приватный режим — хранилище недоступно, чистить нечего */
  }
}

purgeStandCredentials()

export const creditHttp = axios.create({
  baseURL: CREDIT_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

creditHttp.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  /**
   * Токен берём у самой CRM (`getAccessToken`), а не из хранилища напрямую.
   * До #1213 здесь читался ключ `access_token`, которого в приложении нет —
   * оно хранит JWT под `prionex_token`, — поэтому заголовок не уходил вовсе
   * и запросы модуля получали 401. Второй литерал ключа разошёлся бы с CRM
   * снова при первом же переименовании: источник должен быть один.
   */
  const token = getAccessToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  // ⚠️ Служебный ключ и роль отсюда УБРАНЫ. Модуль теперь проверяет пропуск
  // оператора у самой CRM (`POST /api/v1/auth/validate`) и берёт права из его
  // же тела — они там есть: `jwt_handler.py:123` кладёт `permissions` рядом с
  // `active_project_id` и `active_role_name`.
  //
  // Почему это не «упрощение», а закрытие двери. Пока браузер слал
  // `X-Internal-Api-Key`, ключ от всего модуля лежал в `sessionStorage` у
  // каждого, кто открыл раздел, — и любой, кто его знал, назначал себе роль
  // заголовком `X-Operator-Role` поверх настоящих прав. Роль приходит из
  // проверенного пропуска, а не из переключателя стенда.
  //
  // Служебный ключ у модуля остался — но только для служебных вызовов
  // (расписания, сверки) и стенда без CRM. Из браузера он не уходит вовсе.
  return config
})

/** Ошибка модуля в форме RFC 9457 (Problem), которую отдаёт credit-service. */
export class CreditApiError extends Error {
  readonly status?: number
  readonly code?: string
  readonly fields?: Array<{ field?: string; message?: string }>

  constructor(
    message: string,
    status?: number,
    code?: string,
    fields?: Array<{ field?: string; message?: string }>
  ) {
    super(message)
    this.name = 'CreditApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function toCreditError(error: unknown): CreditApiError {
  const axiosError = error as AxiosError<{
    title?: string
    detail?: string
    code?: string
    errors?: Array<{ field?: string; message?: string }>
  }>
  const payload = axiosError.response?.data
  return new CreditApiError(
    payload?.detail || payload?.title || axiosError.message || 'Ошибка кредитного модуля',
    axiosError.response?.status,
    payload?.code,
    payload?.errors
  )
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  try {
    const response = await creditHttp.get<T>(`${CREDIT_PREFIX}${path}`, {
      params,
      // Повторяемые параметры (?status=a&status=b) — форма контракта.
      paramsSerializer: { indexes: null },
    })
    return response.data
  } catch (error) {
    throw toCreditError(error)
  }
}

async function post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  try {
    const response = await creditHttp.post<T>(`${CREDIT_PREFIX}${path}`, body, { headers })
    return response.data
  } catch (error) {
    throw toCreditError(error)
  }
}

/**
 * Новый ключ идемпотентности.
 *
 * Функция МИНТИТ ключ, а не «выдаёт ключ запроса»: каждый вызов даёт новый.
 * Поэтому звать её на каждую отправку — значит выключить идемпотентность
 * совсем: повтор после сетевого таймаута придёт с другим ключом, и модуль
 * честно выполнит его во второй раз. Решать, сколько живёт ключ, обязан тот,
 * кто знает границы ДЕЙСТВИЯ пользователя, — то есть слой хуков, а не
 * транспорт. Отсюда и `export`.
 */
export function newIdempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  return `${prefix}:${random}`
}

/**
 * Query журнала: в объект попадают ТОЛЬКО заданные параметры.
 *
 * Ключ со значением `undefined` axios при сериализации отбросил бы, но тогда
 * «параметр не отправлен» проверялось бы поведением сериализатора, а не
 * содержимым запроса. Здесь это утверждение измеримо: нет значения — нет ключа.
 */
function journalQuery(params?: CreditJournalParams): Record<string, unknown> | undefined {
  if (!params) return undefined
  const query: Record<string, unknown> = {}
  if (params.bucket) query.bucket = params.bucket
  if (params.as_of) query.as_of = params.as_of
  return query
}

export const creditApi = {
  /** Сводка стенда: счётчики по статусам и права текущей роли. */
  overview: () => get<CreditOverview>('/admin/overview'),

  applications: (params: CreditApplicationsParams) =>
    get<CreditPage<CreditApplicationSummary>>('/applications', {
      status: params.status,
      query: params.query || undefined,
      sort: params.sort,
      limit: params.limit ?? 25,
      cursor: params.cursor,
    }),

  application: (applicationId: string) =>
    get<CreditApplicationDetail>(`/applications/${applicationId}`),

  applicationDocuments: (applicationId: string) =>
    get<CreditPage<CreditDocumentMeta>>(`/applications/${applicationId}/documents`),

  /**
   * Очередь ручного разбора.
   *
   * Кроме `status` ручка не принимает НИЧЕГО: `limit`, `cursor` и `sort` в её
   * сигнатуре отсутствуют и молча отбрасываются FastAPI (проверено живьём
   * 31.08.2026: `?limit=5` и `?sort=bogus` — оба 200 и все 31 строка, тогда
   * как `/applications?sort=bogus` честно отвечает 422). Поэтому здесь не
   * появляется параметров «на будущее»: объявленный параметр, который сервер
   * игнорирует, читается вызывающим как работающий.
   */
  underwritingQueue: (status?: CreditQueueStatus) =>
    get<CreditPage<CreditQueueItem>>('/underwriting/queue', { status }),

  /**
   * Положение рубильников и история переключений.
   *
   * Читаем именно эту ручку, а не демо-сводку: та отвечает 403 при выключенном
   * демо-режиме, и раздел, который в бою обязан знать, выключен ли он, узнавал
   * бы это только на стенде.
   */
  switches: () => get<CreditSwitchState>('/admin/switches'),

  /**
   * Переключить рубильник. Право есть только у риск-менеджера.
   *
   * Ключ идемпотентности приходит СНАРУЖИ и обязателен — параметра по
   * умолчанию здесь нет намеренно. История переключений физически append-only
   * и она же весь наш аудит: повтор после сетевого таймаута с новым ключом
   * навсегда оставил бы в ней вторую запись о переключении, которого не было.
   * Раньше ключ минтился прямо здесь, то есть на каждый вызов, — защита от
   * повтора не работала ни разу.
   */
  setSwitch: (name: CreditSwitchName, payload: CreditSwitchPayload, idempotencyKey: string) =>
    post<CreditSwitchState>(`/admin/switches/${name}`, payload, {
      'Idempotency-Key': idempotencyKey,
    }),

  decide: (applicationId: string, payload: ManualDecisionPayload) =>
    post<CreditDecision>(`/applications/${applicationId}/decision`, payload, {
      'Idempotency-Key': newIdempotencyKey(`fe-decision:${applicationId}`),
    }),

  /**
   * Список кредитов — `listInternalLoans` (контракт v0.1.6, `GET /loans`).
   *
   * Откат на демо-путь `/admin/loans` оставлен намеренно: стенд разработчика
   * может отставать от контракта на день, и раздел не должен из-за этого
   * показывать пустой экран. Когда все стенды обновятся — ветку удалить.
   */
  loans: async (params: CreditLoansParams): Promise<CreditPage<CreditLoanSummary>> => {
    const query = {
      status: params.status,
      query: params.query || undefined,
      dpd_min: params.dpd_min,
      dpd_max: params.dpd_max,
      disbursed_from: params.disbursed_from,
      disbursed_to: params.disbursed_to,
      sort: params.sort,
      limit: params.limit ?? 25,
      cursor: params.cursor,
    }
    try {
      return await get<CreditPage<CreditLoanSummary>>('/loans', query)
    } catch (error) {
      if (error instanceof CreditApiError && error.status === 404) {
        return get<CreditPage<CreditLoanSummary>>('/admin/loans', {
          ...query,
          status: params.status?.join(','),
        })
      }
      throw error
    }
  },

  /**
   * Кредиты клиента CRM — `listClientLoans` (дверь CM-L3, 14-18).
   *
   * Отдельная дверь, а не фильтр у `/loans`: портфельный список намеренно не
   * считает балансы (это реплей ядра на каждый кредит), а карточке клиента
   * деньги и просрочка нужны на каждой строке.
   *
   * 🔴 404 здесь — НЕ повод для отката на другой путь, в отличие от `loans`
   * выше. Пока у шлюза нет группы `clients` (API-L2, 14-20), 404 приходит от
   * ШЛЮЗА, и подменить его вторым запросом значит спрятать ровно тот факт,
   * который блок карточки обязан показать словами.
   *
   * `status` — одно значение: повторённый параметр дверь отвергает `422`.
   */
  clientLoans: (clientId: number, params?: ClientLoanCardParams) =>
    get<ClientLoanCardPage>(`/clients/${clientId}/loans`, { status: params?.status }),

  loan: (loanId: string) => get<CreditLoanDetail>(`/loans/${loanId}`),

  /** Каталог продуктов с версиями — право credit.products.read (risk_manager). */
  products: () => get<CreditPage<CreditProduct>>('/products'),

  /** Реестр параметров decision-engine — право credit.parameters.read. */
  parameters: () => get<CreditPage<CreditParameter>>('/parameters'),

  loanState: (loanId: string, asOf?: string) =>
    get<CreditLoanState>(`/loans/${loanId}/state`, { as_of: asOf }),

  loanSchedule: (loanId: string, version?: number) =>
    get<CreditScheduleVersion>(`/loans/${loanId}/schedule`, { version }),

  loanScheduleVersions: (loanId: string) =>
    get<CreditPage<CreditScheduleVersion>>(`/loans/${loanId}/schedule/versions`),

  /**
   * Журнал проводок. Отбор делает СЕРВЕР, и резать полученный массив нельзя:
   * `PAGE = 60` в карточке отрезает хвост ДО отбора, то есть «в корзине
   * проводок нет» означало бы «они за шестидесятой строкой».
   *
   * «Все корзины» = ключа `bucket` в запросе НЕТ. Ключ со значением
   * `undefined` не кладём, хотя сериализатор его и отбросил бы: утверждение
   * «параметр не отправлен» должно быть измеримо, а не держаться на поведении
   * axios (в отличие от соседних `loanState`/`loanSchedule`).
   *
   * Значение корзины дверь со словарём `LedgerBucket` НЕ сверяет — неизвестное
   * даёт 200 с пустым `items`, и опечатка выглядела бы как «в корзине пусто».
   * Поэтому значения берутся только из `CREDIT_BUCKETS`, а не пишутся строками.
   */
  loanJournal: (loanId: string, params?: CreditJournalParams) =>
    get<CreditPage<CreditJournalEntry>>(`/loans/${loanId}/journal`, journalQuery(params)),

  loanDocuments: (loanId: string) =>
    get<CreditPage<CreditDocumentMeta>>(`/loans/${loanId}/documents`),

  /**
   * Файл документа. Забираем blob'ом, а не ссылкой: ручке нужны заголовки
   * авторизации. Сервер сам решает inline/attachment — фронт эту политику не
   * переопределяет (загруженный клиентом файл недоверенный).
   */
  documentContent: async (documentId: string): Promise<{ blob: Blob; disposition: string }> => {
    try {
      const response = await creditHttp.get<Blob>(
        `${CREDIT_PREFIX}/admin/documents/${documentId}/content`,
        { responseType: 'blob' }
      )
      return {
        blob: response.data,
        disposition: String(response.headers['content-disposition'] ?? ''),
      }
    } catch (error) {
      throw toCreditError(error)
    }
  },
}
