import { describe, expect, it } from 'vitest'

import {
  buildKnownPhoneSet,
  classifyPhone,
  findAndClassifyPhones,
  findPhoneMatches,
  toDigits,
  type PhoneLookupContact,
} from '../phoneHighlight'

/**
 * The two rules settled with the ticket author are what these cases defend:
 *
 *  - only `380` + 9 digits is a number, and only when it is not part of a
 *    longer digit run;
 *  - a number counts as KNOWN only against a PHONE-typed contact.
 *
 * Both are easy to "simplify" later into something that looks equivalent and
 * is not, so each has a test that fails loudly if it is.
 */
const phone = (contactValue: string): PhoneLookupContact => ({
  contactValue,
  isPhone: true,
})
const notPhone = (contactValue: string): PhoneLookupContact => ({
  contactValue,
  isPhone: false,
})

describe('toDigits', () => {
  it('keeps digits and drops everything else', () => {
    // Contacts are stored bare, with a +, with trailing spaces or brackets and
    // a few with stray letters; both sides are reduced to digits before compare.
    expect(toDigits('+380 (67) 123-45-67')).toBe('380671234567')
    expect(toDigits('380671234567 ')).toBe('380671234567')
    expect(toDigits('380671234567 (осн.)')).toBe('380671234567')
  })

  it('treats null and undefined as empty rather than throwing', () => {
    expect(toDigits(null)).toBe('')
    expect(toDigits(undefined)).toBe('')
    expect(toDigits('')).toBe('')
  })

  it('returns empty for a value carrying no digits at all', () => {
    expect(toDigits('немає')).toBe('')
  })
})

describe('findPhoneMatches', () => {
  it('finds a bare number and locates it for the DOM walk', () => {
    expect(findPhoneMatches('Телефон 380671234567 основний')).toEqual([
      { value: '380671234567', index: 8, length: 12 },
    ])
  })

  it('matches a +380 form without swallowing the plus', () => {
    // The `+` is not a digit, so it is simply not part of the match: the index
    // points at the 3, which is what the highlighter must wrap.
    expect(findPhoneMatches('+380671234567')).toEqual([
      { value: '380671234567', index: 1, length: 12 },
    ])
  })

  it('ignores a valid phone embedded in a longer number', () => {
    // A contract number or IBAN fragment contains a syntactically valid
    // 12-digit phone; offering to call it would be offering to call an IBAN.
    expect(findPhoneMatches('1380978170286554')).toEqual([])
  })

  it('ignores a run with one digit too many on either side', () => {
    expect(findPhoneMatches('3806712345678')).toEqual([]) // trailing digit
    expect(findPhoneMatches('9380671234567')).toEqual([]) // leading digit
  })

  it('does not match local or spaced forms', () => {
    // Deliberately out of scope per the ticket: only 380 + 9 contiguous digits.
    expect(findPhoneMatches('0671234567')).toEqual([])
    expect(findPhoneMatches('380 67 123 45 67')).toEqual([])
  })

  it('returns every occurrence, repeats included', () => {
    // AC: "including repeated numbers" -- the same number written twice is
    // highlighted twice, so the walk cannot dedupe.
    const matches = findPhoneMatches('380671234567 та ще раз 380671234567')
    expect(matches).toHaveLength(2)
    expect(matches.map((m) => m.value)).toEqual(['380671234567', '380671234567'])
    expect(matches[0].index).toBeLessThan(matches[1].index)
  })

  it('finds several different numbers in one comment', () => {
    const matches = findPhoneMatches('дружина 380501112233, син 380671234567')
    expect(matches.map((m) => m.value)).toEqual(['380501112233', '380671234567'])
  })

  it('returns the same result when called twice on the same text', () => {
    // The module builds a fresh regex per call because the /g pattern is
    // stateful; sharing one would leave lastIndex set and silently skip
    // matches on the second call. This is that regression, stated.
    const text = 'дзвонити 380671234567'
    expect(findPhoneMatches(text)).toEqual(findPhoneMatches(text))
    expect(findPhoneMatches(text)).toHaveLength(1)
  })

  it('finds nothing in text without numbers', () => {
    expect(findPhoneMatches('')).toEqual([])
    expect(findPhoneMatches('без номера')).toEqual([])
  })
})

describe('buildKnownPhoneSet', () => {
  it('includes phone contacts, normalised to digits', () => {
    const known = buildKnownPhoneSet([phone('+380 (67) 123-45-67')])
    expect(known.has('380671234567')).toBe(true)
  })

  it('excludes contacts that are not phone-typed', () => {
    // «Рекомендувач» and «Верифікована 3-я особа» live in the Recommenders
    // tab's "Others" section and have no Call button on their own card, so
    // treating them as callable here would contradict the rest of the page.
    const known = buildKnownPhoneSet([notPhone('380671234567')])
    expect(known.size).toBe(0)
  })

  it('skips a phone contact carrying no digits', () => {
    expect(buildKnownPhoneSet([phone('невідомо')]).size).toBe(0)
  })

  it('treats a missing contact list as no known phones', () => {
    expect(buildKnownPhoneSet(null).size).toBe(0)
    expect(buildKnownPhoneSet(undefined).size).toBe(0)
    expect(buildKnownPhoneSet([]).size).toBe(0)
  })
})

describe('classifyPhone', () => {
  it('is known when the digits match a phone contact', () => {
    const known = buildKnownPhoneSet([phone('+380671234567')])
    expect(classifyPhone('380671234567', known)).toBe('known')
  })

  it('is new when no contact holds those digits', () => {
    const known = buildKnownPhoneSet([phone('380501112233')])
    expect(classifyPhone('380671234567', known)).toBe('new')
  })

  it('normalises the comment number before looking it up', () => {
    const known = buildKnownPhoneSet([phone('380671234567')])
    expect(classifyPhone('+380671234567', known)).toBe('known')
  })

  it('is new against an empty set', () => {
    expect(classifyPhone('380671234567', new Set())).toBe('new')
  })
})

describe('findAndClassifyPhones', () => {
  it('marks a contact number known and an unseen one new', () => {
    const result = findAndClassifyPhones('основний 380671234567, новий 380501112233', [
      phone('+380 67 123 45 67'),
    ])
    expect(result).toEqual([
      { value: '380671234567', index: 9, length: 12, state: 'known' },
      { value: '380501112233', index: 29, length: 12, state: 'new' },
    ])
  })

  it('classifies each repeat of the same number', () => {
    const result = findAndClassifyPhones('380671234567 / 380671234567', [phone('380671234567')])
    expect(result.map((m) => m.state)).toEqual(['known', 'known'])
  })

  it('calls everything new when the client has no contacts', () => {
    const result = findAndClassifyPhones('380671234567', null)
    expect(result.map((m) => m.state)).toEqual(['new'])
  })

  it('calls a number new when it only matches a non-phone contact', () => {
    const result = findAndClassifyPhones('380671234567', [notPhone('380671234567')])
    expect(result.map((m) => m.state)).toEqual(['new'])
  })

  it('returns nothing for a comment with no numbers', () => {
    expect(findAndClassifyPhones('без номера', [phone('380671234567')])).toEqual([])
  })
})

/**
 * The note actually seeded for this ticket (client 408417), verbatim from
 * client_sale_notes. A synthetic string can be made to prove anything; this is
 * the shape the feature ships against, HTML tags and all — the highlighter
 * walks text nodes, so the tags must not become part of a match.
 */
const SEEDED_NOTE = `<p>Контактна особа — дружина, тел. 380978170286. Дзвонили 12.03.2024, обіцяла оплату до кінця місяця.</p><p>Додатковий номер для зв'язку: 380967246625.</p><p>Клієнт просив телефонувати на 380501234567 — новий номер, у базі відсутній.</p><p>Повторний контакт за номером 380978170286 — не відповідає.</p><p>Резервні: +380685161436, 067 246 25 11.</p>`

describe('the seeded creditor comment', () => {
  it('yields five matches over four distinct numbers', () => {
    const matches = findPhoneMatches(SEEDED_NOTE)
    expect(matches).toHaveLength(5)
    expect(new Set(matches.map((m) => m.value)).size).toBe(4)
  })

  it('highlights the repeated number both times', () => {
    // 380978170286 appears in the first and fourth paragraphs; the AC requires
    // every occurrence, so the walk must not dedupe.
    const repeats = findPhoneMatches(SEEDED_NOTE).filter((m) => m.value === '380978170286')
    expect(repeats).toHaveLength(2)
  })

  it('picks up the +380 form without the plus', () => {
    const values = findPhoneMatches(SEEDED_NOTE).map((m) => m.value)
    expect(values).toContain('380685161436')
  })

  it('leaves the spaced local number alone', () => {
    // "067 246 25 11" is a real number to a human and out of scope by the
    // ticket's own rule: only 380 + 9 contiguous digits.
    const values = findPhoneMatches(SEEDED_NOTE).map((m) => m.value)
    expect(values.some((v) => v.endsWith('0672462511'))).toBe(false)
  })

  it('never matches inside the markup itself', () => {
    // Every match must land in text, not in a tag — the index/length pair is
    // what the DOM walk slices on.
    for (const match of findPhoneMatches(SEEDED_NOTE)) {
      const slice = SEEDED_NOTE.slice(match.index, match.index + match.length)
      expect(slice).toBe(match.value)
      expect(slice).not.toContain('<')
    }
  })

  it('splits the seeded numbers into known and new against real contacts', () => {
    // 380685161436 is a contact on this client; the number the note itself
    // calls "новий номер, у базі відсутній" must come back as new.
    const result = findAndClassifyPhones(SEEDED_NOTE, [phone('+380685161436')])
    const byValue = new Map(result.map((m) => [m.value, m.state]))
    expect(byValue.get('380685161436')).toBe('known')
    expect(byValue.get('380501234567')).toBe('new')
  })
})
