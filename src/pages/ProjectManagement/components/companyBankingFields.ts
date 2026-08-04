/**
 * Shared validation + field metadata for the 10 company/banking fields on
 * the Create/Edit Project modals.
 *
 * The BE also validates the same rules (see auth-service ProjectCreateRequest /
 * ProjectUpdateRequest via ``ProjectCompanyBankingBase``); keeping the two
 * sides in sync avoids "browser accepted, API rejected" surprises.
 *
 * All fields are optional — empty must never be an error.
 */

// Regex triples — kept identical to the BE Pydantic validators.
export const EDRPOU_REGEX = /^\d{8}$/
export const IBAN_REGEX = /^[A-Z]{2}\d{0,32}$/
export const HOTLINE_PHONE_REGEX = /^[\d ]*$/
// Simple email pattern; final source of truth is the BE (EmailStr). This is
// only for on-blur UX to catch obvious typos before the request goes out.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Coerce empty / whitespace-only strings to undefined so the payload
 *  carries an actual absence instead of an empty string. */
export const emptyToUndefined = (v: string | null | undefined): string | undefined =>
  v == null || v === '' ? undefined : v

export type CompanyBankingFieldName =
  | 'full_company_name'
  | 'address'
  | 'edrpou_code'
  | 'website'
  | 'email'
  | 'hotline_phone'
  | 'director_name'
  | 'iban'
  | 'bank_name'
  | 'bank_code'

/** Per-field validation error key (i18n) or null if the value is acceptable. */
export function validateCompanyBankingField(
  field: CompanyBankingFieldName,
  raw: string | null | undefined
): string | null {
  const value = raw ?? ''
  // Empty is always valid — all 10 fields are optional per spec.
  if (value === '') return null

  switch (field) {
    case 'edrpou_code':
      return EDRPOU_REGEX.test(value) ? null : 'pages.projects.modals.errors.edrpouCodeFormat'
    case 'iban':
      return IBAN_REGEX.test(value) ? null : 'pages.projects.modals.errors.ibanFormat'
    case 'hotline_phone':
      return HOTLINE_PHONE_REGEX.test(value)
        ? null
        : 'pages.projects.modals.errors.hotlinePhoneFormat'
    case 'email':
      return EMAIL_REGEX.test(value) ? null : 'pages.projects.modals.errors.emailFormat'
    default:
      // All other fields are free text — max_length is enforced by input
      // maxLength attribute + BE (max_length=1000).
      return null
  }
}

/** Run validators across all 10 fields; return {field: errorKey} for any
 *  that fail. Empty-object return = "all clean, safe to submit". */
export function validateAllCompanyBankingFields(
  values: Partial<Record<CompanyBankingFieldName, string | null | undefined>>
): Partial<Record<CompanyBankingFieldName, string>> {
  const errors: Partial<Record<CompanyBankingFieldName, string>> = {}
  const fields: CompanyBankingFieldName[] = [
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
  ]
  for (const f of fields) {
    const err = validateCompanyBankingField(f, values[f])
    if (err) errors[f] = err
  }
  return errors
}

/** Convert the modal's field state into the payload sent to the API.
 *  Empty strings are dropped so we send explicit absence. */
export function serializeCompanyBankingFields(
  values: Partial<Record<CompanyBankingFieldName, string | null | undefined>>
): Partial<Record<CompanyBankingFieldName, string | undefined>> {
  return {
    full_company_name: emptyToUndefined(values.full_company_name),
    address: emptyToUndefined(values.address),
    edrpou_code: emptyToUndefined(values.edrpou_code),
    website: emptyToUndefined(values.website),
    email: emptyToUndefined(values.email),
    hotline_phone: emptyToUndefined(values.hotline_phone),
    director_name: emptyToUndefined(values.director_name),
    iban: emptyToUndefined(values.iban),
    bank_name: emptyToUndefined(values.bank_name),
    bank_code: emptyToUndefined(values.bank_code),
  }
}
