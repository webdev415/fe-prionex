import { API_BASE_URL } from '@/lib/api'

/**
 * CRM route that streams files the assistant produced (charts, CSV/XLSX
 * exports, PDF reports). It proxies the brain's own `/api/files/…` under the
 * same right as the chat, so the frontend rewrites onto it rather than letting
 * the browser resolve the path against the current CRM page.
 */
export const ASSISTANT_FILES_ROUTE = '/api/v1/ai-assistant/files'

export type AssistantFileKind = 'image' | 'pdf' | 'sheet' | 'document' | 'other'

/**
 * What a `src`/`href` coming out of the model is allowed to become.
 *
 * The model's output is untrusted input: a chart path is legitimate, but the
 * same field can carry a tracking pixel or a `javascript:` URL. So every
 * reference is classified before anything is rendered.
 *
 * - `internal` — a real file reference, rewritten onto {@link ASSISTANT_FILES_ROUTE}
 * - `external` — an `http(s)` URL: shown as a link the operator must click,
 *   never auto-loaded (auto-loading would leak "operator read this message,
 *   at this time, from this IP" to whoever the model named)
 * - `unresolvable` — looks like a path but is not a file reference. In practice
 *   this is the model having dropped the token while retyping its own answer
 *   (`![](payments_2026.png)`). Nothing can be fetched: the token *is* the
 *   capability that scopes the file to this operator, and there is no lookup
 *   by bare name — that would hand every operator everyone else's exports.
 * - `blocked` — actively unsafe (`data:`, `javascript:`, …)
 */
export type ResolvedAssistantSource =
  | { type: 'internal'; url: string; name: string; kind: AssistantFileKind }
  | { type: 'external'; href: string }
  | { type: 'unresolvable' }
  | { type: 'blocked' }

const SCHEME_RE = /^[a-z][a-z\d+\-.]*:/i
const HTTP_SCHEME_RE = /^https?:$/i

/**
 * The one path shape that becomes a fetchable file.
 *
 * The brain emits `/api/files/<token>/<name>`; the `/api/files/` prefix is
 * optional here because the model routinely retypes the link when it composes
 * the final answer. The token is `secrets.token_urlsafe(12)` — 16 chars today,
 * and the gateway accepts 16–64, so matching that same range keeps both sides
 * in step if the length is ever changed.
 *
 * Matching one strict shape, rather than accepting any relative path, is what
 * stops the model from aiming the browser at some other CRM endpoint.
 */
const FILE_REFERENCE_RE = /^(?:\/?api\/files\/)?([A-Za-z0-9_-]{16,64})\/([^/]+)$/

// Extensions the gateway actually serves; anything else it refuses with 400
// before the brain is even asked. Images list only the formats it sends
// inline — `svg`/`gif`/`bmp` are absent on purpose and fall through to a
// download card instead of an <img> that would fail.
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const SHEET_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx'])
const DOCUMENT_EXTENSIONS = new Set(['txt', 'md', 'json'])

/**
 * File family behind a name: picks the icon and decides whether the file can be
 * previewed inline. Driven by the extension, because the gateway derives its
 * `Content-Type` from the extension too (ignoring what the brain claimed), so
 * the two agree by construction and the choice can be made before the fetch.
 */
export function classifyAssistantFile(name: string): AssistantFileKind {
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (extension === 'pdf') return 'pdf'
  if (SHEET_EXTENSIONS.has(extension)) return 'sheet'
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document'
  return 'other'
}

/**
 * Base URL of the file bridge.
 *
 * `VITE_API_BASE_URL` is `/` in the same-origin deployment and a full origin
 * elsewhere. Trimming the trailing slash is what keeps the same-origin case
 * from producing `//api/v1/...` — a protocol-relative URL, i.e. a request to a
 * host literally named `api`.
 */
function filesBase(): string {
  return `${API_BASE_URL.replace(/\/+$/, '')}${ASSISTANT_FILES_ROUTE}`
}

/** `decodeURI`, or `null` when the string carries a malformed escape. */
function decodePathOrNull(path: string): string | null {
  try {
    return decodeURI(path)
  } catch {
    return null
  }
}

/**
 * Classify a `src`/`href` emitted by the assistant and, for real file
 * references, rewrite it onto the CRM file endpoint.
 */
export function resolveAssistantSource(raw: string | null | undefined): ResolvedAssistantSource {
  const src = (raw ?? '').trim()
  if (!src) return { type: 'blocked' }

  // `//evil.tld/pixel.png` is an absolute URL to another origin, not a path.
  if (src.startsWith('//')) return { type: 'external', href: src }

  const scheme = SCHEME_RE.exec(src)?.[0]
  if (scheme) {
    // Only http(s) is worth offering as a link. `data:`/`blob:`/`javascript:`
    // are dropped outright — a `data:` document opened in a new tab runs on an
    // opaque origin and is a standard phishing vector.
    return HTTP_SCHEME_RE.test(scheme) ? { type: 'external', href: src } : { type: 'blocked' }
  }

  // Decode before matching, so an escaped `%2E%2E` cannot reach the server as
  // `..`. Decoding first also means a name that arrived already escaped is not
  // escaped twice (`encodeURI`/`encodeURIComponent` escape a literal `%`).
  // A malformed escape — a real `%` in the name — is matched raw instead.
  const path = decodePathOrNull(src) ?? src

  // These rewrite the request rather than name a file; browsers also fold
  // backslashes into `/`, which would smuggle an extra path segment.
  if (path.includes('\\') || path.includes('?') || path.includes('#')) {
    return { type: 'blocked' }
  }

  const match = FILE_REFERENCE_RE.exec(path)
  if (!match) {
    // A path-shaped string that is not a file reference. Absolute paths and
    // traversal land here too: `/api/v1/clients/1` and `../secrets` simply do
    // not match, so there is no way to aim this at another endpoint.
    return { type: 'unresolvable' }
  }

  const [, token, name] = match
  if (name === '.' || name === '..') return { type: 'blocked' }

  return {
    type: 'internal',
    // The token matched `[A-Za-z0-9_-]`, so it is already URL-safe; only the
    // name can carry spaces or Cyrillic.
    url: `${filesBase()}/${token}/${encodeURIComponent(name)}`,
    name,
    kind: classifyAssistantFile(name),
  }
}
