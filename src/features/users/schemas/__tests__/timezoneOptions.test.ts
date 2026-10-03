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

  // Story 17-66a: operators of the Canadian CRM pick the zone of their province.
  it('offers the three Canadian provinces of Loan Bridge', () => {
    expect(timezoneOptions.map((o) => [o.value, o.label])).toEqual(
      expect.arrayContaining([
        ['America/Edmonton', 'America/Edmonton (MST/MDT) — Alberta'],
        ['America/Toronto', 'America/Toronto (EST/EDT) — Ontario'],
        ['America/Vancouver', 'America/Vancouver (PST/PDT) — British Columbia'],
      ])
    )
  })

  it('offers the neighbouring Canadian zones', () => {
    expect(timezoneOptions.map((o) => [o.value, o.label])).toEqual(
      expect.arrayContaining([
        ['America/Regina', 'America/Regina (CST) — Saskatchewan'],
        ['America/Winnipeg', 'America/Winnipeg (CST/CDT) — Manitoba'],
        ['America/Halifax', 'America/Halifax (AST/ADT) — Atlantic'],
      ])
    )
  })

  it('keeps the previous zones in place', () => {
    // The twelve zones offered before 17-66a keep their values, labels and order
    // (Europe/Kiev included: users may have it saved). Zones added later anywhere
    // in the list do not break this scene.
    const previous = [
      ['Europe/Kyiv', 'Europe/Kyiv (EET/EEST)'],
      ['UTC', 'UTC (Coordinated Universal Time)'],
      ['America/New_York', 'America/New York (EST/EDT)'],
      ['America/Chicago', 'America/Chicago (CST/CDT)'],
      ['America/Denver', 'America/Denver (MST/MDT)'],
      ['America/Los_Angeles', 'America/Los Angeles (PST/PDT)'],
      ['Europe/London', 'Europe/London (GMT/BST)'],
      ['Europe/Madrid', 'Europe/Madrid (CET/CEST)'],
      ['Europe/Paris', 'Europe/Paris (CET/CEST)'],
      ['Europe/Kiev', 'Europe/Kiev (EET/EEST)'],
      ['Asia/Tokyo', 'Asia/Tokyo (JST)'],
      ['Australia/Sydney', 'Australia/Sydney (AEST/AEDT)'],
    ]
    const previousValues = new Set(previous.map(([value]) => value))
    expect(
      timezoneOptions.filter((o) => previousValues.has(o.value)).map((o) => [o.value, o.label])
    ).toEqual(previous)

    // The six Canadian zones follow America/Los_Angeles in the order of the story table.
    const values: string[] = timezoneOptions.map((o) => o.value)
    const afterLosAngeles = values.indexOf('America/Los_Angeles') + 1
    expect(values.slice(afterLosAngeles, afterLosAngeles + 6)).toEqual([
      'America/Edmonton',
      'America/Toronto',
      'America/Vancouver',
      'America/Regina',
      'America/Winnipeg',
      'America/Halifax',
    ])
  })
})
