/**
 * HTTP-клиент кредитного модуля (credit-service).
 *
 * Отдельный инстанс, а не общий `@/lib/api`, по одной причине: у модуля свой
 * адрес и своя фаза интеграции. Локально запросы идут в credit-service на
 * :8020 (vite-прокси `/api/v1/credit`), на этапе 2 — тем же путём через Kong,
 * и тогда меняется ровно одна константа. Интерцептор авторизации ставим тот
 * же, что у CRM: на этапе 2 сервис будет принимать JWT пользователя.
 *
 * Правило 28: фронт разговаривает ТОЛЬКО с API модуля. Никаких обращений в
 * credit_db и никакой бизнес-логики здесь — только транспорт и адаптация
 * контрактных форм ответа.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type {
  CreditApplicationDetail,
  CreditApplicationsParams,
  CreditApplicationSummary,
  CreditDecision,
  CreditDocumentMeta,
  CreditJournalEntry,
  CreditLoanDetail,
  CreditLoanState,
  CreditLoanSummary,
  CreditLoansParams,
  CreditOverview,
  CreditPage,
  CreditParameter,
  CreditProduct,
  CreditQueueItem,
  CreditScheduleVersion,
  ManualDecisionPayload,
} from './types'

/**
 * База API модуля. Пусто = тот же origin (локально это vite-прокси, на этапе 2
 * — Kong). Отдельная переменная нужна, чтобы фронт можно было направить на
 * чужой стенд, не трогая общий VITE_API_BASE_URL.
 */
export const CREDIT_API_BASE_URL = import.meta.env.VITE_CREDIT_API_BASE_URL ?? ''

const CREDIT_PREFIX = '/api/v1/credit'

/**
 * Роль этапа 1: до JWT/RBAC (WS-20) credit-service разграничивает доступ
 * заголовком `X-Operator-Role`. Это МАКЕТ, а не защита — сервер всё равно
 * решает сам; заголовок лишь позволяет проверять раздел под разными ролями,
 * пока в CRM нет кредитных ролей. На этапе 2 строка удаляется вместе с
 * ключом стенда.
 */
const STAND_ROLE_STORAGE_KEY = 'credit.stand.role'
const STAND_KEY_STORAGE_KEY = 'credit.stand.apiKey'

function readSetting(storage: Storage | undefined, key: string): string {
  if (!storage) return ''
  try {
    return storage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

/**
 * Роль — не секрет: держим её в localStorage, чтобы не выбирать заново
 * каждую сессию.
 */
export function getStandRole(): string {
  if (typeof window === 'undefined') return 'underwriter'
  return readSetting(window.localStorage, STAND_ROLE_STORAGE_KEY) || 'underwriter'
}

export function setStandRole(role: string): void {
  try {
    window.localStorage.setItem(STAND_ROLE_STORAGE_KEY, role)
  } catch {
    /* приватный режим — роль просто не запомнится */
  }
}

/**
 * Сервисный ключ стенда — ТОЛЬКО sessionStorage.
 *
 * В localStorage он пережил бы закрытие вкладки и остался бы лежать на общей
 * машине, доступный любому same-origin скрипту или расширению. sessionStorage
 * умирает вместе с вкладкой (SEC L-02, 29.08). На этапе 2 ключа в браузере не
 * будет вовсе: авторизацию берёт на себя JWT CRM.
 */
export function getStandApiKey(): string {
  if (typeof window === 'undefined') return ''
  return readSetting(window.sessionStorage, STAND_KEY_STORAGE_KEY)
}

export function setStandApiKey(key: string): void {
  try {
    if (key) window.sessionStorage.setItem(STAND_KEY_STORAGE_KEY, key)
    else window.sessionStorage.removeItem(STAND_KEY_STORAGE_KEY)
    // Подчищаем ключ, если он остался в localStorage от прежних версий.
    window.localStorage.removeItem(STAND_KEY_STORAGE_KEY)
  } catch {
    /* см. выше */
  }
}

export const creditHttp = axios.create({
  baseURL: CREDIT_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

creditHttp.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = (() => {
    try {
      return window.localStorage.getItem('access_token')
    } catch {
      return null
    }
  })()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  // Этап 1 (см. комментарий выше): роль и ключ стенда.
  config.headers.set('X-Operator-Role', getStandRole())
  const standKey = getStandApiKey()
  if (standKey) config.headers.set('X-Internal-Api-Key', standKey)
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

function idempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  return `${prefix}:${random}`
}

export const creditApi = {
  /** Сводка стенда: счётчики по статусам и права текущей роли. */
  overview: () => get<CreditOverview>('/admin/overview'),

  applications: (params: CreditApplicationsParams) =>
    get<CreditPage<CreditApplicationSummary>>('/applications', {
      status: params.status,
      query: params.query || undefined,
      limit: params.limit ?? 25,
      cursor: params.cursor,
    }),

  application: (applicationId: string) =>
    get<CreditApplicationDetail>(`/applications/${applicationId}`),

  applicationDocuments: (applicationId: string) =>
    get<CreditPage<CreditDocumentMeta>>(`/applications/${applicationId}/documents`),

  underwritingQueue: (status?: 'pending' | 'in_review' | 'done') =>
    get<CreditPage<CreditQueueItem>>('/underwriting/queue', { status }),

  decide: (applicationId: string, payload: ManualDecisionPayload) =>
    post<CreditDecision>(`/applications/${applicationId}/decision`, payload, {
      'Idempotency-Key': idempotencyKey(`fe-decision:${applicationId}`),
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

  loanJournal: (loanId: string) => get<CreditPage<CreditJournalEntry>>(`/loans/${loanId}/journal`),

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
