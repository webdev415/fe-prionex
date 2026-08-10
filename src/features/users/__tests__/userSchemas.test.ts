/**
 * User schema validation tests — focused on the dialer_extension field.
 */

import { describe, it, expect } from 'vitest'
import { createUserSchema, updateUserSchema } from '../schemas/userSchemas'

const base = {
  username: 'jdoe',
  email: 'jdoe@example.com',
  password: 'Password123!',
  first_name: 'John',
  last_name: 'Doe',
  language: 'en' as const,
  timezone: 'Europe/Kyiv',
}

describe('dialer_extension validation', () => {
  it('accepts a 3-10 digit extension', () => {
    expect(createUserSchema.safeParse({ ...base, dialer_extension: '9001' }).success).toBe(true)
  })

  it('accepts an empty extension (optional / clearable)', () => {
    expect(createUserSchema.safeParse({ ...base, dialer_extension: '' }).success).toBe(true)
  })

  it('rejects a non-numeric extension', () => {
    expect(createUserSchema.safeParse({ ...base, dialer_extension: 'ab12' }).success).toBe(false)
  })

  it('rejects an out-of-range extension', () => {
    expect(createUserSchema.safeParse({ ...base, dialer_extension: '12' }).success).toBe(false)
  })

  it('validates the same rule on update', () => {
    expect(updateUserSchema.safeParse({ ...base, dialer_extension: '9002' }).success).toBe(true)
    expect(updateUserSchema.safeParse({ ...base, dialer_extension: 'x' }).success).toBe(false)
  })
})
