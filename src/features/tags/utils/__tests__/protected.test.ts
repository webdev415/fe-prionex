import { describe, expect, it } from 'vitest'
import { canRemoveProtectedTag } from '../protected'

describe('canRemoveProtectedTag', () => {
  it('allows removal for non-protected tags', () => {
    expect(canRemoveProtectedTag({ is_protected: false }, 'Operator')).toBe(true)
  })

  it('uses API can_remove_protected when provided', () => {
    expect(
      canRemoveProtectedTag(
        { is_protected: true, protected_removal_roles: ['Admin'], can_remove_protected: false },
        'Admin'
      )
    ).toBe(false)
  })

  it('allows removal when role matches protected_removal_roles', () => {
    expect(
      canRemoveProtectedTag(
        { is_protected: true, protected_removal_roles: ['Admin', 'Manager'] },
        'manager'
      )
    ).toBe(true)
  })

  it('blocks removal for protected tag without permitted role', () => {
    expect(
      canRemoveProtectedTag({ is_protected: true, protected_removal_roles: ['Admin'] }, 'Operator')
    ).toBe(false)
  })

  it('blocks removal when protected tag has no configured roles', () => {
    expect(
      canRemoveProtectedTag({ is_protected: true, protected_removal_roles: [] }, 'Admin')
    ).toBe(false)
  })
})
