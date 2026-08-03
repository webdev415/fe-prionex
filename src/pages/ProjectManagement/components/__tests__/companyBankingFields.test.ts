/**
 * Unit tests for the company/banking validator helper.
 *
 * Locks the FE regex contract against future refactors so it stays in sync
 * with the BE Pydantic validators (auth-service ``ProjectCompanyBankingBase``).
 * If either side drifts, the two-sided validation contract quietly breaks —
 * these tests catch it.
 */
import { describe, expect, it } from 'vitest'

import {
  emptyToUndefined,
  serializeCompanyBankingFields,
  validateAllCompanyBankingFields,
  validateCompanyBankingField,
} from '../companyBankingFields'

describe('validateCompanyBankingField', () => {
  describe('empty values (all 10 fields are optional per spec)', () => {
    it('returns null for empty / undefined / null on every field', () => {
      const fields = [
        'full_company_name',
        'address',
        'edrpou_code',
        'website',
        'email',
        'hotline_phone',
        'director_name',
        'iban',
        'bank_name',
        'bank_code',
      ] as const
      for (const f of fields) {
        expect(validateCompanyBankingField(f, '')).toBeNull()
        expect(validateCompanyBankingField(f, null)).toBeNull()
        expect(validateCompanyBankingField(f, undefined)).toBeNull()
      }
    })
  })

  describe('edrpou_code — exactly 8 digits, no 10-digit RNOKPP', () => {
    it('accepts exactly 8 digits', () => {
      expect(validateCompanyBankingField('edrpou_code', '12345678')).toBeNull()
    })

    it('rejects fewer / more than 8 digits', () => {
      expect(validateCompanyBankingField('edrpou_code', '1234567')).not.toBeNull()
      expect(validateCompanyBankingField('edrpou_code', '123456789')).not.toBeNull()
      // 10-digit RNOKPP is intentionally NOT supported (spec is 8 digits).
      expect(validateCompanyBankingField('edrpou_code', '1234567890')).not.toBeNull()
    })

    it('rejects non-digit chars', () => {
      expect(validateCompanyBankingField('edrpou_code', '1234567a')).not.toBeNull()
      expect(validateCompanyBankingField('edrpou_code', '1234 567')).not.toBeNull()
    })
  })

  describe('iban — 2 uppercase letters + up to 32 digits (max 34 chars)', () => {
    it('accepts the 2-letter minimum (0 digits allowed)', () => {
      expect(validateCompanyBankingField('iban', 'UA')).toBeNull()
    })

    it('accepts a real-world 29-char IBAN', () => {
      expect(validateCompanyBankingField('iban', 'UA213223130000026007233566001')).toBeNull()
    })

    it('accepts the 34-char maximum (2 letters + 32 digits)', () => {
      // Total length 34: matches the spec's upper bound.
      const maxIban = 'UA' + '1'.repeat(32)
      expect(maxIban.length).toBe(34)
      expect(validateCompanyBankingField('iban', maxIban)).toBeNull()
    })

    it('rejects one char over the maximum', () => {
      // 35 chars = over the spec limit.
      expect(validateCompanyBankingField('iban', 'UA' + '1'.repeat(33))).not.toBeNull()
    })

    it('rejects lowercase country prefix', () => {
      expect(validateCompanyBankingField('iban', 'ua213223130000026007')).not.toBeNull()
    })

    it('rejects letters after the 2-letter prefix', () => {
      // The regex only allows digits after position 2. A British IBAN whose
      // BBAN contains letters (WEST12...) therefore fails — accepted per spec.
      expect(validateCompanyBankingField('iban', 'GB82WEST12345698765432')).not.toBeNull()
    })

    it('rejects only-1-letter prefix', () => {
      expect(validateCompanyBankingField('iban', 'U12345')).not.toBeNull()
    })
  })

  describe('hotline_phone — digits and spaces ONLY', () => {
    it('accepts digits + spaces', () => {
      expect(validateCompanyBankingField('hotline_phone', '380 44 555 1234')).toBeNull()
      expect(validateCompanyBankingField('hotline_phone', '1234567890')).toBeNull()
      expect(validateCompanyBankingField('hotline_phone', '   ')).toBeNull()
    })

    it("rejects '+' (international prefix)", () => {
      expect(validateCompanyBankingField('hotline_phone', '+380 44 555 1234')).not.toBeNull()
    })

    it("rejects '-' hyphen", () => {
      expect(validateCompanyBankingField('hotline_phone', '380-44-555-1234')).not.toBeNull()
    })

    it('rejects parentheses', () => {
      expect(validateCompanyBankingField('hotline_phone', '(044) 555 1234')).not.toBeNull()
    })

    it('rejects letters', () => {
      expect(validateCompanyBankingField('hotline_phone', '380 44 abc')).not.toBeNull()
    })
  })

  describe('email — standard format', () => {
    it('accepts a valid address', () => {
      expect(validateCompanyBankingField('email', 'ops@example.com')).toBeNull()
    })

    it('rejects obvious malformed strings', () => {
      expect(validateCompanyBankingField('email', 'not-an-email')).not.toBeNull()
      expect(validateCompanyBankingField('email', 'no@dot')).not.toBeNull()
      expect(validateCompanyBankingField('email', '@example.com')).not.toBeNull()
    })
  })

  describe('free-text fields — no format validation per spec', () => {
    it('accepts anything, including URLs without scheme (website)', () => {
      // Spec says website is "free text" — do NOT upgrade to URL validation.
      expect(validateCompanyBankingField('website', 'prionex.com')).toBeNull()
      expect(validateCompanyBankingField('website', 'https://prionex.com')).toBeNull()
      expect(validateCompanyBankingField('website', 'literally any string')).toBeNull()
    })

    it('accepts anything for name / address / director / bank fields', () => {
      const fields = [
        'full_company_name',
        'address',
        'director_name',
        'bank_name',
        'bank_code',
      ] as const
      for (const f of fields) {
        expect(validateCompanyBankingField(f, 'anything at all')).toBeNull()
        expect(validateCompanyBankingField(f, '!@#$%^&*()')).toBeNull()
      }
    })
  })
})

describe('validateAllCompanyBankingFields', () => {
  it('returns an empty object when nothing is filled in (all optional)', () => {
    expect(validateAllCompanyBankingFields({})).toEqual({})
  })

  it('returns an empty object when every field is valid', () => {
    expect(
      validateAllCompanyBankingFields({
        edrpou_code: '12345678',
        iban: 'UA213223130000026007233566001',
        hotline_phone: '380 44 555 1234',
        email: 'ops@example.com',
        full_company_name: 'Acme LLC',
      })
    ).toEqual({})
  })

  it('returns per-field error keys for all bad values', () => {
    const errors = validateAllCompanyBankingFields({
      edrpou_code: '1234',
      iban: 'ua21',
      hotline_phone: '+380 44',
      email: 'not-email',
    })
    expect(errors.edrpou_code).toBe('pages.projects.modals.errors.edrpouCodeFormat')
    expect(errors.iban).toBe('pages.projects.modals.errors.ibanFormat')
    expect(errors.hotline_phone).toBe('pages.projects.modals.errors.hotlinePhoneFormat')
    expect(errors.email).toBe('pages.projects.modals.errors.emailFormat')
  })
})

describe('emptyToUndefined', () => {
  it('turns empty string and nullish into undefined', () => {
    expect(emptyToUndefined('')).toBeUndefined()
    expect(emptyToUndefined(null)).toBeUndefined()
    expect(emptyToUndefined(undefined)).toBeUndefined()
  })

  it('leaves real strings alone', () => {
    expect(emptyToUndefined('hello')).toBe('hello')
    expect(emptyToUndefined(' ')).toBe(' ')
  })
})

describe('serializeCompanyBankingFields', () => {
  it('drops empty fields to undefined so the API stores NULL, not ""', () => {
    const out = serializeCompanyBankingFields({
      full_company_name: 'Acme LLC',
      edrpou_code: '',
      iban: null,
      email: undefined,
    })
    expect(out.full_company_name).toBe('Acme LLC')
    expect(out.edrpou_code).toBeUndefined()
    expect(out.iban).toBeUndefined()
    expect(out.email).toBeUndefined()
  })

  it('always returns all 10 keys (undefined for missing) so callers can spread safely', () => {
    const out = serializeCompanyBankingFields({})
    expect(Object.keys(out).sort()).toEqual(
      [
        'full_company_name',
        'address',
        'edrpou_code',
        'website',
        'email',
        'hotline_phone',
        'director_name',
        'iban',
        'bank_name',
        'bank_code',
      ].sort()
    )
  })
})
