/**
 * KAN-973 §4 — pre-selecting the phone from a very recent call.
 *
 * The cases worth the file:
 *
 * * the 10-minute boundary itself, in both directions — this is the whole rule;
 * * number formats. The switchboard says `+380501234567`, the client record
 *   says `050 123 45 67`. Raw string comparison finds nothing and the feature
 *   silently never fires;
 * * "most recent" by `ended_at`, not by start — a long call that began earlier
 *   can be the one that just finished;
 * * a call still in progress must not count, and a number that is not one of
 *   this client's contacts must not be pre-selected.
 */
import { describe, expect, it } from 'vitest'
import { normalizePhoneKey, resolveRecentCallPhone } from '../recentCallPhone'

const NOW = Date.parse('2026-08-11T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

const PHONES = [
  { id: 1, number: '050 123 45 67' },
  { id: 2, number: '+380671112233' },
]

const resolve = (calls: Parameters<typeof resolveRecentCallPhone>[0]['calls']) =>
  resolveRecentCallPhone({ calls, phones: PHONES, nowMs: NOW })

describe('normalizePhoneKey', () => {
  it('treats the same number written differently as equal', () => {
    const forms = [
      '+380501234567',
      '380501234567',
      '0501234567',
      '050 123 45 67',
      '(050) 123-45-67',
    ]
    const keys = new Set(forms.map(normalizePhoneKey))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBe('501234567')
  })

  it('keeps short internal numbers whole', () => {
    expect(normalizePhoneKey('1234')).toBe('1234')
  })

  it('does not confuse two different numbers', () => {
    expect(normalizePhoneKey('0501234567')).not.toBe(normalizePhoneKey('0671112233'))
  })
})

describe('resolveRecentCallPhone', () => {
  it('pre-selects the number of a call that just ended', () => {
    expect(resolve([{ customer_number: '+380501234567', ended_at: minutesAgo(2) }])).toEqual(
      PHONES[0]
    )
  })

  it('returns the stored contact, not the switchboard spelling', () => {
    // The radio list compares against the stored value, so handing back
    // "+380501234567" would fail to check anything.
    const found = resolve([{ customer_number: '+380501234567', ended_at: minutesAgo(1) }])
    expect(found?.number).toBe('050 123 45 67')
  })

  // ── the window ────────────────────────────────────────────────────────────
  it('accepts a call exactly at the 10-minute boundary', () => {
    expect(resolve([{ customer_number: '+380501234567', ended_at: minutesAgo(10) }])).toEqual(
      PHONES[0]
    )
  })

  it('rejects a call older than the window', () => {
    expect(resolve([{ customer_number: '+380501234567', ended_at: minutesAgo(11) }])).toBeNull()
  })

  it('honours a custom window', () => {
    const calls = [{ customer_number: '+380501234567', ended_at: minutesAgo(20) }]
    expect(
      resolveRecentCallPhone({ calls, phones: PHONES, nowMs: NOW, windowMinutes: 30 })
    ).toEqual(PHONES[0])
  })

  it('accepts a timestamp slightly in the future', () => {
    // Server and browser clocks drift by seconds; treating that as "not ended"
    // would drop exactly the just-hung-up call this feature is for.
    expect(resolve([{ customer_number: '+380501234567', ended_at: minutesAgo(-1) }])).toEqual(
      PHONES[0]
    )
  })

  // ── which call counts ─────────────────────────────────────────────────────
  it('picks the most recently ENDED call, not the most recently started', () => {
    const calls = [
      { customer_number: '+380671112233', ended_at: minutesAgo(1) },
      { customer_number: '+380501234567', ended_at: minutesAgo(5) },
    ]
    expect(resolve(calls)).toEqual(PHONES[1])
    expect(resolve([...calls].reverse())).toEqual(PHONES[1])
  })

  it('ignores a call still in progress', () => {
    expect(resolve([{ customer_number: '+380501234567', ended_at: null }])).toBeNull()
  })

  it('does not fall back to an older call when the newest is unknown', () => {
    // The newest call is to a number this client does not own. Pre-selecting
    // the previous conversation's number would be the wrong kind of helpful.
    const calls = [
      { customer_number: '+380990000000', ended_at: minutesAgo(1) },
      { customer_number: '+380501234567', ended_at: minutesAgo(4) },
    ]
    expect(resolve(calls)).toBeNull()
  })

  // ── nothing to do ─────────────────────────────────────────────────────────
  it('returns null with no calls', () => {
    expect(resolve([])).toBeNull()
  })

  it('returns null when the number is not one of the client contacts', () => {
    expect(resolve([{ customer_number: '+380990000000', ended_at: minutesAgo(1) }])).toBeNull()
  })

  it('returns null when the client has no phones', () => {
    const calls = [{ customer_number: '+380501234567', ended_at: minutesAgo(1) }]
    expect(resolveRecentCallPhone({ calls, phones: [], nowMs: NOW })).toBeNull()
  })

  it('survives malformed records', () => {
    const calls = [
      // `customer_number` is required by the type now, so a null one can only
      // arrive from an API that broke its own contract — the cast reproduces
      // that without weakening the interface guarding the call site.
      { customer_number: null as unknown as string, ended_at: minutesAgo(1) },
      { customer_number: '+380501234567', ended_at: 'not-a-date' },
      { customer_number: '', ended_at: minutesAgo(1) },
    ]
    expect(resolve(calls)).toBeNull()
  })
})

/**
 * Round-3 review: a colleague can have spoken to the same client inside the
 * 10-minute window. Their number was being pre-selected into this operator's
 * interaction log — chosen by nobody, and easy not to notice.
 */
describe('resolveRecentCallPhone agent filtering', () => {
  const MINE = '2099'
  const THEIRS = '3100'
  const call = (agent_extension: string | null | undefined) => ({
    customer_number: '+380501234567',
    ended_at: minutesAgo(2),
    agent_extension,
  })

  const withAgent = (
    calls: Parameters<typeof resolveRecentCallPhone>[0]['calls'],
    agentExtension?: string | null
  ) => resolveRecentCallPhone({ calls, phones: PHONES, nowMs: NOW, agentExtension })

  it('keeps a call this operator handled', () => {
    expect(withAgent([call(MINE)], MINE)).toEqual(PHONES[0])
  })

  it("skips a colleague's call to the same client", () => {
    expect(withAgent([call(THEIRS)], MINE)).toBeNull()
  })

  it('skips a call the switchboard could not attribute', () => {
    // '000' is the switchboard's "unknown", not extension zero. It cannot be
    // shown to be this operator's call, and the module prefers no answer to a
    // possibly wrong one.
    expect(withAgent([call('000')], MINE)).toBeNull()
    expect(withAgent([call(null)], MINE)).toBeNull()
  })

  it('does not filter when this operator has no extension configured', () => {
    // Those operators would otherwise lose the feature with no explanation.
    expect(withAgent([call(THEIRS)], undefined)).toEqual(PHONES[0])
    expect(withAgent([call(THEIRS)], '000')).toEqual(PHONES[0])
  })

  it("prefers this operator's older call over a colleague's newer one", () => {
    // The filter has to run BEFORE "most recent wins", or the colleague's call
    // still decides the answer by being the latest.
    const picked = withAgent(
      [
        { customer_number: '+380501234567', ended_at: minutesAgo(5), agent_extension: MINE },
        { customer_number: '+380671112233', ended_at: minutesAgo(1), agent_extension: THEIRS },
      ],
      MINE
    )
    expect(picked).toEqual(PHONES[0])
  })
})
