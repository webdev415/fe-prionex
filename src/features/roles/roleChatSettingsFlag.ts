/**
 * Whether the role forms show the HUB chat settings (board #1621, story 4).
 *
 * Rule 28.5: the new surface ships behind a build flag, and the old one stays
 * until the flag is flipped per stand. Until HUB applies the chat set
 * (`HUB_CHAT_SET_MODE=on`, story 13) a change of the switches is stored in CRM
 * but does not reach HUB, and the form would not say so.
 *
 * - on: the «Чат (HUB)» section (switches and screen) in edit and view, the
 *   chat template on create, the «Чат (HUB)» column of the role list, chat
 *   keys in the requests; «Роль у чаті (HUB)» is not in the forms and
 *   `hub_role` is never sent;
 * - off (the default, PROD today): the forms are as before story 4 -
 *   «Роль у чаті (HUB)» with `hub_role`, and nothing of the chat settings.
 *
 * Same convention as `VITE_ASSISTANT_REPORT_TABLES_ENABLED`: unset or empty is
 * off, only a literal `true` / `1` turns it on. Vite inlines the value at
 * BUILD time - for an image it has to arrive as a build-arg (`Dockerfile.prod`
 * and `.forgejo/workflows/build.yml`), a server env file reaches nothing.
 */

/** Name of the build flag (values `true` / `1`). */
export const ROLE_CHAT_SETTINGS_FLAG = 'VITE_ROLE_CHAT_SETTINGS_ENABLED'

/**
 * Read on every call, not once at import, so that a test can switch it with
 * `vi.stubEnv` after the module loaded. The access is static - the only kind
 * Vite replaces with the value at build time.
 */
export function isRoleChatSettingsEnabled(): boolean {
  const raw: unknown = import.meta.env.VITE_ROLE_CHAT_SETTINGS_ENABLED
  return raw === 'true' || raw === '1' || raw === true
}
