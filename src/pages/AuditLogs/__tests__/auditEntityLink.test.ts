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

describe('auditEntityLink — client.rr.activated', () => {
  // A Draft RR going live is logged against the client, like every other RR
  // event, so the row links to that client's card.
  it('links to the client card', () => {
    expect(
      auditEntityLink(
        { entity_type: 'client', entity_id: '6301', action_raw: 'client.rr.activated' },
        allow
      )
    ).toBe('/dashboard/clients/6301')
  })

  it('falls back to plain text without the client view permission', () => {
    expect(
      auditEntityLink(
        { entity_type: 'client', entity_id: '6301', action_raw: 'client.rr.activated' },
        deny
      )
    ).toBeNull()
  })
})
