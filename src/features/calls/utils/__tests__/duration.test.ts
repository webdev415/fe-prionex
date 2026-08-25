import { describe, it, expect } from 'vitest'

import { formatCallDuration } from '../duration'

describe('formatCallDuration', () => {
  it.each([
    [0, '00:00'],
    [9, '00:09'],
    [222, '03:42'],
    [3599, '59:59'],
  ])('renders %i seconds as %s', (input, expected) => {
    expect(formatCallDuration(input)).toBe(expected)
  })

  it('grows an hours field rather than showing 60+ minutes', () => {
    // The previous formatter produced "60:00" for an hour-long call.
    expect(formatCallDuration(3600)).toBe('1:00:00')
    expect(formatCallDuration(3661)).toBe('1:01:01')
  })

  it.each([-5, NaN, Infinity])('treats %s as no elapsed time', (input) => {
    // A negative or absent duration must not render as "NaN:NaN" beside a live
    // call.
    expect(formatCallDuration(input)).toBe('00:00')
  })
})
