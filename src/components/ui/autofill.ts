/**
 * Browser and password-manager autofill opt-outs (KAN-995, KAN-1009).
 *
 * Chrome does not need an ``autocomplete`` attribute to offer suggestions. With
 * the attribute absent it runs its own classifier over the field's id, name,
 * placeholder, associated <label> and surrounding text, and shows the dropdown
 * as soon as it decides the field belongs to a known group. For the profile
 * groups — person name, phone, email, street address — it deliberately ignores
 * ``autocomplete="off"``, which is why ``off`` alone is not a fix everywhere.
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
 * ``useId`` output contains colons, which are legal in an id but not in a
 * ``name`` that has to survive a CSS/attribute selector. Stripping them leaves
 * a token with no semantic content for the classifier to read.
 */
export function opaqueFieldName(prefix: string, generatedId: string): string {
  return `${prefix}-${generatedId.replace(/[^a-zA-Z0-9_-]/g, '')}`
}
