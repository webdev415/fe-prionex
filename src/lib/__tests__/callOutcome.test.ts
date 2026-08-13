/**
 * Unit tests for the shared call-outcome classifier (KAN-490).
 */

import { describe, expect, it } from 'vitest'

import { classifyCallOutcome, isNonAnsweredOutcome, OUTCOME_PALETTE_CLASSES } from '../callOutcome'

describe('classifyCallOutcome', () => {
  it.each([
    ['answered', 'pages.clients.statuses.answered', 'Answered', 'success'],
    ['ANSWERED', 'pages.clients.statuses.answered', 'Answered', 'success'],
    ['completed', 'pages.clients.statuses.answered', 'Answered', 'success'],
    ['no_answer', 'pages.clients.statuses.noAnswer', 'No answer', 'error'],
    ['no answer', 'pages.clients.statuses.noAnswer', 'No answer', 'error'],
    ['NO ANSWER', 'pages.clients.statuses.noAnswer', 'No answer', 'error'],
    ['missed', 'pages.clients.statuses.missed', 'Missed', 'error'],
    ['MISSED', 'pages.clients.statuses.missed', 'Missed', 'error'],
    ['rejected', 'pages.clients.statuses.rejected', 'Rejected', 'warning'],
    ['REJECTED', 'pages.clients.statuses.rejected', 'Rejected', 'warning'],
    ['busy', 'pages.clients.statuses.busy', 'Busy', 'gray'],
    ['cancel', 'pages.clients.statuses.cancel', 'Cancelled', 'warning'],
    ['unavailable', 'pages.clients.statuses.unavailable', 'Unavailable', 'error'],
    ['congestion', 'pages.clients.statuses.congestion', 'Congestion', 'warning'],
    ['failed', 'pages.clients.statuses.failed', 'Failed', 'error'],
    ['delivered', 'pages.clients.statuses.delivered', 'Delivered', 'success'],
    ['Sent', 'pages.clients.statuses.sent', 'Sent', 'warning'],
    ['skipped', 'pages.clients.statuses.skipped', 'Skipped', 'gray'],
    ['bounced', 'pages.clients.statuses.bounced', 'Bounced', 'error'],
    ['queued', 'pages.messagingCampaigns.status.queued', 'Queued', 'warning'],
    ['sending', 'pages.messagingCampaigns.status.sending', 'Sending', 'warning'],
    [
      'partially_failed',
      'pages.messagingCampaigns.status.partially_failed',
      'Partially failed',
      'warning',
    ],
    ['pending', 'pages.clients.statuses.pending', 'Pending', 'warning'],
    ['initiated', 'pages.clients.statuses.pending', 'Pending', 'warning'],
    ['ringing', 'pages.clients.statuses.pending', 'Pending', 'warning'],
  ])('maps %s → labelKey=%s, fallback=%s, palette=%s', (input, labelKey, fallback, palette) => {
    const result = classifyCallOutcome(input)
    expect(result.labelKey).toBe(labelKey)
    expect(result.fallback).toBe(fallback)
    expect(result.palette).toBe(palette)
  })

  it('returns the raw input as fallback for unknown statuses', () => {
    const result = classifyCallOutcome('voicemail')
    expect(result.labelKey).toBe('')
    expect(result.fallback).toBe('voicemail')
    expect(result.palette).toBe('gray')
  })

  it('handles null and undefined defensively', () => {
    expect(classifyCallOutcome(null)).toEqual({ labelKey: '', fallback: '', palette: 'gray' })
    expect(classifyCallOutcome(undefined)).toEqual({ labelKey: '', fallback: '', palette: 'gray' })
  })
})

describe('classifyCallOutcome — direction-sensitive outcomes', () => {
  // 'cancel' and 'no_answer' describe opposite events depending on direction,
  // so labelling them the same way would misreport one of the two.
  it.each([
    ['cancel', 'inbound', 'Dropped by client'],
    ['cancelled', 'inbound', 'Dropped by client'],
    ['cancel', 'outbound', 'Cancelled'],
    ['no_answer', 'inbound', 'Missed'],
    ['no_answer', 'outbound', 'No answer'],
  ])('%s on an %s call reads as "%s"', (status, direction, expected) => {
    expect(classifyCallOutcome(status, direction).fallback).toBe(expected)
  })

  it('keeps the outbound wording when the direction is unknown', () => {
    // Existing call sites that never pass a direction must not change meaning.
    expect(classifyCallOutcome('cancel').fallback).toBe('Cancelled')
    expect(classifyCallOutcome('no_answer', null).fallback).toBe('No answer')
    expect(classifyCallOutcome('no_answer', '').fallback).toBe('No answer')
  })

  it('is unaffected by direction casing or padding', () => {
    expect(classifyCallOutcome('cancel', ' Inbound ').fallback).toBe('Dropped by client')
  })

  it.each(['inbound', 'outbound', undefined])(
    'leaves rejected and answered alone for direction=%s',
    (direction) => {
      expect(classifyCallOutcome('rejected', direction).fallback).toBe('Rejected')
      expect(classifyCallOutcome('answered', direction).fallback).toBe('Answered')
    }
  )

  it('gives inbound no_answer and the missed fallback the same label', () => {
    // 'missed' is only written when DialEnd was lost, so the two must not read
    // as different things to an operator.
    expect(classifyCallOutcome('no_answer', 'inbound').fallback).toBe(
      classifyCallOutcome('missed', 'inbound').fallback
    )
  })
})

describe('isNonAnsweredOutcome', () => {
  it.each([
    ['no_answer', true],
    ['NO ANSWER', true],
    ['missed', true],
    ['rejected', true],
    ['busy', true],
    ['cancel', true],
    ['unavailable', true],
    ['congestion', true],
    ['failed', true],
    ['answered', false],
    ['completed', false],
    ['delivered', false],
    ['pending', false],
    ['ringing', false],
    ['voicemail', false], // unknown outcomes default to false so we don't hide data
    ['', false],
  ])('returns %s -> %s', (input, expected) => {
    expect(isNonAnsweredOutcome(input)).toBe(expected)
  })

  it('handles null and undefined defensively', () => {
    expect(isNonAnsweredOutcome(null)).toBe(false)
    expect(isNonAnsweredOutcome(undefined)).toBe(false)
  })
})

describe('OUTCOME_PALETTE_CLASSES', () => {
  it('exposes literal Tailwind classes for every palette', () => {
    for (const palette of ['success', 'error', 'warning', 'gray'] as const) {
      const cls = OUTCOME_PALETTE_CLASSES[palette]
      expect(cls.dot).toMatch(/^bg-/)
      expect(cls.ring).toMatch(/^bg-/)
      expect(cls.text).toMatch(/^text-/)
      expect(cls.pill).toMatch(/^bg-/)
    }
  })
})
