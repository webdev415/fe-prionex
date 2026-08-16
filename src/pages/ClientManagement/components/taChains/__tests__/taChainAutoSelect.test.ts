import { describe, expect, it } from 'vitest'
import { pickSingleContactCandidate, type AutoSelectArgs } from '../taChainAutoSelect'

/**
 * KAN-977 — a contact step with exactly one candidate should select it, so the
 * operator does not click the only option available.
 *
 * The rules that are easy to get wrong, and what happens if you do:
 *
 * * the candidate list is FETCHED, so it is `undefined` on the render where the
 *   step becomes current. Treating that as "no candidates" means never selecting.
 * * a template preset or the opened-from-a-phone-row prefill must win, otherwise
 *   this quietly overwrites a value the operator or admin chose.
 * * it must fire once. The radio list lets the operator untick the checked entry;
 *   refilling on the next render leaves an entry that cannot be cleared.
 * * two or more candidates is the operator's choice — pre-selecting one of
 *   several is the hotkey-only heuristic in KAN-973, out of scope here.
 */

const args = (over: Partial<AutoSelectArgs> = {}): AutoSelectArgs => ({
  fieldType: 'contact',
  isEmailStep: false,
  candidates: [{ contact_value: '0501234567' }],
  currentValue: '',
  alreadyAutoSelected: false,
  ...over,
})

describe('pickSingleContactCandidate', () => {
  // ── the feature ───────────────────────────────────────────────────────────
  it('selects the only candidate', () => {
    expect(pickSingleContactCandidate(args())).toBe('0501234567')
  })

  // ── the counts the ticket leaves unchanged ────────────────────────────────
  it('leaves the step alone when several candidates exist', () => {
    expect(
      pickSingleContactCandidate(
        args({
          candidates: [{ contact_value: '0501234567' }, { contact_value: '0509876543' }],
        })
      )
    ).toBeNull()
  })

  it('leaves the step alone when there are no candidates', () => {
    // Zero keeps the existing phone-step error state — no new UI.
    expect(pickSingleContactCandidate(args({ candidates: [] }))).toBeNull()
  })

  // ── the async trap ────────────────────────────────────────────────────────
  it('waits while the candidate list is still loading', () => {
    // `undefined` is "not fetched yet", not "none". If this returned a value or
    // permanently gave up, the feature would either crash or never fire.
    expect(pickSingleContactCandidate(args({ candidates: undefined }))).toBeNull()
  })

  it('selects once the list arrives', () => {
    expect(pickSingleContactCandidate(args({ candidates: undefined }))).toBeNull()
    expect(pickSingleContactCandidate(args())).toBe('0501234567')
  })

  // ── things that outrank it ────────────────────────────────────────────────
  it('does not overwrite a template preset', () => {
    expect(pickSingleContactCandidate(args({ currentValue: 'preset-value' }))).toBeNull()
  })

  it('does not overwrite the phone prefilled by the per-phone entry point', () => {
    // The "Log interaction" buttons next to each phone already pass one in.
    // The ticket says twice that those are unchanged by this feature.
    expect(pickSingleContactCandidate(args({ currentValue: '0509999999' }))).toBeNull()
  })

  it('does not re-select after the operator unticks it', () => {
    expect(pickSingleContactCandidate(args({ alreadyAutoSelected: true }))).toBeNull()
  })

  // ── scope ─────────────────────────────────────────────────────────────────
  it('ignores steps that are not contact steps', () => {
    for (const fieldType of ['text', 'dropdown', 'date', 'amount', 'credit']) {
      expect(pickSingleContactCandidate(args({ fieldType }))).toBeNull()
    }
  })

  it('ignores email contact steps', () => {
    // The ticket says phone throughout; a lone email is a separate decision.
    expect(
      pickSingleContactCandidate(
        args({ isEmailStep: true, candidates: [{ contact_value: 'a@b.com' }] })
      )
    ).toBeNull()
  })

  it('handles a missing field type', () => {
    expect(pickSingleContactCandidate(args({ fieldType: undefined }))).toBeNull()
    expect(pickSingleContactCandidate(args({ fieldType: null }))).toBeNull()
  })

  // ── data defects ──────────────────────────────────────────────────────────
  it('does not select a blank contact value', () => {
    // A blank would set the step to '' — indistinguishable from unselected, and
    // it would retrigger on every render.
    expect(pickSingleContactCandidate(args({ candidates: [{ contact_value: '' }] }))).toBeNull()
  })
})
