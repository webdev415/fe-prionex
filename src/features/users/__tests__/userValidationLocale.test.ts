import { describe, expect, it } from 'vitest'
import en from '@/../public/locales/en/common.json'
import es from '@/../public/locales/es/common.json'
import uk from '@/../public/locales/uk/common.json'
import { createUserSchema, updateUserSchema } from '../schemas/userSchemas'

function lookup(locale: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      locale
    )
}

const invalidCreate = {
  username: 'a b',
  email: 'not-an-email',
  password: 'short',
  first_name: '',
  last_name: 'x'.repeat(101),
  phone: '12345',
  language: 'fr',
  timezone: '',
  asterisk_extension: '12',
  dialer_extension: 'abc',
}

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return [...new Set(result.error?.issues.map((issue) => issue.message) ?? [])]
}

describe('user form validation messages', () => {
  const found = [
    ...messages(createUserSchema.safeParse(invalidCreate)),
    ...messages(updateUserSchema.safeParse(invalidCreate)),
    ...messages(createUserSchema.safeParse({ ...invalidCreate, password: 'alllowercase1!' })),
    ...messages(createUserSchema.safeParse({ ...invalidCreate, username: 'x'.repeat(51) })),
  ]

  it('come back as translation keys', () => {
    expect(found.length).toBeGreaterThan(5)
    expect(found.every((message) => message.startsWith('pages.users.validation.'))).toBe(true)
  })

  it.each([
    ['en', en],
    ['uk', uk],
    ['es', es],
  ])('are translated in %s', (_language, locale) => {
    const missing = found.filter((key) => typeof lookup(locale, key) !== 'string')

    expect(missing).toEqual([])
  })
})
