/**
 * Permission constants tests — Call QA additions.
 *
 * The string values are verbatim backend permission names (persisted in the
 * auth-service `roles` table); a typo here silently breaks RBAC gating.
 */
import { describe, expect, it } from 'vitest'
import { getAllPermissions, PERMISSION_DESCRIPTIONS, PERMISSIONS } from '../permissions'

const CALL_QA_PERMISSIONS = ['manage_call_qa', 'view_ai_reviews', 'manage_blocker_dictionary']

describe('Call QA permission constants', () => {
  it('exposes verbatim backend permission strings', () => {
    expect(PERMISSIONS.SYSTEM.MANAGE_CALL_QA).toBe('manage_call_qa')
    expect(PERMISSIONS.TRAINING.VIEW_AI_REVIEWS).toBe('view_ai_reviews')
    expect(PERMISSIONS.TRAINING.MANAGE_BLOCKER_DICTIONARY).toBe('manage_blocker_dictionary')
  })

  it('registers them in getAllPermissions()', () => {
    const all = getAllPermissions() as string[]
    for (const permission of CALL_QA_PERMISSIONS) {
      expect(all).toContain(permission)
    }
  })

  it('describes each of them for the role-management UI', () => {
    const descriptions = PERMISSION_DESCRIPTIONS as Record<string, string>
    for (const permission of CALL_QA_PERMISSIONS) {
      expect(descriptions[permission]).toBeTruthy()
    }
  })
})

describe('Call QA listening-rules permission', () => {
  it('exposes the verbatim backend name', () => {
    expect(PERMISSIONS.SYSTEM.MANAGE_QA_RULES).toBe('manage_qa_rules')
  })

  it('is registered and described for the role-management UI', () => {
    expect(getAllPermissions() as string[]).toContain('manage_qa_rules')
    expect((PERMISSION_DESCRIPTIONS as Record<string, string>).manage_qa_rules).toBeTruthy()
  })
})
