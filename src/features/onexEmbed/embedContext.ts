/**
 * OneX «dock» embedding contract for `/dashboard/ai-assistant`.
 *
 * OneX — the operators' Electron browser (repo `CRM-Prionex/OneX`) — hosts this
 * page in a narrow sidebar (~{@link ONEX_DOCK_WIDTH_PX}px) next to the CRM it
 * shows in the main pane. It opens
 *
 *     /dashboard/ai-assistant?embed=dock
 *
 * and the page answers by dropping the dashboard chrome (rail, header, chat
 * history) and rendering the chat full height. Everything else — SSE streaming,
 * fast/thinking, attachments, voice, feedback — is untouched; without the query
 * the page renders exactly as before.
 *
 * Two window events carry the host → dock traffic:
 *
 *  - {@link ONEX_PAGE_CONTEXT_EVENT} — what the operator is looking at in the
 *    main pane (see {@link OnexPageContext}). The host also mirrors the latest
 *    payload on `window.__onexPageContext`, so a dock that mounts *after* the
 *    event was fired still picks it up.
 *  - {@link ONEX_ASK_EVENT} — "ask this now" (see {@link OnexAskCommand}).
 *
 * The dock signals back with `window.__onexDockReady = true` once mounted.
 *
 * **Why the context travels inside the message text.** `POST
 * /api/v1/ai-assistant/chat` (`features/aiAssistant/api.ts`,
 * `AssistantChatRequest`) has no field for host-supplied context, and this
 * track must not change the backend. So the context is rendered as a short
 * labelled preamble prepended to the operator's own text
 * ({@link buildContextualMessage}) and hard-capped
 * ({@link CONTEXT_BLOCK_MAX_CHARS}) so a big page cannot flood the prompt.
 *
 * The preamble labels are deliberately Ukrainian constants rather than i18n
 * strings: they are read by the brain (which works in Ukrainian for operators),
 * not by the operator, so they must not change when the UI language does.
 */

declare global {
  interface Window {
    /** Latest page context published by the OneX host (raw, unvalidated). */
    __onexPageContext?: unknown
    /** Set by the dock once it has mounted and is listening for host events. */
    __onexDockReady?: boolean
  }

  interface WindowEventMap {
    'onex:page-context': CustomEvent<unknown>
    'onex:ask': CustomEvent<unknown>
  }
}

/** Query parameter OneX appends to switch the page into dock mode. */
export const EMBED_QUERY_PARAM = 'embed'
/** The only recognised value of {@link EMBED_QUERY_PARAM}. */
export const EMBED_DOCK_VALUE = 'dock'

export const ONEX_PAGE_CONTEXT_EVENT = 'onex:page-context'
export const ONEX_ASK_EVENT = 'onex:ask'

/**
 * Sidebar width (px) OneX reserves for the dock. The layout is fluid — this is
 * the contract value the compact styling is tuned for, not a hard constraint.
 */
export const ONEX_DOCK_WIDTH_PX = 420

/** Route the dock mode applies to; a stray query elsewhere must be inert. */
const ASSISTANT_PATH = '/dashboard/ai-assistant'

/* Per-field caps, applied before the whole-block cap below. */
const MAX_TITLE_CHARS = 160
const MAX_URL_CHARS = 400
const MAX_SELECTION_CHARS = 800
const MAX_TEXT_CHARS = 1200
/** Cap for a single `onex:ask` prompt. */
const MAX_ASK_CHARS = 2000

/** Hard ceiling for the whole context preamble, in characters. */
export const CONTEXT_BLOCK_MAX_CHARS = 2000

/** Page the operator is looking at in the OneX main pane. */
export interface OnexPageContext {
  url: string | null
  title: string | null
  clientId: number | null
  /** Text the operator has selected on that page, if any. */
  selection: string | null
  /** Readable body of that page, if the host extracted one. */
  text: string | null
  /** Epoch ms the host stamped the payload with. */
  ts: number | null
}

/** Presets the host may name instead of spelling the question out. */
export type OnexAskPreset = 'summary'

/** A normalized `onex:ask` payload. */
export interface OnexAskCommand {
  /** The host's own wording; empty when it relies on {@link preset}. */
  text: string
  preset: OnexAskPreset | null
}

/** True when this search string carries `embed=dock`. Accepts a leading `?`. */
export function isDockEmbedSearch(search: string | null | undefined): boolean {
  if (!search) return false
  return new URLSearchParams(search).get(EMBED_QUERY_PARAM) === EMBED_DOCK_VALUE
}

/**
 * True when the dashboard chrome (rail + header) must be dropped for this
 * location. Route-gated on purpose: `?embed=dock` landing on an unrelated page
 * — a copied link, a redirect that kept the query — must not leave the operator
 * on a CRM screen with no navigation.
 */
export function shouldStripDashboardChrome(pathname: string, search: string): boolean {
  const onAssistant = pathname === ASSISTANT_PATH || pathname === `${ASSISTANT_PATH}/`
  return onAssistant && isDockEmbedSearch(search)
}

/** Clip to `max` characters, marking the cut with an ellipsis. */
function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}

/**
 * Read one string field: whitespace collapsed to single spaces (the preamble is
 * line-based, and a payload full of newlines would otherwise fake its own
 * structure inside the prompt) and clipped. Empty → null.
 */
function readString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed ? clip(collapsed, max) : null
}

/** Read `clientId` as a positive integer; a numeric string is accepted. */
function readClientId(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Validate a raw `onex:page-context` detail.
 *
 * Returns null when nothing usable came through — an unknown shape, or a
 * payload whose only field is the timestamp. The caller treats null as "no
 * context", so a malformed event clears the chip instead of freezing a stale
 * page on screen.
 */
export function normalizeOnexPageContext(detail: unknown): OnexPageContext | null {
  if (!detail || typeof detail !== 'object') return null
  const raw = detail as Record<string, unknown>
  const context: OnexPageContext = {
    url: readString(raw.url, MAX_URL_CHARS),
    title: readString(raw.title, MAX_TITLE_CHARS),
    clientId: readClientId(raw.clientId),
    selection: readString(raw.selection, MAX_SELECTION_CHARS),
    text: readString(raw.text, MAX_TEXT_CHARS),
    ts: typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : null,
  }
  const hasPayload =
    context.url !== null ||
    context.title !== null ||
    context.clientId !== null ||
    context.selection !== null ||
    context.text !== null
  return hasPayload ? context : null
}

/**
 * Label for the «Контекст: …» chip — the page title, else its URL. Null when
 * the context is identified only by `clientId`; the caller then shows its own
 * translated wording.
 */
export function contextChipLabel(context: OnexPageContext): string | null {
  return context.title ?? context.url ?? null
}

/**
 * Render the context as a labelled preamble, or null when there is nothing to
 * say. Field order is by value density — the client id survives the whole-block
 * cap, the page body is the first thing cut.
 */
export function buildContextBlock(context: OnexPageContext | null): string | null {
  if (!context) return null
  const lines: string[] = []
  const head = [context.title, context.url].filter(Boolean).join(' — ')
  if (head) lines.push(`Контекст сторінки: ${head}`)
  if (context.clientId !== null) lines.push(`Клієнт ID: ${context.clientId}`)
  if (context.selection) lines.push(`Виділений текст: ${context.selection}`)
  if (context.text) lines.push(`Текст сторінки: ${context.text}`)
  if (lines.length === 0) return null
  return clip(lines.join('\n'), CONTEXT_BLOCK_MAX_CHARS)
}

/**
 * The text actually sent as `AssistantChatRequest.message`: the context
 * preamble, a blank line, then what the operator typed.
 *
 * An empty prompt is returned untouched. The chat contract accepts an empty
 * `message` only when a voice note carries the turn, and quietly turning that
 * into a text turn would change what the brain answers.
 */
export function buildContextualMessage(prompt: string, context: OnexPageContext | null): string {
  if (!prompt) return prompt
  const block = buildContextBlock(context)
  return block ? `${block}\n\n${prompt}` : prompt
}

/**
 * Validate a raw `onex:ask` detail. Null when the host sent neither text nor a
 * preset this build understands — nothing to send, so nothing happens.
 */
export function normalizeOnexAsk(detail: unknown): OnexAskCommand | null {
  if (!detail || typeof detail !== 'object') return null
  const raw = detail as Record<string, unknown>
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  const preset: OnexAskPreset | null = raw.preset === 'summary' ? 'summary' : null
  if (!text && !preset) return null
  return { text: clip(text, MAX_ASK_CHARS), preset }
}
