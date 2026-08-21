import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPERATOR_PROMISES_TAB,
  OPERATOR_PROMISES_FIXED_TAB_IDS,
  collectDynamicDepartmentTabs,
  dynamicDepartmentTabId,
  filterRowsByTab,
  isFixedOperatorPromisesTab,
  resolveOperatorPromisesTab,
} from '../departmentTabs'
import type { OperatorPromisesRow } from '../../api/types'

function makeRow(overrides: Partial<OperatorPromisesRow> = {}): OperatorPromisesRow {
  return {
    user_id: 101,
    fio: 'Баженов Олексій Володимирович',
    department: 'Стягнення',
    department_id: 3,
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

const tp = makeRow({ user_id: 1, department: 'ТП', department_id: 1 })
const dialer = makeRow({ user_id: 2, department: 'Дайлер', department_id: 2 })
const collection = makeRow({ user_id: 3, department: 'Стягнення', department_id: 3 })
const lawyer = makeRow({ user_id: 4, department: 'Юристи', department_id: 17 })
const analyst = makeRow({ user_id: 5, department: 'Аналітики', department_id: 21 })
const homeless = makeRow({ user_id: 6, department: null, department_id: null })
const rows = [tp, dialer, collection, lawyer, analyst, homeless]

describe('resolveOperatorPromisesTab', () => {
  it('keeps the four fixed tab ids', () => {
    for (const id of OPERATOR_PROMISES_FIXED_TAB_IDS) {
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

  it('keeps a dynamic tab id the current response still has', () => {
    const dynamicTabs = collectDynamicDepartmentTabs(rows)

    expect(resolveOperatorPromisesTab('d17', dynamicTabs)).toBe('d17')
    expect(resolveOperatorPromisesTab('d21', dynamicTabs)).toBe('d21')
  })

  it('falls back to «Всі» for a dynamic id this response does not have', () => {
    // A stale bookmark, a department that lost its rows in this period, or the
    // very first render — where no rows have arrived yet. Silent, and NOT
    // written back into the URL by the caller, so the preference survives.
    expect(resolveOperatorPromisesTab('d17', collectDynamicDepartmentTabs([]))).toBe('all')
    expect(resolveOperatorPromisesTab('d17')).toBe('all')
    expect(resolveOperatorPromisesTab('d999', collectDynamicDepartmentTabs(rows))).toBe('all')
  })

  it('refuses a malformed dynamic id even when a real one is available', () => {
    const dynamicTabs = collectDynamicDepartmentTabs(rows)

    expect(resolveOperatorPromisesTab('d', dynamicTabs)).toBe('all')
    expect(resolveOperatorPromisesTab('d17x', dynamicTabs)).toBe('all')
    expect(resolveOperatorPromisesTab('17', dynamicTabs)).toBe('all')
    expect(resolveOperatorPromisesTab('D17', dynamicTabs)).toBe('all')
  })

  it('defaults to the whole picture, as Techno-Finance defaults to «Общее»', () => {
    expect(DEFAULT_OPERATOR_PROMISES_TAB).toBe('all')
    // …and it is FIRST in the strip, again as in Techno-Finance (general → ТП →
    // Дайлер → Взыск, where «Взыск» is this report's «Стягнення»).
    expect([...OPERATOR_PROMISES_FIXED_TAB_IDS]).toEqual(['all', 'tp', 'dialer', 'collection'])
  })

  it('tells the fixed ids apart from the dynamic ones', () => {
    expect(isFixedOperatorPromisesTab('all')).toBe(true)
    expect(isFixedOperatorPromisesTab('collection')).toBe(true)
    expect(isFixedOperatorPromisesTab('d17')).toBe(false)
    // The `d` prefix is what guarantees the two id spaces cannot collide.
    expect(dynamicDepartmentTabId(17)).toBe('d17')
    expect(isFixedOperatorPromisesTab(dynamicDepartmentTabId(17))).toBe(false)
  })
})

describe('collectDynamicDepartmentTabs', () => {
  it('gives every department outside the fixed triple a tab of its own', () => {
    // Юристи + Аналітики held (with the no-department rows) ≈ 631 000 ₴ of July
    // 2026 collections that the Techno-Finance frontend drops entirely.
    expect(collectDynamicDepartmentTabs(rows)).toEqual([
      { id: 'd21', departmentId: 21, label: 'Аналітики' },
      { id: 'd17', departmentId: 17, label: 'Юристи' },
    ])
  })

  it('never duplicates a tab for a department with several operators', () => {
    const tabs = collectDynamicDepartmentTabs([
      lawyer,
      makeRow({ user_id: 7, department: 'Юристи', department_id: 17 }),
      makeRow({ user_id: 8, department: 'Юристи', department_id: 17 }),
    ])

    expect(tabs).toHaveLength(1)
    expect(tabs[0].departmentId).toBe(17)
  })

  it('builds no tab for the departments the fixed triple already claims', () => {
    expect(collectDynamicDepartmentTabs([tp, dialer, collection])).toEqual([])
  })

  it('builds no tab for an operator without a department', () => {
    // No stable key to tab on — that row is readable on «Всі» and nowhere else.
    expect(collectDynamicDepartmentTabs([homeless])).toEqual([])
  })

  it('builds no tab when the id never arrived at all', () => {
    // A response from a backend older than the contract carries no
    // `department_id`. That must read as "no department key" — never as a
    // "dundefined" tab — so the rows stay on «Всі» until the field ships.
    const legacyRow = {
      ...makeRow({ department: 'Юристи' }),
      department_id: undefined,
    } as unknown as OperatorPromisesRow

    expect(collectDynamicDepartmentTabs([legacyRow])).toEqual([])
  })

  it('builds no tab for an id no `d…` tab could be spelled from', () => {
    // Every minted id must be readable back by `filterRowsByTab`, so anything
    // outside a non-negative integer is dropped rather than turned into a tab
    // that would then filter to nothing.
    expect(
      collectDynamicDepartmentTabs([
        makeRow({ user_id: 1, department: 'Юристи', department_id: -1 }),
        makeRow({ user_id: 2, department: 'Аналітики', department_id: 1.5 }),
        makeRow({ user_id: 3, department: 'Безпека', department_id: Number.NaN }),
      ])
    ).toEqual([])
  })

  it('builds no tab for a department with no legible name', () => {
    // An id alone ("d17") names nothing to a reader; the rows stay on «Всі».
    expect(
      collectDynamicDepartmentTabs([
        makeRow({ department: null, department_id: 30 }),
        makeRow({ department: '   ', department_id: 31 }),
      ])
    ).toEqual([])
  })

  it('sorts the dynamic tabs alphabetically in the reader’s locale', () => {
    // «Інкасація» is the discriminator: Ukrainian collation puts «І» between
    // «И» and «Й», while its code point (U+0406) sits BEFORE «А» — a plain
    // `sort()` would open the strip with it.
    const tabs = collectDynamicDepartmentTabs(
      [
        makeRow({ user_id: 1, department: 'Ялинка', department_id: 40 }),
        makeRow({ user_id: 2, department: 'Аналітики', department_id: 41 }),
        makeRow({ user_id: 3, department: 'Юристи', department_id: 42 }),
        makeRow({ user_id: 4, department: 'Інкасація', department_id: 43 }),
      ],
      'uk'
    )

    expect(tabs.map((tab) => tab.label)).toEqual(['Аналітики', 'Інкасація', 'Юристи', 'Ялинка'])
  })

  it('orders two departments sharing a name by id, so the strip is stable', () => {
    // Accepted edge: two tabs read the same, but each keeps its own rows and
    // its own place — merging them would sum two different departments.
    const tabs = collectDynamicDepartmentTabs([
      makeRow({ user_id: 1, department: 'Юристи', department_id: 52 }),
      makeRow({ user_id: 2, department: 'Юристи', department_id: 51 }),
    ])

    expect(tabs.map((tab) => tab.id)).toEqual(['d51', 'd52'])
    expect(tabs.map((tab) => tab.label)).toEqual(['Юристи', 'Юристи'])
  })

  it('labels a tab with the LIVE name, so a rename is visible immediately', () => {
    // The rename scenario: same id, new name. The tab is the new name.
    const renamed = collectDynamicDepartmentTabs([
      makeRow({ department: 'Технічна підтримка', department_id: 1 }),
    ])

    expect(renamed).toEqual([{ id: 'd1', departmentId: 1, label: 'Технічна підтримка' }])
  })

  it('gives a look-alike department its own tab rather than losing it', () => {
    // «ТП » is not «ТП»: the fixed tab's exact-name match does not take it, so
    // it must not fall out of the strip either.
    const tabs = collectDynamicDepartmentTabs([makeRow({ department: 'ТП ', department_id: 60 })])

    expect(tabs).toEqual([{ id: 'd60', departmentId: 60, label: 'ТП ' }])
  })
})

describe('filterRowsByTab', () => {
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

  it('keeps only the matching department_id on a dynamic tab', () => {
    expect(filterRowsByTab(rows, 'd17')).toEqual([lawyer])
    expect(filterRowsByTab(rows, 'd21')).toEqual([analyst])
  })

  it('follows the id, not the name, when a department is renamed', () => {
    // The whole reason `department_id` was added to the contract: the rows keep
    // their tab through the rename, and the tab keeps their money.
    const renamed = [
      makeRow({ user_id: 4, department: 'Юридичний відділ', department_id: 17 }),
      lawyer,
    ]

    expect(filterRowsByTab(renamed, 'd17')).toEqual(renamed)
  })

  it('never shows a department-less operator on any narrowing tab', () => {
    // A fixed tab matches an exact name and a dynamic one an exact id, so the
    // null department can only ever be read on «Всі» — which is why «Всі» exists.
    for (const tabId of ['tp', 'dialer', 'collection', 'd17', 'd21'] as const) {
      expect(filterRowsByTab(rows, tabId)).not.toContain(homeless)
    }
  })

  it('returns an empty list rather than everything when a department has no rows', () => {
    expect(filterRowsByTab([lawyer, homeless], 'tp')).toEqual([])
    expect(filterRowsByTab([lawyer, homeless], 'd21')).toEqual([])
  })

  it('returns nothing at all for a malformed dynamic tab id', () => {
    // Unreachable through `resolveOperatorPromisesTab`; a filter that cannot be
    // applied must not silently widen into "no filter".
    expect(filterRowsByTab(rows, 'dNaN' as 'd17')).toEqual([])
  })

  it('matches the department name exactly, without trimming or case folding', () => {
    // The fixed triple matches by NAME on purpose (product decision, 2026-08-20):
    // «ТП» means "whatever the directory calls ТП right now". A near-miss name
    // therefore misses — and gets its own dynamic tab instead of vanishing.
    expect(filterRowsByTab([makeRow({ department: 'тп' })], 'tp')).toEqual([])
    expect(filterRowsByTab([makeRow({ department: 'ТП ' })], 'tp')).toEqual([])
  })

  it('shows a foreign department named «ТП» on the fixed ТП tab', () => {
    // Accepted edge: the fixed tabs are name-based, so a department that is not
    // the original ТП but IS named «ТП» is what the ТП tab shows — and it gets
    // no dynamic twin, so its rows appear exactly once in the strip.
    const impostor = makeRow({ user_id: 9, department: 'ТП', department_id: 77 })

    expect(filterRowsByTab([impostor], 'tp')).toEqual([impostor])
    expect(collectDynamicDepartmentTabs([impostor])).toEqual([])
  })
})
