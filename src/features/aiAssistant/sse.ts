/**
 * Server-Sent Events (SSE) helpers for the AI assistant chat stream.
 *
 * The backend proxy answers POST /api/v1/ai-assistant/chat with
 * `text/event-stream` instead of a single JSON body. Each frame is an
 * `event:` line followed by one or more `data:` lines and a blank-line
 * terminator; `data:` payloads are JSON. The stream ends with a `done`
 * (success) or `error` (failure) frame.
 *
 * Native `EventSource` cannot issue a POST with an Authorization header and a
 * JSON body, so the transport is `fetch` + `ReadableStream` (see api.ts). This
 * module owns the wire-format parsing so it can be unit-tested without a
 * network: `parseSseChunk` decodes raw text into frames; `dispatchSseEvent`
 * routes one frame to the right callback.
 *
 * Forward-compatibility is a hard requirement: the backend may add new event
 * types (todo / subagent_*). Unknown `event:` names MUST be ignored silently
 * rather than throwing, so the frontend keeps working against a newer backend.
 *
 * `reasoning {delta}` (the agent's streamed "thoughts", up to hundreds per turn)
 * is an explicit case routed to `onReasoning` — it powers the "Ход рассуждения"
 * panel. `todo` / `subagent_*` remain in the forward-compat ignore until the UI
 * grows to render them.
 */

/** One decoded SSE frame. `event` defaults to "message" per the SSE spec. */
export interface SseFrame {
  event: string
  /** Concatenation of every `data:` line in the frame, joined by "\n". */
  data: string
}

/**
 * Incremental SSE frame decoder. Feed it raw decoded text chunks (any size,
 * split at arbitrary byte boundaries) via {@link push}; it buffers a partial
 * trailing frame and yields only the frames terminated by a blank line so far.
 */
export class SseParser {
  private buffer = ''

  /**
   * Append a text chunk and return every complete frame it newly terminated.
   * A frame is complete once a blank line (`\n\n`) is seen; the remainder is
   * kept in the internal buffer until the next push / flush.
   */
  push(chunk: string): SseFrame[] {
    // Normalise CRLF / lone CR so frame splitting is line-ending agnostic.
    this.buffer += chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const frames: SseFrame[] = []
    let sep = this.buffer.indexOf('\n\n')
    while (sep !== -1) {
      const raw = this.buffer.slice(0, sep)
      this.buffer = this.buffer.slice(sep + 2)
      const frame = parseSseFrameBlock(raw)
      if (frame) frames.push(frame)
      sep = this.buffer.indexOf('\n\n')
    }
    return frames
  }

  /**
   * Emit any final frame left in the buffer (a last frame not followed by a
   * blank line). Call once the stream closes.
   */
  flush(): SseFrame[] {
    const raw = this.buffer
    this.buffer = ''
    const frame = parseSseFrameBlock(raw)
    return frame ? [frame] : []
  }
}

/** Parse one already-split frame block (text between blank lines). */
function parseSseFrameBlock(block: string): SseFrame | null {
  let event = 'message'
  const dataLines: string[] = []
  let sawData = false

  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue // blank / comment line
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    // Per spec a single leading space after the colon is stripped.
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    if (field === 'event') {
      event = value
    } else if (field === 'data') {
      dataLines.push(value)
      sawData = true
    }
    // id / retry / unknown fields are ignored.
  }

  if (!sawData && event === 'message') return null
  return { event, data: dataLines.join('\n') }
}

/**
 * Convenience: parse a complete chunk of SSE text in one shot (no streaming
 * state). Used in tests and wherever the full payload is already in memory.
 */
export function parseSseChunk(text: string): SseFrame[] {
  const parser = new SseParser()
  return [...parser.push(text), ...parser.flush()]
}

/** Callbacks invoked as the assistant stream is consumed. */
export interface SseStreamCallbacks {
  /** First frame: identifies the session the stream belongs to. */
  onSession?: (payload: SseSessionPayload) => void
  /** A text delta — accumulate to build the streamed answer. */
  onText?: (delta: string) => void
  /**
   * A "reasoning" delta — the agent's streamed thoughts (ASSISTANT_MODES.md §4,
   * `reasoning {delta}`). Accumulate like {@link onText}; hundreds may arrive
   * per turn. Feeds the collapsible "Ход рассуждения" panel.
   */
  onReasoning?: (delta: string) => void
  /** "Source of the numbers" block (tables + tools). */
  onSources?: (sources: AssistantSources) => void
  /**
   * Per-fact citations (`event: citations`, arrives after `followups`, before
   * `sources`/`done`). Maps a fact-footnote number `[[N]]` to its source ref so
   * the UI can label the sup and (Слой 2) expand the matching source.
   */
  onCitations?: (citations: AssistantCitation[]) => void
  /** Suggested follow-up questions (clickable chips). */
  onFollowups?: (questions: string[]) => void
  /** A tool started executing (optional "running <label>" indicator). */
  onToolStart?: (tool: AssistantToolStart) => void
  /** A tool finished executing. */
  onToolEnd?: (tool: AssistantToolEnd) => void
  /** Terminal error frame (e.g. 503 surfaced inside the stream). */
  onError?: (error: SseErrorPayload) => void
  /** Terminal success frame. */
  onDone?: (payload: SseDonePayload) => void
}

export interface SseSessionPayload {
  /** Server session/conversation id (ASSISTANT_MODES.md §4). */
  session_id?: number | string
  [key: string]: unknown
}

/**
 * "Source of the numbers" block: which DB tables and which tools the answer
 * was derived from (ASSISTANT_MODES.md §4 — `sources {tables:[], tools:[]}`).
 */
export interface AssistantSources {
  tables: string[]
  tools: string[]
}

/**
 * Один источник факт-сноски (`event: citations`). `id` — номер сноски `[[N]]`
 * в тексте ответа; `kind` — тип источника (`sql` / `tool` / …); `ref` —
 * человекочитаемая ссылка на данные (напр. `debts:remaining_debt_amount`).
 */
export interface AssistantCitation {
  id: number
  kind: string
  ref: string
}

/** `tool_start {name, label, args_preview}` (ASSISTANT_MODES.md §4). */
export interface AssistantToolStart {
  name: string
  label?: string
  args_preview?: string
  [key: string]: unknown
}

/** `tool_end {tool_use_id, ok, result_preview}` (+ legacy `summary`). */
export interface AssistantToolEnd {
  tool_use_id?: string
  ok: boolean
  result_preview?: string
  /** Legacy field still emitted by older backends. */
  summary?: string
  [key: string]: unknown
}

export interface SseErrorPayload {
  message?: string
  /** HTTP-equivalent status when the gateway tunnels an error in-band. */
  status?: number
  code?: string
  [key: string]: unknown
}

export interface SseDonePayload {
  session_id?: number | string
  /** Token usage / accounting block (opaque to the UI). */
  usage?: Record<string, unknown>
  [key: string]: unknown
}

/** Parse a frame's `data:` as JSON, tolerating empty / malformed payloads. */
export function parseFrameData<T = unknown>(frame: SseFrame): T | null {
  const raw = frame.data.trim()
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Coerce an unknown value into a clean string[] (drops empties, trims). */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim())
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const text = obj.name ?? obj.label ?? obj.text ?? obj.table
      if (typeof text === 'string' && text.trim()) out.push(text.trim())
    }
  }
  return out
}

/**
 * Normalise a `sources` payload into `{tables, tools}` (ASSISTANT_MODES.md §4).
 * Tolerates a bare array (treated as tables) for resilience.
 */
function normalizeSources(payload: unknown): AssistantSources {
  if (Array.isArray(payload)) {
    return { tables: toStringList(payload), tools: [] }
  }
  const obj = (payload ?? {}) as Record<string, unknown>
  return {
    tables: toStringList(obj.tables),
    tools: toStringList(obj.tools),
  }
}

/**
 * Normalise a `citations` payload into a list of {@link AssistantCitation}.
 * Tolerates either the documented `{items:[...]}` envelope or a bare array;
 * items without a finite `id` are dropped, missing `kind`/`ref` default to "".
 */
function normalizeCitations(payload: unknown): AssistantCitation[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown> | null)?.items)
      ? ((payload as Record<string, unknown>).items as unknown[])
      : []
  const out: AssistantCitation[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const obj = raw as Record<string, unknown>
    const id = Number(obj.id)
    if (!Number.isFinite(id)) continue
    out.push({
      id,
      kind: typeof obj.kind === 'string' ? obj.kind : '',
      ref: typeof obj.ref === 'string' ? obj.ref : '',
    })
  }
  return out
}

/**
 * Normalise a `followups` payload into a list of question strings
 * (ASSISTANT_MODES.md §4 — `followups {questions:[]}`). Tolerates a bare array.
 */
function normalizeFollowups(payload: unknown): string[] {
  if (Array.isArray(payload)) return toStringList(payload)
  const obj = (payload ?? {}) as Record<string, unknown>
  return toStringList(obj.questions)
}

/** Pull a text delta out of a `text` frame, tolerating string or object data. */
function extractTextDelta(frame: SseFrame): string {
  const raw = frame.data
  if (!raw) return ''
  // Plain-text data (not JSON-encoded) — forward as-is.
  const trimmed = raw.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('"') || trimmed.startsWith('['))) {
    return raw
  }
  const parsed = parseFrameData<unknown>(frame)
  if (typeof parsed === 'string') return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const value = obj.delta ?? obj.text ?? obj.content ?? obj.chunk
    if (typeof value === 'string') return value
  }
  return ''
}

/**
 * Route a single decoded frame to the matching callback.
 *
 * Returns `'done'` or `'error'` when the frame is a terminator so the caller
 * can stop reading; returns `undefined` otherwise. Unknown event names are
 * ignored (forward-compat) and never throw.
 */
export function dispatchSseEvent(
  frame: SseFrame,
  callbacks: SseStreamCallbacks
): 'done' | 'error' | undefined {
  switch (frame.event) {
    case 'session':
      callbacks.onSession?.(parseFrameData<SseSessionPayload>(frame) ?? {})
      return undefined
    case 'text':
    case 'message': {
      const delta = extractTextDelta(frame)
      if (delta) callbacks.onText?.(delta)
      return undefined
    }
    case 'reasoning': {
      // Same `{delta}` shape as `text`; routed to its own callback so the UI
      // can stream it into the reasoning panel instead of the answer bubble.
      const delta = extractTextDelta(frame)
      if (delta) callbacks.onReasoning?.(delta)
      return undefined
    }
    case 'sources':
      callbacks.onSources?.(normalizeSources(parseFrameData(frame)))
      return undefined
    case 'citations':
      callbacks.onCitations?.(normalizeCitations(parseFrameData(frame)))
      return undefined
    case 'followups':
      callbacks.onFollowups?.(normalizeFollowups(parseFrameData(frame)))
      return undefined
    case 'tool_start': {
      const payload = parseFrameData<AssistantToolStart>(frame)
      if (payload && typeof payload.name === 'string') {
        callbacks.onToolStart?.(payload)
      }
      return undefined
    }
    case 'tool_end': {
      const payload = parseFrameData<AssistantToolEnd>(frame)
      if (payload) {
        callbacks.onToolEnd?.({ ...payload, ok: payload.ok ?? false })
      }
      return undefined
    }
    case 'error':
      callbacks.onError?.(parseFrameData<SseErrorPayload>(frame) ?? {})
      return 'error'
    case 'done':
      callbacks.onDone?.(parseFrameData<SseDonePayload>(frame) ?? {})
      return 'done'
    default:
      // Unknown / future event (todo, subagent_*) — ignore (forward-compat).
      return undefined
  }
}

/**
 * Drive a `ReadableStream` of SSE bytes through the parser and callbacks until
 * a terminator frame or end-of-stream. Decoding state (multi-byte split) is
 * handled by a streaming `TextDecoder`.
 */
export async function consumeSseStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: SseStreamCallbacks
): Promise<'done' | 'error' | 'eof'> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const parser = new SseParser()
  let outcome: 'done' | 'error' | 'eof' = 'eof'

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      if (!text) continue
      for (const frame of parser.push(text)) {
        const terminator = dispatchSseEvent(frame, callbacks)
        if (terminator) {
          outcome = terminator
          return outcome
        }
      }
    }
    // Stream closed — flush a trailing un-terminated frame, if any.
    for (const frame of parser.flush()) {
      const terminator = dispatchSseEvent(frame, callbacks)
      if (terminator) {
        outcome = terminator
        return outcome
      }
    }
  } finally {
    reader.releaseLock()
  }

  return outcome
}
