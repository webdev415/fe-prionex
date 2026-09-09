import { describe, expect, it } from 'vitest'

import {
  RR_STATUS,
  RR_STATUS_FILTER_OPTIONS,
  RR_WITHOUT,
  rrBadgeClass,
  rrFilterMeta,
  rrStatusMeta,
} from '../rrStatus'

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
    for (const id of Object.values(RR_STATUS)) {
      expect(RR_STATUS_FILTER_OPTIONS).toContain(id)
    }
  })

  it('adds "Without RR" as a seventh option, last (KAN-1054)', () => {
    expect(RR_STATUS_FILTER_OPTIONS).toHaveLength(Object.values(RR_STATUS).length + 1)
    expect(RR_STATUS_FILTER_OPTIONS.at(-1)).toBe(RR_WITHOUT)
  })
})

describe('RR_WITHOUT (KAN-1054)', () => {
  it('is not one of the real statuses', () => {
    // There is no row 0 in `restructuring_statuses`; it is a filter value only.
    expect(Object.values(RR_STATUS)).not.toContain(RR_WITHOUT)
  })

  it('stays out of the badge map, so it can never render as a status badge', () => {
    // `rrStatusMeta` feeds `rrBadgeClass` on the client card and the loan card.
    expect(rrStatusMeta[RR_WITHOUT]).toBeUndefined()
    expect(rrBadgeClass(RR_WITHOUT)).toBe(rrBadgeClass(999))
  })

  it('survives a comma-joined query param, despite being falsy', () => {
    // 0 is falsy in JS; a truthiness filter anywhere on the path would drop it
    // silently and the checkbox would look ticked but do nothing.
    expect([RR_STATUS.Connected, RR_WITHOUT].join(',')).toBe('1,0')
  })
})

describe('rrFilterMeta', () => {
  it('labels every checkbox the filter renders', () => {
    for (const id of RR_STATUS_FILTER_OPTIONS) {
      const meta = rrFilterMeta[id]
      expect(meta).toBeDefined()
      expect(meta.labelKey.length).toBeGreaterThan(0)
      expect(meta.fallbackLabel.length).toBeGreaterThan(0)
    }
  })

  it('keeps the six real statuses labelled exactly as before', () => {
    for (const id of Object.values(RR_STATUS)) {
      expect(rrFilterMeta[id].labelKey).toBe(rrStatusMeta[id].labelKey)
      expect(rrFilterMeta[id].fallbackLabel).toBe(rrStatusMeta[id].fallbackLabel)
    }
  })
})
