import { API_BASE_URL } from '@/lib/api'

/**
 * CRM route that streams files the assistant produced (charts, CSV/XLSX
 * exports, PDF reports). The brain writes only the tail of the path into its
 * markdown (`<token>/<name>`), so the frontend is what turns it into a real,
 * authenticated URL.
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
 * - `internal` — a bridge-relative path, rewritten onto {@link ASSISTANT_FILES_ROUTE}
 * - `external` — an `http(s)` URL: shown as a link the operator must click,
 *   never auto-loaded (auto-loading would leak "operator read this message,
 *   at this time, from this IP" to whoever the model named)
 * - `blocked` — anything else (`data:`, `javascript:`, path traversal, …)
 */
export type ResolvedAssistantSource =
  | { type: 'internal'; url: string; name: string; kind: AssistantFileKind }
  | { type: 'external'; href: string }
  | { type: 'blocked' }

const SCHEME_RE = /^[a-z][a-z\d+\-.]*:/i
const HTTP_SCHEME_RE = /^https?:$/i

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])
const SHEET_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx'])
const DOCUMENT_EXTENSIONS = new Set(['doc', 'docx', 'odt', 'rtf', 'txt'])

/**
 * File family behind a name, used to pick the icon and whether the file can be
 * previewed inline. Driven by the extension rather than by a server
 * `Content-Type`, because the decision has to be made before the fetch.
 *
 * `svg` is deliberately absent from the image set: an SVG is a document, not a
 * bitmap, and it lands in the download card instead of an inline preview.
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

/**
 * Classify a `src`/`href` emitted by the assistant and, for bridge-relative
 * paths, rewrite it onto the CRM file endpoint.
 *
 * A path is accepted only when it cannot address anything but a file under the
 * bridge: no scheme, no leading `/` (that would reach any other CRM endpoint),
 * no `..`/`.` segments, no backslashes (browsers fold those into `/`), and no
 * `?`/`#` (which would rewrite the request instead of naming a file).
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

  // Decode before validating: an escaped `%2E%2E` would otherwise sail past the
  // traversal check and turn back into `..` at the server. Decoding first also
  // means a name that arrived already-escaped is not escaped a second time
  // (`encodeURI` does escape a literal `%`). A malformed escape — a real `%` in
  // the name — fails to decode, and the raw string is validated instead.
  const path = decodePathOrNull(src) ?? src

  if (path.startsWith('/')) return { type: 'blocked' }
  if (path.includes('\\') || path.includes('?') || path.includes('#')) return { type: 'blocked' }

  const segments = path.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return { type: 'blocked' }
  }

  const name = segments[segments.length - 1]
  return {
    type: 'internal',
    url: `${filesBase()}/${encodeURI(path)}`,
    name,
    kind: classifyAssistantFile(name),
  }
}

/** `decodeURI`, or `null` when the string carries a malformed escape. */
function decodePathOrNull(path: string): string | null {
  try {
    return decodeURI(path)
  } catch {
    return null
  }
}
