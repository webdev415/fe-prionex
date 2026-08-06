import { describe, it, expect } from 'vitest'
import {
  buildDepartmentTabs,
  resolveActiveDepartmentTab,
  rowDepartmentTabId,
  NO_DEPARTMENT_TAB_ID,
} from '../departmentTabs'
import { KNOWN_DEPARTMENTS } from '../../types'
import type { ProcessingReportRow } from '../../types'

function makeRow(
  departmentName: string | null,
  departmentId: number | null = null,
  employeeId = 1
): ProcessingReportRow {
  return {
    employee_id: employeeId,
    full_name: 'Іваненко Іван',
    department_id: departmentId,
    department_name: departmentName,
    group_id: null,
    group_name: null,
    count_client: 0,
    count_processed: 0,
    count_processed_client: 0,
    count_processed_contact: 0,
    percent_processed: 0,
    percent_processed_client: 0,
    percent_processed_contact: 0,
  }
}

describe('rowDepartmentTabId', () => {
  it('maps known department names to their stable slugs regardless of id', () => {
    expect(rowDepartmentTabId(makeRow('ТП', 7))).toBe('tp')
    expect(rowDepartmentTabId(makeRow('Дайлер', 8))).toBe('dialer')
    expect(rowDepartmentTabId(makeRow('Стягнення', 9))).toBe('collection')
  })

  it('keys unknown departments by department_id, not by (Cyrillic) name', () => {
    expect(rowDepartmentTabId(makeRow('Новий відділ', 42))).toBe('42')
  })

  it('maps rows without a department name to the «—» tab', () => {
    expect(rowDepartmentTabId(makeRow(null, null))).toBe(NO_DEPARTMENT_TAB_ID)
    expect(rowDepartmentTabId(makeRow(null, 5))).toBe(NO_DEPARTMENT_TAB_ID)
  })
})

describe('buildDepartmentTabs', () => {
  it('always returns the known departments first in canonical order', () => {
    expect(buildDepartmentTabs([]).map((tab) => tab.id)).toEqual(['tp', 'dialer', 'collection'])
    // Even when the response rows come in a different order
    const shuffled = buildDepartmentTabs([
      makeRow('Стягнення', 3, 1),
      makeRow('ТП', 1, 2),
      makeRow('Дайлер', 2, 3),
    ])
    expect(shuffled.map((tab) => tab.id)).toEqual(['tp', 'dialer', 'collection'])
  })

  it('appends unknown departments keyed by id, without duplicates', () => {
    const tabs = buildDepartmentTabs([
      makeRow('VIP', 42, 1),
      makeRow('ТП', 1, 2),
      makeRow('VIP', 42, 3),
      makeRow('Новий відділ', 43, 4),
    ])

    expect(tabs.map((tab) => tab.id)).toEqual(['tp', 'dialer', 'collection', '42', '43'])
    const vip = tabs.find((tab) => tab.id === '42')
    // Unknown departments have no i18n key — the raw name is the label
    expect(vip?.label).toBe('VIP')
    expect(vip?.labelKey).toBeUndefined()
  })

  it('keeps rows without a department in a dedicated «—» tab, rendered last', () => {
    const tabs = buildDepartmentTabs([makeRow(null, null, 1), makeRow('VIP', 42, 2)])

    expect(tabs.map((tab) => tab.id)).toEqual([
      'tp',
      'dialer',
      'collection',
      '42',
      NO_DEPARTMENT_TAB_ID,
    ])
    expect(tabs.at(-1)?.label).toBe('—')
  })

  it('gives known departments i18n label keys', () => {
    for (const known of KNOWN_DEPARTMENTS) {
      expect(known.labelKey).toMatch(/^pages\.reports\.processing\.departments\./)
    }
  })
})

describe('resolveActiveDepartmentTab', () => {
  const tabs = buildDepartmentTabs([makeRow('VIP', 42)])

  it('matches the raw ?dept= value by tab id', () => {
    expect(resolveActiveDepartmentTab(tabs, 'collection').id).toBe('collection')
    expect(resolveActiveDepartmentTab(tabs, '42').label).toBe('VIP')
  })

  it('falls back to the first tab for unknown or missing values', () => {
    expect(resolveActiveDepartmentTab(tabs, null).id).toBe('tp')
    expect(resolveActiveDepartmentTab(tabs, 'nope').id).toBe('tp')
  })
})
