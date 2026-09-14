import { describe, expect, it } from 'vitest'
import { MAX_TRACKABLE_CLIENT_ID, toTrackableClientId } from '../trackableClientId'

describe('toTrackableClientId', () => {
  it.each([
    ['5', 5],
    [5, 5],
    ['1', 1],
    [String(MAX_TRACKABLE_CLIENT_ID), MAX_TRACKABLE_CLIENT_ID],
  ])('keeps a real client id: %s', (value, expected) => {
    expect(toTrackableClientId(value)).toBe(expected)
  })

  it.each([
    ['a stale 13-digit URL', '99999999999999'],
    ['one past the column', String(MAX_TRACKABLE_CLIENT_ID + 1)],
    ['zero, the payment pages’ "no id"', 0],
    ['a negative', '-3'],
    ['a fraction', '5.5'],
    ['text', 'abc'],
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('drops what no client can be: %s', (_label, value) => {
    expect(toTrackableClientId(value)).toBeNull()
  })
})
