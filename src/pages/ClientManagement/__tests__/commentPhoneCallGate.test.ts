import { describe, expect, it } from 'vitest'
import { commentCallDecision } from '../commentPhoneCallGate'

const flags = (over: Record<string, unknown> = {}) => ({
  blocks_calls: false,
  blocks_sms: false,
  blocks_spam: false,
  reasons: [] as string[],
  ...over,
})

describe('commentCallDecision', () => {
  it('refuses a contact tagged Do Not Call and names the tag', () => {
    // The whole point of H1: the phone strip and the Recommenders tab both
    // refuse this contact, and the comment path used to dial it.
    const decision = commentCallDecision([
      { blocking: flags({ blocks_calls: true, reasons: ['Calls blocked: Do Not Call'] }) },
    ])
    expect(decision.allowed).toBe(false)
    expect(decision).toMatchObject({ reason: 'Calls blocked: Do Not Call' })
  })

  it('still refuses when the backend sent no reason string', () => {
    // The caller falls back to a translated label; the gate must not open just
    // because the explanation is missing.
    const decision = commentCallDecision([{ blocking: flags({ blocks_calls: true }) }])
    expect(decision.allowed).toBe(false)
    expect(decision).toMatchObject({ reason: '' })
  })

  it('allows an untagged contact and lets it mark spam', () => {
    expect(commentCallDecision([{ spamAllowed: true, blocking: flags() }])).toEqual({
      allowed: true,
      spamOverride: true,
    })
  })

  it("honours the contact's own spam flag", () => {
    expect(commentCallDecision([{ spamAllowed: false, blocking: flags() }])).toEqual({
      allowed: true,
      spamOverride: false,
    })
  })

  it('refuses spam for a contact tagged Do Not Spam even when spamAllowed is true', () => {
    // blocks_spam and spamAllowed are separate sources; the tag wins.
    expect(
      commentCallDecision([{ spamAllowed: true, blocking: flags({ blocks_spam: true }) }])
    ).toEqual({ allowed: true, spamOverride: false })
  })

  it('treats a missing spamAllowed as unrestricted', () => {
    // Optional field: absent means "no contact-level restriction", the same
    // reading the contact TYPE default uses.
    expect(commentCallDecision([{ blocking: flags() }])).toEqual({
      allowed: true,
      spamOverride: true,
    })
  })

  it('leaves the type-level default alone when no contact matched', () => {
    // undefined is not "spam disabled" — it means "no override", so
    // openOutboundCall keeps falling back to the contact type's own setting.
    expect(commentCallDecision(undefined)).toEqual({ allowed: true, spamOverride: undefined })
    expect(commentCallDecision(null)).toEqual({ allowed: true, spamOverride: undefined })
    expect(commentCallDecision([])).toEqual({ allowed: true, spamOverride: undefined })
  })

  it('refuses when ANY row holding the number is blocked, phone-typed or not', () => {
    // What 380978170286 exposed in the UI: its only rows are «Рекомендувач» and
    // «Верифікована 3-я особа». The comment still colours it green, so the gate
    // must weigh those rows — consulting only a phone-typed row found nothing
    // and dialled a number tagged Do Not Call.
    const decision = commentCallDecision([
      { blocking: flags() },
      { blocking: flags({ blocks_calls: true, reasons: ['Calls blocked: Do Not Call'] }) },
    ])
    expect(decision.allowed).toBe(false)
  })

  it('lets the most restrictive row decide spam', () => {
    expect(commentCallDecision([{ spamAllowed: true }, { spamAllowed: false }])).toEqual({
      allowed: true,
      spamOverride: false,
    })
  })
})
