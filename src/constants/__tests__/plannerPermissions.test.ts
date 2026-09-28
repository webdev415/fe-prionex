/**
 * Planner permission codes (planner story 1.9, AC1).
 *
 * The strings are the verbatim names of the auth-service migration
 * `planner_perm_001` (planner story 1.3). The planner reads them from the JWT;
 * a typo here would hide the «Планування» entry from everyone who holds the
 * right while the server still says yes.
 */
import { describe, expect, it } from 'vitest'
import {
  getAllPermissions,
  PERMISSION_CATEGORIES,
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
} from '../permissions'

const MIGRATION_1_3_CODES = [
  'planner.access',
  'planner.admin',
  'planner.boards.create',
  'planner.overview.read',
  'planner.templates.manage',
]

describe('Planner permissions (1.3 → 1.9)', () => {
  it('match the 1.3 migration literally — five codes, nothing else', () => {
    expect(Object.values(PERMISSIONS.PLANNER).sort()).toEqual(MIGRATION_1_3_CODES)
    expect(PERMISSIONS.PLANNER.ACCESS).toBe('planner.access')
  })

  it('are registered, described and filed under the Planner category', () => {
    const all = getAllPermissions() as string[]
    const descriptions = PERMISSION_DESCRIPTIONS as Record<string, string>
    for (const code of MIGRATION_1_3_CODES) {
      expect(all).toContain(code)
      expect(descriptions[code]).toBeTruthy()
    }
    expect(PERMISSION_CATEGORIES.PLANNER).toBe('Planner')
  })
})
