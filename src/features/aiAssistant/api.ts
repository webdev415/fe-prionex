import { api, API_BASE_URL, getAccessToken } from '@/lib/api'
import type { ChatAttachmentPayload } from './attachments'
import {
  consumeSseStream,
  type AssistantCitation,
  type AssistantSources,
  type AssistantToolEnd,
  type AssistantToolStart,
  type SseDonePayload,
  type SseErrorPayload,
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
   * Images (screenshot paste), documents (pdf/xlsx/xls/csv) and/or one voice
   * note; at most {@link MAX_ATTACHMENTS} in total.
   */
  attachments?: ChatAttachmentPayload[]
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

/**
 * Readable text out of an error body. FastAPI answers a schema violation with
 * `detail` as a **list** of `{msg, loc}` objects, so the naive `body.detail`
 * ends up rendered as "[object Object]" — that list is flattened here.
 */
export function extractErrorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const raw = (body as { detail?: unknown; message?: unknown }).detail
  const detail = raw ?? (body as { message?: unknown }).message
  if (typeof detail === 'string') return detail.trim() || undefined
  const readItem = (item: unknown): string | null => {
    if (typeof item === 'string') return item
    const msg = (item as { msg?: unknown } | null)?.msg
    return typeof msg === 'string' ? msg : null
  }
  if (Array.isArray(detail)) {
    const parts = detail.map(readItem).filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join('; ') : undefined
  }
  const single = readItem(detail)
  return single ?? undefined
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
    try {
      message = extractErrorDetail(await response.json())
    } catch {
      /* non-JSON error body — the caller falls back to a status-based text */
    }
    throw new AssistantChatStreamError({ status: response.status, message })
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
  let streamError: SseErrorPayload | null = null

  const applySessionId = (value: number | string | undefined) => {
    if (typeof value === 'number') {
      conversationId = value
    } else if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      conversationId = Number(value)
    }
  }

  const outcome = await consumeSseStream(response.body, {
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
  }
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
