import { describe, expect, it, vi } from 'vitest'

import {
  resolveDateSide,
  resolveEmployeeScopeParam,
  resolvePresetToFilters,
} from '../lib/resolvePreset'
import type { ClientFilterPresetParams, RelativeEmployeeScope } from '../types'

// A preset is stored as parameters, not values. Everything here exists to pin
// that: the same saved preset must mean something different on a different day,
// or with different group membership, and only the explicitly-chosen options
// may stay frozen.

const NOW = new Date(2026, 8, 10) // 10 September 2026, local time
const noScopes = () => []

describe('resolveDateSide', () => {
  it('sets no bound for "any date"', () => {
    expect(resolveDateSide({ mode: 'any' }, NOW)).toBeUndefined()
    expect(resolveDateSide(undefined, NOW)).toBeUndefined()
  })

  it('resolves today and the start of the month from the clock', () => {
    expect(resolveDateSide({ mode: 'today' }, NOW)).toBe('2026-09-10')
    expect(resolveDateSide({ mode: 'startOfMonth' }, NOW)).toBe('2026-09-01')
  })

  it('offsets by N days in both directions', () => {
    expect(resolveDateSide({ mode: 'minusDays', days: 7 }, NOW)).toBe('2026-09-03')
    expect(resolveDateSide({ mode: 'plusDays', days: 5 }, NOW)).toBe('2026-09-15')
  })

  it('treats a missing N as zero rather than as no bound', () => {
    // The spec defaults the field to 0, so the side still sets today's date.
    expect(resolveDateSide({ mode: 'minusDays' }, NOW)).toBe('2026-09-10')
  })

  it('crosses month and year boundaries', () => {
    expect(resolveDateSide({ mode: 'minusDays', days: 20 }, NOW)).toBe('2026-08-21')
    expect(resolveDateSide({ mode: 'minusDays', days: 300 }, NOW)).toBe('2025-11-14')
  })

  it('passes a custom date through, and treats an unfilled one as no bound', () => {
    expect(resolveDateSide({ mode: 'custom', date: '2026-01-31' }, NOW)).toBe('2026-01-31')
    expect(resolveDateSide({ mode: 'custom' }, NOW)).toBeUndefined()
  })

  it('recomputes relative modes from the day it is applied', () => {
    // The point of storing parameters: the same side, a month later.
    const later = new Date(2026, 9, 10)
    const side = { mode: 'minusDays', days: 7 } as const
    expect(resolveDateSide(side, NOW)).toBe('2026-09-03')
    expect(resolveDateSide(side, later)).toBe('2026-10-03')
  })
})

describe('resolveEmployeeScopeParam', () => {
  it('applies no filter for "any"', () => {
    expect(resolveEmployeeScopeParam({ scope: 'any' }, noScopes)).toBeUndefined()
    expect(resolveEmployeeScopeParam(undefined, noScopes)).toBeUndefined()
  })

  it('asks the caller for a relative scope rather than using a stored list', () => {
    const resolve = vi.fn<(s: RelativeEmployeeScope) => number[]>(() => [4, 5])
    expect(resolveEmployeeScopeParam({ scope: 'myGroup' }, resolve)).toEqual([4, 5])
    expect(resolve).toHaveBeenCalledWith('myGroup')
  })

  it('ignores a stored list on a relative scope', () => {
    // Membership must win over whatever was saved, or the preset silently
    // filters by a group that has since changed.
    const resolve = () => [9]
    expect(
      resolveEmployeeScopeParam({ scope: 'myDepartment', employeeIds: [1, 2] }, resolve)
    ).toEqual([9])
  })

  it('keeps a custom list exactly as saved', () => {
    const resolve = vi.fn<(s: RelativeEmployeeScope) => number[]>(() => [99])
    expect(resolveEmployeeScopeParam({ scope: 'custom', employeeIds: [1, 2] }, resolve)).toEqual([
      1, 2,
    ])
    expect(resolve).not.toHaveBeenCalled()
  })

  it('treats an empty selection as no filter', () => {
    expect(
      resolveEmployeeScopeParam({ scope: 'custom', employeeIds: [] }, noScopes)
    ).toBeUndefined()
    expect(resolveEmployeeScopeParam({ scope: 'myGroup' }, () => [])).toBeUndefined()
  })
})

describe('resolvePresetToFilters', () => {
  it('omits every unset field rather than setting it to undefined', () => {
    // Applying a preset replaces the whole filter state, so a stray key reads
    // as "set to nothing" once the object is spread or serialised.
    const filters = resolvePresetToFilters({}, { now: NOW, resolveEmployeeScope: noScopes })
    expect(Object.keys(filters)).toEqual([])
  })

  it("maps the ticket's filter rows onto the client list fields", () => {
    const params: ClientFilterPresetParams = {
      totalDebt: { from: 100, to: 900 },
      principalDebt: { from: 50 },
      dpd: { to: 30 },
      dateOfSale: { from: { mode: 'startOfMonth' }, to: { mode: 'today' } },
      targetActionDate: { from: { mode: 'any' }, to: { mode: 'plusDays', days: 3 } },
      portfolioIds: [7],
      tagIds: [1, 2],
      excludeTagIds: [3],
      rrStatusIds: [4],
      chainIds: [11],
      chainStepIds: [22],
      onlyLastChain: true,
      responsibleSearcher: 'searcher-1',
    }
    const f = resolvePresetToFilters(params, { now: NOW, resolveEmployeeScope: noScopes })

    // debtRange, not amountOfDebtRange: the latter is declared on ClientFilters
    // but nothing reads it, so a preset written there would filter nothing.
    expect(f.debtRangeFrom).toBe(100)
    expect(f.debtRangeTo).toBe(900)
    expect(f.amountOfDebtRangeFrom).toBeUndefined()
    expect(f.principalRangeFrom).toBe(50)
    expect(f.dpdRangeTo).toBe(30)
    expect(f.dateOfSaleFrom).toBe('2026-09-01')
    expect(f.dateOfSaleTo).toBe('2026-09-10')
    expect(f.taDateTo).toBe('2026-09-13')
    expect(f.portfolio).toEqual([7])
    expect(f.tagIds).toEqual([1, 2])
    expect(f.excludeTagIds).toEqual([3])
    expect(f.rrStatusIds).toEqual([4])
    expect(f.chainIds).toEqual([11])
    expect(f.chainStepIds).toEqual([22])
    expect(f.onlyLastChain).toBe(true)
    expect(f.responsibleSearcher).toBe('searcher-1')

    // "Any date" on one side must leave that bound unset, not empty.
    expect('taDateFrom' in f).toBe(false)
  })

  it('resolves both employee filters through the directory', () => {
    const resolve = vi.fn<(s: RelativeEmployeeScope) => number[]>((s) =>
      s === 'myGroup' ? [1, 2] : [8]
    )
    const f = resolvePresetToFilters(
      {
        interactionCreated: { scope: 'myGroup' },
        responsibleEmployee: { scope: 'everyoneExceptMe' },
      },
      { now: NOW, resolveEmployeeScope: resolve }
    )
    expect(f.interactionUserIds).toEqual([1, 2])
    expect(f.responsibleEmployeeIds).toEqual([8])
  })

  it('drops an empty multi-select instead of filtering on nothing', () => {
    const f = resolvePresetToFilters(
      { tagIds: [], portfolioIds: [], chainIds: [] },
      { now: NOW, resolveEmployeeScope: noScopes }
    )
    expect('tagIds' in f).toBe(false)
    expect('portfolio' in f).toBe(false)
    expect('chainIds' in f).toBe(false)
  })

  it('drops a blank collector rather than filtering on an empty string', () => {
    const f = resolvePresetToFilters(
      { responsibleSearcher: '' },
      { now: NOW, resolveEmployeeScope: noScopes }
    )
    expect('responsibleSearcher' in f).toBe(false)
  })
})
