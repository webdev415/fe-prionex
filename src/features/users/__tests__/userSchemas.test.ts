/**
 * User schema validation tests — focused on the dialer_extension field.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  AGENT_EXTENSION_REQUIRED_MESSAGE,
  createUserSchema,
  requireAgentExtension,
  updateUserSchema,
} from '../schemas/userSchemas'

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

/**
 * The Is Agent rule. Asterisk Extension becomes required once the box is
 * checked; the predictive dialer one stays optional.
 *
 * These exercise the refinement directly rather than through a schema, because
 * the two call sites apply it at different moments -- always on create, only
 * once touched on edit -- so there is no single schema that carries it.
 */
describe('requireAgentExtension', () => {
  const run = (data: { is_agent?: boolean; asterisk_extension?: string }) => {
    const schema = z.object({}).passthrough().superRefine(requireAgentExtension)
    return schema.safeParse(data)
  }

  it('rejects an agent with no asterisk extension', () => {
    const result = run({ is_agent: true, asterisk_extension: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['asterisk_extension'])
      expect(result.error.issues[0].message).toBe(AGENT_EXTENSION_REQUIRED_MESSAGE)
    }
  })

  it('accepts an agent who has one', () => {
    expect(run({ is_agent: true, asterisk_extension: '7001' }).success).toBe(true)
  })

  it('leaves the dialer extension optional for an agent', () => {
    const result = run({
      is_agent: true,
      asterisk_extension: '7001',
      dialer_extension: '',
    } as never)

    expect(result.success).toBe(true)
  })

  it('does not require an extension from a non-agent', () => {
    expect(run({ is_agent: false, asterisk_extension: '' }).success).toBe(true)
  })

  it('leaves a non-agent who already carries an extension alone', () => {
    // The inherited inconsistency the ticket declines to clean up: unchecked,
    // but an extension is still stored. It must not become a validation error.
    expect(run({ is_agent: false, asterisk_extension: '7001' }).success).toBe(true)
  })
})
