/**
 * Client-side mirror of the backend's window limits for the workday report,
 * so the pickers do not offer what the API refuses with a 400.
 *
 * `WORKDAY_HISTORY_FROM` mirrors the client-service setting of the same name
 * (default 2026-06-01, contract card-73-74 §2): a day before it answers 400
 * `WORKDAY_BEFORE_HISTORY`. It is a SERVER setting — if it moves, the server's
 * translated 400 still explains the refusal; this constant only keeps the
 * picker honest. PR 6 will also send it as `meta.history_from` (agreed
 * 06.10.2026); the tabs prefer that and keep this constant as the fallback.
 */
export const WORKDAY_HISTORY_FROM = '2026-06-01'

/** The same bound as a month (`YYYY-MM`), for the month picker. */
export const WORKMONTH_HISTORY_FROM = WORKDAY_HISTORY_FROM.slice(0, 7)
