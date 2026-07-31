import { describe, expect, it } from 'vitest'

import { RR_STATUS, RR_STATUS_FILTER_OPTIONS, rrBadgeClass, rrStatusMeta } from '../rrStatus'

describe('RR_STATUS', () => {
  it('defines Draft as id 6 alongside the existing statuses', () => {
    expect(RR_STATUS.Draft).toBe(6)
    expect(RR_STATUS.Connected).toBe(1)
    expect(RR_STATUS.Violated).toBe(2)
    expect(RR_STATUS.Cancelled).toBe(3)
    expect(RR_STATUS.Completed).toBe(4)
    expect(RR_STATUS.CompletedEarly).toBe(5)
  })
})

describe('rrStatusMeta', () => {
  it('has a label and badge class for every status id', () => {
    for (const id of Object.values(RR_STATUS)) {
      const meta = rrStatusMeta[id]
      expect(meta).toBeDefined()
      expect(meta.fallbackLabel.length).toBeGreaterThan(0)
      expect(meta.labelKey.length).toBeGreaterThan(0)
      expect(meta.badgeClass.length).toBeGreaterThan(0)
    }
  })

  it('gives Draft its own badge class distinct from Connected', () => {
    expect(rrStatusMeta[RR_STATUS.Draft].badgeClass).not.toBe(
      rrStatusMeta[RR_STATUS.Connected].badgeClass
    )
  })
})

describe('rrBadgeClass', () => {
  it('returns the per-status class for a known id', () => {
    expect(rrBadgeClass(RR_STATUS.Draft)).toBe(rrStatusMeta[RR_STATUS.Draft].badgeClass)
    expect(rrBadgeClass(RR_STATUS.Connected)).toBe(rrStatusMeta[RR_STATUS.Connected].badgeClass)
  })

  it('falls back to a neutral class for null, undefined, or unknown ids', () => {
    const neutral = rrBadgeClass(null)
    expect(rrBadgeClass(undefined)).toBe(neutral)
    expect(rrBadgeClass(999)).toBe(neutral)
    expect(neutral).toContain('gray')
  })
})

describe('RR_STATUS_FILTER_OPTIONS', () => {
  it('lists every status with Draft first', () => {
    expect(RR_STATUS_FILTER_OPTIONS[0]).toBe(RR_STATUS.Draft)
    expect([...RR_STATUS_FILTER_OPTIONS].sort()).toEqual([...Object.values(RR_STATUS)].sort())
  })
})
