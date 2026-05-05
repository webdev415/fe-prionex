/**
 * Helpers for normalising and classifying 2FA codes typed into the
 * disable / regenerate modals (same field accepts a 6-digit TOTP or a
 * `xxxx-xxxx` backup code).
 */

// ASCII whitespace + zero-width characters (U+200B–U+200D) + BOM (U+FEFF).
// Built from escape sequences so the source file stays free of irregular
// whitespace (lint: no-irregular-whitespace).
const STRIP_PATTERN = new RegExp('[\\s\\u200B-\\u200D\\uFEFF]', 'g')

// Unicode "dash" characters that some text viewers (macOS TextEdit's smart
// dashes, certain PDF readers, markdown editors) auto-substitute for the
// regular ASCII hyphen on copy-paste. Backend hashes use U+002D HYPHEN-MINUS,
// so we unify all of these variants to that.
//   U+2010 HYPHEN, U+2011 NON-BREAKING HYPHEN, U+2012 FIGURE DASH,
//   U+2013 EN DASH, U+2014 EM DASH, U+2015 HORIZONTAL BAR, U+2212 MINUS SIGN.
const DASH_VARIANTS = new RegExp('[\\u2010-\\u2015\\u2212]', 'g')

/**
 * Trim, lowercase, unify dash variants, and strip whitespace + zero-width /
 * BOM characters that sneak in from clipboard pastes (PDFs, emails, password
 * managers, markdown viewers with smart-dash autosubstitution).
 *
 * The backend's `_normalize_code` already lowercases + strips ASCII
 * whitespace; this is defence-in-depth for invisible Unicode and for the
 * smart-dash failure mode that mutates a saved backup code's hyphen.
 */
export function normalizeTwoFactorInput(code: string): string {
  return code.trim().toLowerCase().replace(DASH_VARIANTS, '-').replace(STRIP_PATTERN, '')
}

/**
 * True when the input "looks like" a backup code rather than a TOTP — i.e.
 * it is not a bare 6-digit number. Used to decide whether to surface the
 * "this backup code may already have been used" hint.
 */
export function looksLikeBackupCode(code: string): boolean {
  return !/^\d{6}$/.test(code)
}
