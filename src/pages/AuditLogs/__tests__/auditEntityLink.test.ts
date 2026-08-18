import { describe, expect, it } from 'vitest'

import { auditEntityLink } from '../auditEntityLink'
import { PERMISSIONS, type Permission } from '@/constants/permissions'

const allow = () => true
const deny = () => false
const only =
  (granted: Permission) =>
  (p: Permission): boolean =>
    p === granted

describe('auditEntityLink — loan_coefficient_range', () => {
  it('links to the Repayment Configuration page', () => {
    expect(auditEntityLink({ entity_type: 'loan_coefficient_range', entity_id: '7' }, allow)).toBe(
      '/dashboard/system-settings/repayment-configuration'
    )
  })

  it('falls back to plain text without the view permission', () => {
    expect(
      auditEntityLink({ entity_type: 'loan_coefficient_range', entity_id: '7' }, deny)
    ).toBeNull()
  })

  it('links for a viewer who cannot edit', () => {
    // Gated on VIEW, not manage_settings: someone who can open the page should
    // reach it from the audit row even though they cannot change the ranges.
    expect(
      auditEntityLink(
        { entity_type: 'loan_coefficient_range' },
        only(PERMISSIONS.REPAYMENT_CONFIG.VIEW)
      )
    ).toBe('/dashboard/system-settings/repayment-configuration')
  })
})
