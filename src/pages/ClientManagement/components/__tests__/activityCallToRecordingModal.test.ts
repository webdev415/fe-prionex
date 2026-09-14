/**
 * The call-recording modal, filled from a call the activity feed offered.
 * The suite runs with TZ=UTC (vitest.config.ts), so a Kyiv profile -- UTC+3
 * in September -- makes the browser's zone and the profile's disagree.
 */

import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { activityCallToRecordingModal } from '../activityCallToRecordingModal'
import type { ActivityCallRef } from '../ClientActivityLogTab'

const t = ((key: string) => key) as unknown as TFunction

function call(over: Partial<ActivityCallRef> = {}): ActivityCallRef {
  return {
    callId: 'c-1',
    direction: 'outbound',
    operatorName: 'Seven Operator',
    talkDurationSeconds: 145,
    ts: '2026-09-01T10:00:00Z',
    ...over,
  }
}

const build = (c: ActivityCallRef, timezone: string | null = 'Europe/Kyiv') =>
  activityCallToRecordingModal(c, {
    t,
    locale: 'en',
    timezone,
    clientName: 'Ivanenko Ivan',
    phone: '+380501112233',
  })

describe('activityCallToRecordingModal', () => {
  it('fills the modal from the row and the client on screen', () => {
    expect(build(call())).toEqual({
      type: 'pages.clients.modals.callLogCard.callTypes.outgoing',
      clientName: 'Ivanenko Ivan',
      date: '9/1/2026',
      time: '1:00:00 PM',
      operator: 'Seven Operator',
      duration: '2:25',
      phone: '+380501112233',
      call_id: 'c-1',
      direction: 'outbound',
    })
  })

  it('shows the time in the profile timezone, as the row did', () => {
    // 22:30 UTC is already the next day in Kyiv. The browser's zone would
    // put the modal on a different date than the row it was opened from.
    const data = build(call({ ts: '2026-09-01T22:30:00Z' }))

    expect(data.date).toBe('9/2/2026')
    expect(data.time).toBe('1:30:00 AM')
  })

  it('falls back to the browser zone without a profile timezone', () => {
    const data = build(call({ ts: '2026-09-01T22:30:00Z' }), null)

    expect([data.date, data.time]).toEqual(['9/1/2026', '10:30:00 PM'])
  })

  it('survives an unknown timezone name rather than blanking the modal', () => {
    const data = build(call(), 'Not/AZone')

    expect(data.date).not.toBe('')
    expect(data.time).not.toBe('')
  })

  it('names an inbound call as incoming', () => {
    expect(build(call({ direction: 'inbound' })).type).toBe(
      'pages.clients.modals.callLogCard.callTypes.incoming'
    )
  })

  it.each([
    [145, '2:25'],
    [5, '0:05'],
    [0, '0:00'],
    [600, '10:00'],
  ])('formats %s seconds as %s', (seconds, shown) => {
    expect(build(call({ talkDurationSeconds: seconds })).duration).toBe(shown)
  })

  it('leaves what it does not know empty rather than inventing it', () => {
    const data = activityCallToRecordingModal(
      call({ ts: 'not-a-date', talkDurationSeconds: null, operatorName: null }),
      { t, locale: 'en' }
    )

    expect(data).toMatchObject({
      date: '',
      time: '',
      duration: '',
      operator: '',
      clientName: '',
      phone: '',
    })
  })
})
