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
 * The integration's full contract lived in `docs/openreplay-integration-plan.md`,
 * which was never pushed to `origin` — the link is removed rather than left
 * pointing at nothing. What a reader needs from it is here and in
 * `docs/openreplay-pii-markup.md`.
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
 * leaving a replay in which the screen the operator was on cannot be told.
 *
 * The gap it used to leave is closed IN THE SOURCE (KAN-KB-54); acceptance on
 * a real recording — phase 6 of the plan, a human step — is still open, and
 * `build.yml` REFUSES a prod build that carries a key until
 * `docs/openreplay-pii-acceptance.md` records that pass. With `privateMode` off
 * the tracker masks digits (`obscureTextNumbers`) and input values, and nothing
 * in the tracker masks letters — client names, addresses and free-text operator
 * comments would reach a recording verbatim. The blocks that hold them now carry
 * `data-openreplay-obscured`:
 *
 * - text is marked per container (`src/lib/openreplay/pii.tsx`, plus the
 *   declarative flags `Column.obscured`, `FieldGrid`'s `obscured` and
 *   `SearchableSelect`'s `obscured`);
 * - personal data is OUT of `title`/`alt`/`aria-label`/`placeholder`, which the
 *   tracker does not mask at all outside `privateMode` — a hover-reveal is now
 *   `<PiiTooltip>`, whose content is a text node;
 * - every `<iframe>` and `dangerouslySetInnerHTML` sink carries the attribute,
 *   so no same-origin document or injected HTML is captured;
 * - rendered client-facing text — letters, sent messages, transcripts — is
 *   marked by container, since no field name describes it.
 *
 * 🔒 WHAT KEEPS THE SOURCE HALF CLOSED is not this comment.
 * `npm run pii-audit -- --check` runs as a step of the `lint` job in both
 * `.forgejo/workflows/ci.yml` and `.github/workflows/CI.yml`. It fails CI on a
 * client's NAME or ADDRESS rendered without the attribute, on personal data in
 * an attribute, on an unmarked iframe or HTML sink. It does NOT fail on free
 * text — that is reported as advisory and triaged by hand — and it cannot see a
 * value the dictionary has no name for. `window.__piiAudit()` (dev builds) and
 * a jsdom smoke check cover the other half: markup that is correct in the
 * source and wrong in the DOM. See `docs/openreplay-pii-markup.md`.
 *
 * History, so nobody reconstructs it from the git log: `build.yml` used to
 * REFUSE a prod build carrying an OpenReplay key, naming KAN-KB-54. That gate
 * was replaced by a `::warning::` on 2026-09-17 by explicit decision while the
 * task was still open (KAN-KB-58). The markup then landed and the warning went
 * with it — and code review put the gate back, keyed to the acceptance record
 * rather than to the task: it opens by itself the moment phase 6 is committed.
 *
 * Same convention as the key and as `VITE_ASSISTANT_REPORT_TABLES_ENABLED`:
 * empty or unset means off, and only a literal 'true'/'1' turns it on.
 */
export const OPENREPLAY_PRIVATE_MODE =
  trim(import.meta.env.VITE_OPENREPLAY_PRIVATE_MODE) === 'true' ||
  trim(import.meta.env.VITE_OPENREPLAY_PRIVATE_MODE) === '1'
