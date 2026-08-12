/**
 * Browser and password-manager autofill opt-outs (KAN-995, KAN-1009).
 *
 * Chrome does not need an ``autocomplete`` attribute to offer suggestions. With
 * the attribute absent it runs its own classifier over the field's id, name,
 * placeholder, associated <label> and surrounding text, and shows the dropdown
 * as soon as it decides the field belongs to a known group. For the profile
 * groups — person name, phone, email, street address — it deliberately ignores
 * ``autocomplete="off"``, which is why ``off`` is not a fix everywhere and
 * ``new-password`` is the token that has to be used instead.
 *
 * The data attributes below are the equivalent opt-out for LastPass, 1Password
 * and Dashlane, whose overlays sit on top of the field the same way.
 */
export const PASSWORD_MANAGER_OPT_OUT = {
  'data-lpignore': 'true',
  'data-1p-ignore': '',
  'data-form-type': 'other',
} as const

/**
 * The tokens this app hands to the browser on purpose. Everything else means
 * the field wants no help, so the opt-outs apply.
 *
 * Only the login form is on this list today. It is written as an allow-list
 * rather than a list of suppressing tokens so the failure mode points the safe
 * way: a typo, one of the ``autocomplete="none"`` workarounds doing the rounds,
 * or a prefixed token like ``section-billing new-password`` all end up
 * suppressed rather than silently losing the defence.
 */
const REQUESTS_REAL_AUTOFILL = new Set(['username', 'current-password', 'one-time-code'])

export function suppressesAutofill(autoComplete: string | undefined): boolean {
  return autoComplete === undefined || !REQUESTS_REAL_AUTOFILL.has(autoComplete)
}

/**
 * ``useId`` output contains colons, which are legal in an id but not in a
 * ``name`` that has to survive a CSS/attribute selector. Stripping them leaves
 * a token with no semantic content for the classifier to read.
 */
export function opaqueFieldName(prefix: string, generatedId: string): string {
  return `${prefix}-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`
}
