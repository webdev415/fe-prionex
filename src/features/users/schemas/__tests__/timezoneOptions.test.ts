import { describe, expect, it } from 'vitest'
import { timezoneOptions } from '../userSchemas'

describe('timezoneOptions', () => {
  it('offers the zone Spanish operators work in', () => {
    expect(timezoneOptions.map((o) => o.value)).toContain('Europe/Madrid')
  })

  it('keeps every zone unique', () => {
    const values = timezoneOptions.map((o) => o.value)
    expect(new Set(values).size).toBe(values.length)
  })
})
