import { describe, it, expect } from 'vitest'
import { buildDepartmentTabs, resolveActiveDepartmentTab } from '../departmentTabs'
import { KNOWN_DEPARTMENT_TABS } from '../../types'
import type { ProcessingReportRow } from '../../types'

function makeRow(departmentName: string | null, employeeId = 1): ProcessingReportRow {
  return {
    employee_id: employeeId,
    full_name: 'Іваненко Іван',
    department_id: null,
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

describe('buildDepartmentTabs', () => {
  it('always returns the known departments first in canonical order', () => {
    const tabs = buildDepartmentTabs([])

    expect(tabs.map((tab) => tab.id)).toEqual(['tp', 'dialer', 'collection'])
    expect(tabs.map((tab) => tab.departmentName)).toEqual(['ТП', 'Дайлер', 'Стягнення'])
    // Even when the response rows come in a different order
    const shuffled = buildDepartmentTabs([
      makeRow('Стягнення', 1),
      makeRow('ТП', 2),
      makeRow('Дайлер', 3),
    ])
    expect(shuffled.map((tab) => tab.id)).toEqual(['tp', 'dialer', 'collection'])
  })

  it('appends unknown department names after the known ones, without duplicates', () => {
    const tabs = buildDepartmentTabs([
      makeRow('VIP', 1),
      makeRow('ТП', 2),
      makeRow('VIP', 3),
      makeRow('Новий відділ', 4),
      makeRow(null, 5),
    ])

    expect(tabs.map((tab) => tab.id)).toEqual(['tp', 'dialer', 'collection', 'VIP', 'Новий відділ'])
    const vip = tabs.find((tab) => tab.id === 'VIP')
    expect(vip?.departmentName).toBe('VIP')
    // Unknown departments have no i18n key — the raw name is the label
    expect(vip?.labelKey).toBeUndefined()
  })

  it('gives known departments i18n label keys', () => {
    for (const tab of KNOWN_DEPARTMENT_TABS) {
      expect(tab.labelKey).toMatch(/^pages\.reports\.processing\.departments\./)
    }
  })
})

describe('resolveActiveDepartmentTab', () => {
  const tabs = buildDepartmentTabs([makeRow('VIP')])

  it('matches the raw ?dept= value by tab id', () => {
    expect(resolveActiveDepartmentTab(tabs, 'collection').departmentName).toBe('Стягнення')
    expect(resolveActiveDepartmentTab(tabs, 'VIP').departmentName).toBe('VIP')
  })

  it('falls back to the first tab for unknown or missing values', () => {
    expect(resolveActiveDepartmentTab(tabs, null).id).toBe('tp')
    expect(resolveActiveDepartmentTab(tabs, 'nope').id).toBe('tp')
  })
})
