import { describe, it, expect } from 'vitest'
import { resolveCallOutcomeDisplay } from '../callOutcome'

describe('resolveCallOutcomeDisplay', () => {
  it('resolves a fully-null pair to "none" (never called — render "—")', () => {
    expect(resolveCallOutcomeDisplay(null, null)).toEqual({ kind: 'none' })
  })

  it('treats a blank outcome without a call date as "none" too', () => {
    // The column is a free VARCHAR — an empty string carries exactly as much
    // information as NULL, so it must not turn "never called" into "unknown".
    expect(resolveCallOutcomeDisplay(null, '')).toEqual({ kind: 'none' })
    expect(resolveCallOutcomeDisplay(null, '   ')).toEqual({ kind: 'none' })
  })

  it('resolves a call date with a null outcome to "unknown"', () => {
    expect(resolveCallOutcomeDisplay('2026-08-11T15:02:44Z', null)).toEqual({ kind: 'unknown' })
  })

  it('resolves a call date with a blank or whitespace-only outcome to "unknown"', () => {
    // The Metabase card's CASE collapsed NULL to '' — the inherited edge.
    expect(resolveCallOutcomeDisplay('2026-08-11T15:02:44Z', '')).toEqual({ kind: 'unknown' })
    expect(resolveCallOutcomeDisplay('2026-08-11T15:02:44Z', '   ')).toEqual({ kind: 'unknown' })
  })

  it('resolves a recognised outcome to "known" with the shared classifier label', () => {
    // The feed carries no call direction, so `no_answer` gets the classifier's
    // outbound wording — its documented default for calls of unknown provenance.
    expect(resolveCallOutcomeDisplay('2026-08-11T15:02:44Z', 'no_answer')).toEqual({
      kind: 'known',
      labelKey: 'pages.clients.statuses.noAnswer',
      fallback: 'No answer',
    })
    expect(resolveCallOutcomeDisplay('2026-08-11T15:02:44Z', 'completed')).toEqual({
      kind: 'known',
      labelKey: 'pages.clients.statuses.answered',
      fallback: 'Answered',
    })
  })

  it('resolves an unrecognised non-blank outcome to "raw", verbatim', () => {
    // The backend deliberately does not enum-validate the column: a future
    // value must neither crash nor masquerade as "Unknown" — a raw `voicemail`
    // is ugly but truthful.
    expect(resolveCallOutcomeDisplay('2026-08-11T15:02:44Z', 'voicemail')).toEqual({
      kind: 'raw',
      value: 'voicemail',
    })
  })

  it('still renders an outcome that arrives WITHOUT a call date', () => {
    // The edge the contract calls impossible — showing data beats hiding it.
    expect(resolveCallOutcomeDisplay(null, 'no_answer')).toEqual({
      kind: 'known',
      labelKey: 'pages.clients.statuses.noAnswer',
      fallback: 'No answer',
    })
    expect(resolveCallOutcomeDisplay(null, 'voicemail')).toEqual({
      kind: 'raw',
      value: 'voicemail',
    })
  })
})
