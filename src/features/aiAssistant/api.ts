import { api, API_BASE_URL, getAccessToken } from '@/lib/api'
import type { ChatAttachmentPayload } from './attachments'
import {
  consumeSseStream,
  type AssistantCitation,
  type AssistantExpertUsage,
  type AssistantSources,
  type AssistantToolEnd,
  type AssistantToolStart,
  type SseDonePayload,
  type SseErrorPayload,
  type SseMetaPayload,
  type SseSessionPayload,
} from './sse'

const BASE = '/api/v1/ai-assistant'

export type AssistantResponseMode = 'short' | 'detailed'
export type AssistantOutputFormat = 'text' | 'tableFirst' | 'mixed'
/**
 * Reasoning depth (ASSISTANT_MODES.md): `fast` (default, 26B) answers quickly;
 * `thinking` (31B) reasons deeper but is slower and may be temporarily
 * unavailable (503) — callers then fall back to `fast`.
 */
export type AssistantMode = 'fast' | 'thinking'

/**
 * Экспертный ход: вопрос уходит НЕ на наш бокс, а во внешний сервис (Claude от
 * Anthropic) — на наших данных. Доступен только руководителю; у оператора
 * пункта меню нет вовсе (см. {@link getAssistantCapabilities}).
 *
 * `model` намеренно строка, а не объединение литералов: список моделей приходит
 * с бэкенда (`capabilities.models`), и добавление новой модели там не должно
 * требовать релиза фронта.
 */
export interface AssistantExpertRequest {
  model: string
}

export interface AssistantChatRequest {
  /** May be empty when an `audio` attachment carries the message (PR #638). */
  message: string
  conversation_id?: number
  /** Reasoning depth; sent with every request. */
  mode: AssistantMode
  response_mode: AssistantResponseMode
  output_format: AssistantOutputFormat
  /**
   * Deep-research flag: when true the brain runs a thorough multi-agent
   * analysis. Sent only when enabled; the gateway ignores the field until it
   * ships support, so it is safe to send today (forward-compatible).
   */
  deep_research?: boolean
  /**
   * Раздумья 31B: `true` — «думающий» ход рассуждает вслух, `false` — отвечает
   * сразу, без хода рассуждения (быстрее). Поле уходит ТОЛЬКО у thinking-хода;
   * fast и экспертный запросы остаются байт-в-байт прежними. Forward-compatible,
   * как и `deep_research` выше: у ChatRequest `extra="ignore"` (не `forbid`),
   * поэтому прокси, ещё не знающий поля, его МОЛЧА игнорирует и отвечает 200 — а
   * не 422. «Сервер не применил мой флаг» видно по `done.thinking_used`, не по
   * отказу; повтора запроса нет.
   */
  thinking?: boolean
  /**
   * Images (screenshot paste), documents (pdf/xlsx/xls/csv) and/or one voice
   * note; at most {@link MAX_ATTACHMENTS} in total.
   */
  attachments?: ChatAttachmentPayload[]
  /**
   * Экспертный ход через внешний Claude. Поле шлётся ТОЛЬКО когда руководитель
   * выбрал экспертный режим и бэкенд подтвердил доступ; обычный ход уходит без
   * него, как раньше.
   */
  expert?: AssistantExpertRequest
}

export interface AssistantToolCall {
  tool_name: string
  success: boolean
}

export interface AssistantChatResponse {
  conversation_id: number
  message_id: number
  response: string
  coverage_flag: string | null
  tool_calls: AssistantToolCall[]
  /** Per-fact citations streamed in the `citations` frame (empty if none). */
  citations?: AssistantCitation[]
  /**
   * Расход экспертного хода (модель + стоимость + токены) — блок `expert` в
   * `done`. Есть только у экспертных ходов; обычный возвращает `undefined`.
   */
  expert?: AssistantExpertUsage
}

export interface AssistantConversationSummary {
  id: number
  user_id: number
  project_id: number
  channel: string
  status: string
  /** Human-readable name; null until the user renames the chat (fallback: "Chat #id"). */
  title: string | null
  pinned: boolean
  archived: boolean
  created_at: string
  last_message_at: string | null
}

export interface AssistantConversationMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  model: string | null
  latency_ms: number | null
  tokens: number | null
  created_at: string
  /**
   * Слой 5: раздумья ассистентского сообщения (те же `reasoning`-дельты, что в
   * стриме, но уже склеенные сервером) — чтобы панель «Активность» гидратировалась
   * после F5 / переключения диалога, а не жила только в текущем ходе. Есть только
   * у `role === 'assistant'`; старый бэкенд поле не шлёт (панель мягко деградирует).
   */
  reasoning?: string
  /**
   * Слой 5: источники факт-сносок `[[N]]` этого сообщения (та же форма, что во
   * фрейме `citations` стрима — документированный конверт `{items:[...]}`). Даёт
   * кликабельные сноски и секцию «Источники» в панели для загруженного из истории
   * диалога. Опционально — как {@link reasoning}.
   *
   * Сырой payload бэкенда (конверт `{items:[...]}` или, у старого бэкенда, голый
   * массив/`null`) — форму приводит клиент через {@link normalizeCitations} при
   * гидратации, поэтому тип намеренно `unknown`: `AssistantCitation[]` здесь врал
   * бы про реальный контракт и снова спрятал бы `.map is not a function`.
   */
  citations?: unknown
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: AssistantConversationMessage[]
}

export interface AssistantConversationsFilters {
  limit?: number
  offset?: number
  archived?: boolean
}

/** PATCH /conversations/{id} body — only the provided fields are changed. */
export interface AssistantConversationPatch {
  title?: string
  pinned?: boolean
  archived?: boolean
}

export type AssistantFeedbackRating = 'useful' | 'not_useful'
export type AssistantFeedbackComprehension = 'clear' | 'unclear'

export interface AssistantFeedbackRequest {
  message_id: number
  rating?: AssistantFeedbackRating
  comprehension?: AssistantFeedbackComprehension
  comment?: string
}

/**
 * Streaming callbacks for {@link sendChatMessage}. Every field is optional so
 * callers subscribe only to the events they render. `onText` deltas arrive in
 * order and must be accumulated to form the full answer.
 */
export interface SendChatMessageCallbacks {
  /**
   * CRM `meta` — id строки диалога, приходит ПЕРВЫМ кадром. Страница по нему
   * сохраняет указатель диалога сразу, а не после `done`: обновление страницы
   * посреди длинного ответа иначе теряло диалог (ответ дописывается на
   * сервере и без указателя его негде показать).
   */
  onMeta?: (meta: SseMetaPayload) => void
  onSession?: (payload: SseSessionPayload) => void
  onText?: (delta: string) => void
  /** Reasoning deltas ("Ход рассуждения"); forwarded, never part of the answer. */
  onReasoning?: (delta: string) => void
  onSources?: (sources: AssistantSources) => void
  /** Per-fact citations (`citations` frame) — labels for `[[N]]` footnotes. */
  onCitations?: (citations: AssistantCitation[]) => void
  /** Follow-up questions (the `questions[]` array of the followups frame). */
  onFollowups?: (questions: string[]) => void
  onToolStart?: (tool: AssistantToolStart) => void
  onToolEnd?: (tool: AssistantToolEnd) => void
  /** Расход экспертного хода (блок `expert` в `done`) — модель, деньги, токены. */
  onExpert?: (usage: AssistantExpertUsage) => void
  onError?: (error: SseErrorPayload) => void
  onDone?: (payload: SseDonePayload) => void
}

/**
 * Error thrown when the chat stream terminates with an in-band `event: error`
 * frame. `status` mirrors an HTTP status when the gateway tunnels one (e.g. a
 * 503 from the thinking model), so the UI can apply the same fallback it would
 * for an HTTP 503.
 */
export class AssistantChatStreamError extends Error {
  readonly status?: number
  readonly code?: string
  /**
   * The server's own wording, when it sent any. Kept apart from `message`
   * (which falls back to a generic English string) so the UI can tell "the
   * server explained the rejection" from "the request just failed" — a
   * rejected attachment must surface the backend's text, not «щось пішло не
   * так».
   */
  readonly serverDetail?: string

  constructor(payload: SseErrorPayload) {
    super(payload.message ?? 'Assistant stream error')
    this.name = 'AssistantChatStreamError'
    this.status = payload.status
    this.code = payload.code
    this.serverDetail = payload.message?.trim() || undefined
  }
}

/** The chat refuses a turn whose attachments are too large *in total* with this code. */
export const ATTACHMENTS_TOTAL_TOO_LARGE = 'attachments_total_too_large'

/**
 * The readable text and the machine code inside an error body. Three shapes
 * arrive here, and only the first is the obvious one:
 *
 * - `detail` as a plain string — the service's own `HTTPException`;
 * - `detail` as a **list** of `{msg, loc}` — FastAPI's answer to a schema
 *   violation, which rendered naively shows the operator "[object Object]";
 * - `detail` as an object `{code, message, …}` — a refusal the service wants
 *   the client to be able to tell apart, e.g. the total-attachments cap
 *   ({@link ATTACHMENTS_TOTAL_TOO_LARGE}). Its `message` is already written for
 *   the operator, so it is shown as it stands.
 */
export function extractErrorDetail(body: unknown): {
  message?: string
  code?: string
} {
  if (!body || typeof body !== 'object') return {}
  const raw = (body as { detail?: unknown }).detail
  const detail = raw ?? (body as { message?: unknown }).message
  const clean = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined

  if (typeof detail === 'string') return { message: clean(detail) }

  // `message` is the structured-refusal wording, `msg` is FastAPI's per-field one.
  const readItem = (item: unknown): string | undefined => {
    if (typeof item === 'string') return clean(item)
    const entry = item as { message?: unknown; msg?: unknown } | null
    return clean(entry?.message) ?? clean(entry?.msg)
  }

  if (Array.isArray(detail)) {
    const parts = detail.map(readItem).filter((part): part is string => Boolean(part))
    return {
      message: parts.length > 0 ? parts.join('; ') : undefined,
    }
  }

  return {
    message: readItem(detail),
    code: clean((detail as { code?: unknown } | null)?.code),
  }
}

/**
 * Send a chat message and stream the SSE answer.
 *
 * Transport is `fetch` + `ReadableStream` (native `EventSource` cannot POST a
 * JSON body with an Authorization header). The request body still carries
 * `message` / `mode` / `attachments` / `conversation_id` as before. Text deltas
 * are pushed through `callbacks.onText`; the returned promise resolves with the
 * assembled {@link AssistantChatResponse} once the `done` frame arrives, so
 * existing non-streaming call sites keep working unchanged.
 *
 * @throws {AssistantChatStreamError} when the stream ends with `event: error`.
 */
export async function sendChatMessage(
  payload: AssistantChatRequest,
  callbacks: SendChatMessageCallbacks = {}
): Promise<AssistantChatResponse> {
  const token = getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${BASE}/chat`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  // HTTP-level failure (e.g. 503 before the stream starts, 422 image-only,
  // 413 from the proxy when an attachment exceeds the body limit — the latter
  // answers with HTML, hence the tolerant parsing).
  if (!response.ok) {
    let message: string | undefined
    let code: string | undefined
    try {
      ;({ message, code } = extractErrorDetail(await response.json()))
    } catch {
      /* non-JSON error body — the caller falls back to a status-based text */
    }
    throw new AssistantChatStreamError({ status: response.status, message, code })
  }

  if (!response.body) {
    throw new AssistantChatStreamError({ message: 'Empty assistant response stream' })
  }

  let accumulatedText = ''
  // The contract identifies the dialog by `session_id`; it is the same value
  // the request sends as `conversation_id`, so it maps onto the existing
  // `AssistantChatResponse.conversation_id` field (ASSISTANT_MODES.md §4).
  let conversationId = payload.conversation_id ?? 0
  const toolCalls: AssistantToolCall[] = []
  let citations: AssistantCitation[] = []
  let expert: AssistantExpertUsage | undefined
  let streamError: SseErrorPayload | null = null

  const applySessionId = (value: number | string | undefined) => {
    if (typeof value === 'number') {
      conversationId = value
    } else if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      conversationId = Number(value)
    }
  }

  const outcome = await consumeSseStream(response.body, {
    // CRM `meta` — авторитетный id строки диалога. Читать его ОБЯЗАТЕЛЬНО:
    // `session.session_id` ниже приходит от «мозга» и содержит его внутренний
    // ключ (hex-строка вида `06a76d1f72744d79`), а не id записи. Number() от
    // такой строки — NaN, поэтому id оставался 0, следующий ход уходил с
    // `conversation_id: 0`, прокси такой диалог не находил и отвечал 404
    // «Асистент зараз недоступний» (живой баг прода 20.08.2026: воспроизводился
    // на ЛЮБОМ втором сообщении и при клике по кнопке-уточнению).
    onMeta: (meta) => {
      applySessionId(meta.conversation_id)
      callbacks.onMeta?.(meta)
    },
    onSession: (session) => {
      applySessionId(session.session_id)
      callbacks.onSession?.(session)
    },
    onText: (delta) => {
      accumulatedText += delta
      callbacks.onText?.(delta)
    },
    // Reasoning is the agent's thinking, not the answer — forward it without
    // touching `accumulatedText` so the resolved `response` stays clean.
    onReasoning: (delta) => callbacks.onReasoning?.(delta),
    onSources: (sources) => callbacks.onSources?.(sources),
    onCitations: (items) => {
      citations = items
      callbacks.onCitations?.(items)
    },
    onFollowups: (questions) => callbacks.onFollowups?.(questions),
    onToolStart: (tool) => {
      // Pre-record the call as pending; a matching tool_end flips `success`.
      toolCalls.push({ tool_name: tool.name, success: false })
      callbacks.onToolStart?.(tool)
    },
    onToolEnd: (tool) => {
      // Settle the most recent still-pending call (no name in tool_end).
      const pending = [...toolCalls].reverse().find((call) => !call.success)
      if (pending) pending.success = tool.ok
      callbacks.onToolEnd?.(tool)
    },
    onExpert: (usage) => {
      expert = usage
      callbacks.onExpert?.(usage)
    },
    onError: (error) => {
      streamError = error
      callbacks.onError?.(error)
    },
    onDone: (done) => {
      applySessionId(done.session_id)
      callbacks.onDone?.(done)
    },
  })

  if (outcome === 'error' && streamError) {
    throw new AssistantChatStreamError(streamError)
  }

  return {
    conversation_id: conversationId,
    // The streamed `done` frame carries no per-message id (ASSISTANT_MODES.md
    // §4 — only session_id + usage). 0 signals "unknown"; the real id is
    // learned on conversation hydration, which is what gates the feedback UI.
    message_id: 0,
    response: accumulatedText,
    coverage_flag: null,
    tool_calls: toolCalls,
    citations,
    expert,
  }
}

/* -------------------------------------------------------------------------
 * Экспертный режим: что доступно этому сотруднику
 * ------------------------------------------------------------------------- */

/**
 * Разрешения и бюджет экспертного режима для текущего сотрудника.
 *
 * `enabled` — включён ли режим вообще (флаг на бэкенде), `allowed` — можно ли
 * ИМЕННО этому пользователю (роль). Пункт меню показывается только когда обе
 * истинны: у оператора его быть не должно вовсе.
 *
 * `dailyLimitUsd` / `spentTodayUsd` — `null`, когда бэкенд их не прислал (или
 * прислал мусор): счётчик остатка тогда просто не рисуем, а не показываем «$0».
 */
/**
 * Машинный код причины отказа (`reason_code`). Приходит парой с текстом
 * `reason` и только при `allowed=false`.
 *
 * Прятать пункт правильно лишь при `role`/`disabled`; при `limit` и
 * `unavailable` он обязан остаться на виду с объяснением — иначе у
 * руководителя, исчерпавшего дневной бюджет, режим молча исчезает.
 *
 * Тип намеренно шире четырёх известных значений: новый код на бэкенде не
 * должен ломать сборку, а трактуется он консервативно — как «прятать».
 */
export type AssistantExpertReasonCode = 'role' | 'limit' | 'unavailable' | 'disabled'

export interface AssistantExpertCapability {
  enabled: boolean
  allowed: boolean
  /** Модели, которые бэкенд готов принять в `expert.model` (порядок сохраняем). */
  models: string[]
  dailyLimitUsd: number | null
  spentTodayUsd: number | null
  /** Текст причины отказа для человека (украинский); `null` при `allowed=true`. */
  reason: string | null
  /** Код причины отказа для кода; `null` при `allowed=true` или у старого бэкенда. */
  reasonCode: AssistantExpertReasonCode | string | null
}

/**
 * Причины, при которых пункт остаётся видимым (погашенным) с объяснением.
 * Всё остальное — включая незнакомый код — прячем: показать пункт, смысла
 * которого мы не понимаем, хуже, чем не показать.
 */
export const SOFT_DENIED_REASON_CODES: readonly string[] = ['limit', 'unavailable']

export interface AssistantCapabilities {
  expert: AssistantExpertCapability
}

/** Экспертный режим выключен — безопасный ответ на любой отказ/мусор. */
export const EXPERT_CAPABILITY_OFF: AssistantExpertCapability = {
  enabled: false,
  allowed: false,
  models: [],
  dailyLimitUsd: null,
  spentTodayUsd: null,
  reason: null,
  reasonCode: null,
}

/** Деньги из ответа: число (или числовая строка) ≥ 0, иначе «поля нет». */
function normalizeUsdAmount(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : null
}

/**
 * Привести ответ `GET /capabilities` к {@link AssistantCapabilities}.
 *
 * Разбор намеренно недоверчивый: доступ к платному внешнему сервису включается
 * ТОЛЬКО явным `true` в обоих флагах и непустым списком моделей. Любая другая
 * форма ответа (старый бэкенд без этого раздела, `null`, строка «true», пустой
 * `models`) означает «режима нет» — пункт меню не появляется, а не появляется
 * сломанным.
 *
 * Ключ раздела читается и как `expert_mode` (контракт), и как `expert` — чтобы
 * расхождение в имени не выглядело как «фронт не показывает пункт».
 */
export function normalizeCapabilities(payload: unknown): AssistantCapabilities {
  const root = (payload ?? {}) as Record<string, unknown>
  const raw = (root.expert_mode ?? root.expert) as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') return { expert: EXPERT_CAPABILITY_OFF }

  const models = Array.isArray(raw.models)
    ? raw.models.filter(
        (model): model is string => typeof model === 'string' && model.trim() !== ''
      )
    : []

  const cleanText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null

  return {
    expert: {
      enabled: raw.enabled === true,
      allowed: raw.allowed === true,
      models,
      dailyLimitUsd: normalizeUsdAmount(raw.daily_limit_usd),
      spentTodayUsd: normalizeUsdAmount(raw.spent_today_usd),
      reason: cleanText(raw.reason),
      reasonCode: cleanText(raw.reason_code),
    },
  }
}

/**
 * `GET /capabilities` — что доступно сотруднику в окне ассистента.
 *
 * Отказ (403/404 у бэкенда без этого маршрута, сеть) обрабатывает вызывающий
 * хук: экран ассистента обязан работать и без capabilities — просто без
 * экспертного пункта.
 */
export async function getAssistantCapabilities(): Promise<AssistantCapabilities> {
  const response = await api.get<unknown>(`${BASE}/capabilities`)
  return normalizeCapabilities(response.data)
}

export async function getConversations(
  filters: AssistantConversationsFilters = {}
): Promise<AssistantConversationSummary[]> {
  const params = new URLSearchParams()
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  if (filters.archived != null) params.set('archived', String(filters.archived))
  const response = await api.get<AssistantConversationSummary[]>(`${BASE}/conversations`, {
    params,
  })
  return response.data
}

export async function updateConversation(
  id: number,
  patch: AssistantConversationPatch
): Promise<AssistantConversationSummary> {
  const response = await api.patch<AssistantConversationSummary>(
    `${BASE}/conversations/${id}`,
    patch
  )
  return response.data
}

export async function getConversation(id: number): Promise<AssistantConversationDetail> {
  const response = await api.get<AssistantConversationDetail>(`${BASE}/conversations/${id}`)
  return response.data
}

export async function sendFeedback(payload: AssistantFeedbackRequest): Promise<void> {
  await api.post(`${BASE}/feedback`, payload)
}

/** Вердикт пометки источника факт-сноски оператором (Слой 5). */
export type AssistantCitationVerdict = 'ok' | 'wrong'

/**
 * Тело `POST /messages/{message_id}/step-mark` — оператор помечает источник
 * факт-сноски как верный/неверный. `message_id` — серверный id ассистентского
 * сообщения (доступен после гидратации диалога); `citation_id` совпадает с
 * `AssistantCitation.id` (номер `[[N]]`).
 */
export interface AssistantMarkCitationRequest {
  message_id: number
  citation_id: number
  verdict: AssistantCitationVerdict
}

/**
 * Пометить источник факт-сноски (`POST /messages/{message_id}/step-mark`).
 * Образец — {@link sendFeedback}: fire-and-forget POST, оптимистичную подсветку
 * держит вызывающий (см. `useMarkCitation`).
 */
export async function markCitationStep({
  message_id,
  citation_id,
  verdict,
}: AssistantMarkCitationRequest): Promise<void> {
  await api.post(`${BASE}/messages/${message_id}/step-mark`, { citation_id, verdict })
}

/* -------------------------------------------------------------------------
 * Персональная память ассистента («Персоналізація»)
 * ------------------------------------------------------------------------- */

/**
 * Происхождение факта памяти:
 * `user` — сотрудник добавил руками, `agent` — мозг вывел из диалога,
 * `seed`/`profile` — наблюдение, засеянное при инициализации памяти,
 * `consolidated` — сводный факт, которым мозг схлопнул несколько похожих
 * записей при вытеснении по потолку.
 */
export type AssistantMemorySource = 'user' | 'agent' | 'seed' | 'profile' | 'consolidated'

/**
 * Факт, который ассистент помнит о сотруднике. Влияет на ответы, поэтому
 * оператор обязан видеть список целиком и уметь удалить лишнее.
 *
 * `source` намеренно шире {@link AssistantMemorySource}: бэкенд заводит новые
 * виды раньше фронта, и неизвестное значение должно давать нейтральный бейдж,
 * а не ломать рендер строки.
 */
export interface AssistantMemoryItem {
  id: number
  kind: string
  /** Подзаголовок; у старых записей может быть пустым. */
  title: string | null
  content: string
  source: AssistantMemorySource | string
  created_at: string
}

export interface AssistantMemoryList {
  items: AssistantMemoryItem[]
  total: number
  /**
   * Потолок активных записей скоупа. `null` — потолка нет: либо он выключен на
   * мозге, либо бэкенд ещё старый и поля не присылает. Для UI оба случая
   * означают одно — счётчик не рисуем.
   */
  limit: number | null
}

/**
 * Привести потолок из ответа к `number | null`.
 *
 * Потолком считается только положительное конечное число: `null`, отсутствие
 * поля и мусор одинаково означают «предела нет». Один разбор на оба экрана —
 * пользовательский список и админскую сводку по скоупам.
 */
export function normalizeMemoryLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Привести ответ списка к {@link AssistantMemoryList}.
 *
 * Контракт — конверт `{items, total, limit}`, но урок `citations` повторять не
 * хочется: голый массив (или пустое тело) от промежуточной версии бэкенда не
 * должен ронять панель на `.map is not a function`, а отсутствующий `limit` —
 * прятать список за счётчиком, которого нет.
 */
export function normalizeMemoryList(payload: unknown): AssistantMemoryList {
  if (Array.isArray(payload)) {
    return { items: payload as AssistantMemoryItem[], total: payload.length, limit: null }
  }
  const items = (payload as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return { items: [], total: 0, limit: null }
  const total = (payload as { total?: unknown }).total
  return {
    items: items as AssistantMemoryItem[],
    total: typeof total === 'number' ? total : items.length,
    limit: normalizeMemoryLimit((payload as { limit?: unknown }).limit),
  }
}

/** `GET /memory` — вся память текущего сотрудника (скоуп берётся из JWT). */
export async function getMemoryItems(): Promise<AssistantMemoryList> {
  const response = await api.get<unknown>(`${BASE}/memory`)
  return normalizeMemoryList(response.data)
}

export interface CreateAssistantMemoryRequest {
  title: string
  content: string
}

/**
 * `POST /memory` — добавить факт руками.
 *
 * Отказы, которые обязан прочитать оператор: **409** — похожая запись уже есть,
 * **422** — пусто либо персональные данные. Текст лежит в `detail`; достаётся
 * через {@link extractErrorDetail} (см. {@link classifyMemoryError}).
 *
 * Ответ — конверт `{item}`; голый объект тоже принимается по тем же
 * соображениям, что и в {@link normalizeMemoryList}.
 */
export async function createMemoryItem(
  payload: CreateAssistantMemoryRequest
): Promise<AssistantMemoryItem> {
  const response = await api.post<{ item?: AssistantMemoryItem } | AssistantMemoryItem>(
    `${BASE}/memory`,
    payload
  )
  const body = response.data as { item?: AssistantMemoryItem }
  return body?.item ?? (response.data as AssistantMemoryItem)
}

/** `DELETE /memory/{id}` — убрать факт из памяти ассистента. */
export async function deleteMemoryItem(id: number): Promise<void> {
  await api.delete(`${BASE}/memory/${id}`)
}

/** Классы отказов при добавлении факта — на каждый своя формулировка в UI. */
export type AssistantMemoryErrorKind = 'duplicate' | 'validation' | 'forbidden' | 'unknown'

export interface AssistantMemoryError {
  kind: AssistantMemoryErrorKind
  /** Текст сервера — есть у `duplicate`/`validation`, где он несёт причину. */
  message?: string
}

/**
 * Разобрать отказ `POST /memory`.
 *
 * 409 и 422 нельзя схлопывать в общее «что-то пошло не так»: в первом случае
 * оператор должен понять, что факт уже записан, во втором — что именно сервер
 * забраковал (PII), и переписать текст.
 */
export function classifyMemoryError(error: unknown): AssistantMemoryError {
  const response =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: unknown; data?: unknown } }).response
      : undefined
  const status = typeof response?.status === 'number' ? response.status : undefined
  const { message } = extractErrorDetail(response?.data)

  if (status === 409) return { kind: 'duplicate', message }
  if (status === 422 || status === 400) return { kind: 'validation', message }
  if (status === 403) return { kind: 'forbidden' }
  return { kind: 'unknown' }
}
