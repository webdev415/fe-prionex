/**
 * OpenReplay session replay — build-time configuration.
 *
 * 🔴 Vite inlines `import.meta.env.VITE_*` AT BUILD TIME. A value placed in a
 * server-side `.env` next to an already-built bundle does nothing at all — the
 * bundle carries a literal, not a lookup. The values therefore have to arrive as
 * build-args (`Dockerfile.prod` → `.forgejo/workflows/build.yml`), exactly the
 * way `VITE_OPERATOR_PHONE_URL` does.
 *
 * Every read below is a STATIC `import.meta.env.X` member access. That is the
 * only form Vite substitutes; a computed lookup (`import.meta.env[name]`) would
 * silently stay undefined in the bundle.
 *
 * See docs/openreplay-integration-plan.md for the full contract.
 */

/** Names kept as constants so tests and error messages cannot drift from them. */
export const OPENREPLAY_PROJECT_KEY_VAR = 'VITE_OPENREPLAY_PROJECT_KEY'
export const OPENREPLAY_INGEST_URL_VAR = 'VITE_OPENREPLAY_INGEST_URL'

const trim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const OPENREPLAY_PROJECT_KEY = trim(import.meta.env.VITE_OPENREPLAY_PROJECT_KEY)
export const OPENREPLAY_INGEST_URL = trim(import.meta.env.VITE_OPENREPLAY_INGEST_URL)

/**
 * The tracker starts only when BOTH values are present.
 *
 * An empty value means "not configured", which is a valid state for any
 * environment — not an error, not a warning, and deliberately not a failed
 * build: environments are switched on one at a time by adding their repository
 * variable, and a build for an environment that has not been switched on yet
 * must stay green.
 */
export const OPENREPLAY_ENABLED = OPENREPLAY_PROJECT_KEY !== '' && OPENREPLAY_INGEST_URL !== ''

/**
 * Strict masking mode: everything on screen becomes asterisks except nodes
 * carrying `data-openreplay-unmask`.
 *
 * Off in every environment today (decision 2026-09-16). It masks more than its
 * name suggests — page URLs, document titles and click labels go with the text,
 * leaving a replay in which the screen the operator was on cannot be told. PII
 * is handled instead by `obscureTextNumbers` plus `data-openreplay-obscured` on
 * the blocks that hold it.
 *
 * Same convention as the key and as `VITE_ASSISTANT_REPORT_TABLES_ENABLED`:
 * empty or unset means off, and only a literal 'true'/'1' turns it on.
 */
export const OPENREPLAY_PRIVATE_MODE =
  trim(import.meta.env.VITE_OPENREPLAY_PRIVATE_MODE) === 'true' ||
  trim(import.meta.env.VITE_OPENREPLAY_PRIVATE_MODE) === '1'
