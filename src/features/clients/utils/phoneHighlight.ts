/**
 * Ukrainian phone numbers inside the primary creditor's comment (KAN-1212).
 *
 * Pure: finds the numbers in a block of text and decides, for each, whether
 * it is already one of the client's callable contacts. No DOM, no React — the
 * highlighter walks text nodes and the dropdown renders; both ask this module
 * what a number IS.
 *
 * Two rules settled with the ticket author:
 *
 *  - Only `380` + 9 digits is a number. `+380…` still matches (the `+` is not
 *    a digit, so it is simply not part of the match); spaced and local `0XX…`
 *    forms are deliberately NOT matched.
 *  - A number is KNOWN only when it matches a PHONE-typed contact. Contacts
 *    in the Recommenders tab's "Others" section — «Рекомендувач» and
 *    «Верифікована 3-я особа» are typed that way — have no Call button on
 *    their own card, so treating them as callable here would be inconsistent
 *    with the rest of the page.
 */

/** `380` + 9 digits. Boundaries are applied by {@link findPhoneMatches}, not
 *  by a lookbehind: `(?<!\d)` is ES2018 and Safari only learned it in 16.4,
 *  where an unsupported regex LITERAL is a parse-time SyntaxError that takes
 *  the whole bundle with it. The index check below is the same rule with no
 *  version question attached. */
const PHONE_PATTERN = /380\d{9}/g

/** Digits only — NOT the local `stripPhoneFormat`, which leaves `+` in place.
 *  Contacts are stored bare (1,310,737), with a `+` (3), with trailing spaces
 *  or brackets (223) and a few with stray letters; the comment side is always
 *  bare, so both sides are reduced to digits before comparing. */
export function toDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9'
}

/** One number found in the text. `index`/`length` locate it for the DOM walk. */
export interface PhoneMatch {
  value: string
  index: number
  length: number
}

/**
 * Every `380`+9 run in `text` that is not embedded in a longer number.
 *
 * The boundary matters: a contract number or IBAN fragment such as
 * `1380978170286554` contains a syntactically valid 12-digit phone, and
 * highlighting it would offer to call something that is not a phone number.
 *
 * All occurrences are returned, duplicates included — the same number written
 * twice is highlighted twice (AC: "including repeated numbers").
 */
export function findPhoneMatches(text: string): PhoneMatch[] {
  const out: PhoneMatch[] = []
  // A fresh regex per call: PHONE_PATTERN is /g and therefore stateful, and a
  // shared lastIndex between calls would silently skip matches.
  const re = new RegExp(PHONE_PATTERN.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index
    const end = start + m[0].length
    if (isDigit(text[start - 1]) || isDigit(text[end])) continue
    out.push({ value: m[0], index: start, length: m[0].length })
  }
  return out
}

/** The contact fields this module needs — a structural subset of
 *  `RecommenderContact`, so callers pass their existing contacts unchanged
 *  and tests need not build a whole one. */
export interface PhoneLookupContact {
  contactValue: string
  isPhone: boolean
}

/** Digits of every PHONE-typed contact, for matching comment numbers against. */
export function buildKnownPhoneSet(
  contacts: readonly PhoneLookupContact[] | null | undefined
): Set<string> {
  const known = new Set<string>()
  for (const contact of contacts ?? []) {
    if (!contact.isPhone) continue
    const digits = toDigits(contact.contactValue)
    if (digits) known.add(digits)
  }
  return known
}

/** Green when the number is already a callable contact, orange when it is not. */
export type PhoneHighlightState = 'known' | 'new'

export function classifyPhone(
  phone: string,
  knownPhones: ReadonlySet<string>
): PhoneHighlightState {
  return knownPhones.has(toDigits(phone)) ? 'known' : 'new'
}

export interface ClassifiedPhoneMatch extends PhoneMatch {
  state: PhoneHighlightState
}

/**
 * Both steps at once: find the numbers, then say what each one is.
 *
 * The caller builds the set once per comment rather than per match, so a note
 * with forty numbers still walks the contact list only once.
 */
export function findAndClassifyPhones(
  text: string,
  contacts: readonly PhoneLookupContact[] | null | undefined
): ClassifiedPhoneMatch[] {
  const known = buildKnownPhoneSet(contacts)
  return findPhoneMatches(text).map((match) => ({
    ...match,
    state: classifyPhone(match.value, known),
  }))
}
