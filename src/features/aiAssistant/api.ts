import { api, API_BASE_URL, getAccessToken } from '@/lib/api'
import type { ChatAttachmentPayload } from './attachments'
import {
  consumeSseStream,
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
  /** Images (screenshot paste) and/or one voice note; ≤3 total (PR #633/#638). */
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

  constructor(payload: SseErrorPayload) {
    super(payload.message ?? 'Assistant stream error')
    this.name = 'AssistantChatStreamError'
    this.status = payload.status
    this.code = payload.code
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

  // HTTP-level failure (e.g. 503 before the stream starts, 422 image-only).
  if (!response.ok) {
    let message: string | undefined
    try {
      const body = await response.json()
      message = body?.detail ?? body?.message
    } catch {
      /* non-JSON error body — fall back to status text */
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
