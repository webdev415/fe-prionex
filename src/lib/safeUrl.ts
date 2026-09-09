/**
 * A link typed by a person, made safe to put in an `href`.
 *
 * Returns the value only when it is an **absolute** http(s) URL, and
 * `undefined` for everything else.
 *
 * Two different failures are being prevented, not one:
 *
 * - `javascript:` / `data:` — rendering these as a link is script execution;
 * - a bare host like `meet.google.com/abc` — resolved against the page origin
 *   it becomes a link to *our own* site, so the participant is sent somewhere
 *   plausible-looking and wrong rather than to the meeting.
 *
 * The second is why no base is passed to `URL`: a relative value must throw
 * here, not quietly resolve.
 */
export function safeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.trim()
  if (!value) return undefined
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return undefined
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : undefined
}
