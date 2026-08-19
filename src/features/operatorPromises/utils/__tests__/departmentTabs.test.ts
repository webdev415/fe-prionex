import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPERATOR_PROMISES_TAB,
  OPERATOR_PROMISES_TAB_IDS,
  filterRowsByTab,
  resolveOperatorPromisesTab,
} from '../departmentTabs'
import type { OperatorPromisesRow } from '../../api/types'

function makeRow(overrides: Partial<OperatorPromisesRow> = {}): OperatorPromisesRow {
  return {
    user_id: 101,
    fio: 'Баженов Олексій Володимирович',
    department: 'Стягнення',
    group_name: 'Група №2',
    is_active: true,
    interactions_count: 314,
    sum_from: '112062.00',
    sum_to: '24000.00',
    paid_full: '31400.00',
    paid_verified: '31400.00',
    unpaid: '-7400.00',
    conversion: '1.308333',
    verified_unpaid: '-7400.00',
    verified_conversion: '1.308333',
    ...overrides,
  }
}

describe('resolveOperatorPromisesTab', () => {
  it('keeps the four known tab ids', () => {
    for (const id of OPERATOR_PROMISES_TAB_IDS) {
      expect(resolveOperatorPromisesTab(id)).toBe(id)
    }
  })

  it('falls back to the default tab for an absent ?opd=', () => {
    expect(resolveOperatorPromisesTab(null)).toBe(DEFAULT_OPERATOR_PROMISES_TAB)
  })

  it('falls back to the default tab for an unknown ?opd=', () => {
    // Hand-edited or stale links must not render an empty screen.
    expect(resolveOperatorPromisesTab('lawyers')).toBe(DEFAULT_OPERATOR_PROMISES_TAB)
    expect(resolveOperatorPromisesTab('')).toBe(DEFAULT_OPERATOR_PROMISES_TAB)
    expect(resolveOperatorPromisesTab('Стягнення')).toBe(DEFAULT_OPERATOR_PROMISES_TAB)
  })

  it('defaults to the whole picture, as Techno-Finance defaults to «Общее»', () => {
    expect(DEFAULT_OPERATOR_PROMISES_TAB).toBe('all')
    // …and it is FIRST in the strip, again as in Techno-Finance (general → ТП →
    // Дайлер → Взыск, where «Взыск» is this report's «Стягнення»).
    expect([...OPERATOR_PROMISES_TAB_IDS]).toEqual(['all', 'tp', 'dialer', 'collection'])
  })
})

describe('filterRowsByTab', () => {
  const tp = makeRow({ user_id: 1, department: 'ТП' })
  const dialer = makeRow({ user_id: 2, department: 'Дайлер' })
  const collection = makeRow({ user_id: 3, department: 'Стягнення' })
  const lawyer = makeRow({ user_id: 4, department: 'Юристи' })
  const analyst = makeRow({ user_id: 5, department: 'Аналітики' })
  const homeless = makeRow({ user_id: 6, department: null })
  const rows = [tp, dialer, collection, lawyer, analyst, homeless]

  it('keeps every row on the «Всі» tab, including the departments the card drops', () => {
    // Юристи + Аналітики + no-department held ≈ 631 000 ₴ of July 2026
    // collections that the Techno-Finance frontend silently loses.
    expect(filterRowsByTab(rows, 'all')).toEqual(rows)
  })

  it('returns the same array reference for «Всі» (no memo churn)', () => {
    expect(filterRowsByTab(rows, 'all')).toBe(rows)
  })

  it.each([
    ['tp', 'ТП'],
    ['dialer', 'Дайлер'],
    ['collection', 'Стягнення'],
  ] as const)('keeps only the %s department rows', (tabId, department) => {
    const filtered = filterRowsByTab(rows, tabId)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].department).toBe(department)
  })

  it('never shows a department-less operator on a department tab', () => {
    // A department tab matches an exact name, so the null department can only
    // ever be read on «Всі» — which is exactly why «Всі» exists.
    for (const tabId of ['tp', 'dialer', 'collection'] as const) {
      expect(filterRowsByTab(rows, tabId)).not.toContain(homeless)
    }
  })

  it('returns an empty list rather than everything when a department has no rows', () => {
    expect(filterRowsByTab([lawyer, homeless], 'tp')).toEqual([])
  })

  it('matches the department name exactly, without trimming or case folding', () => {
    // Documenting the contract limitation: the response carries a display
    // STRING and no department id, so a name that drifts in the auth directory
    // drops out of its tab (and stays visible on «Всі»).
    expect(filterRowsByTab([makeRow({ department: 'тп' })], 'tp')).toEqual([])
    expect(filterRowsByTab([makeRow({ department: 'ТП ' })], 'tp')).toEqual([])
  })
})
