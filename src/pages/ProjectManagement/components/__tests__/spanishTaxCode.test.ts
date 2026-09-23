import { describe, expect, it } from 'vitest'
import { validateCompanyBankingField } from '../companyBankingFields'

describe('tax code for Spanish projects', () => {
  it('accepts a Spanish NIF, NIE and CIF', () => {
    expect(validateCompanyBankingField('edrpou_code', '12345678Z')).toBeNull()
    expect(validateCompanyBankingField('edrpou_code', 'X1234567L')).toBeNull()
    expect(validateCompanyBankingField('edrpou_code', 'B12345678')).toBeNull()
  })

  it('accepts lowercase letters, which the server stores in uppercase', () => {
    expect(validateCompanyBankingField('edrpou_code', 'b12345678')).toBeNull()
  })

  it('still rejects codes that are neither EDRPOU nor NIF/CIF', () => {
    expect(validateCompanyBankingField('edrpou_code', 'BB1234567')).toBe(
      'pages.projects.modals.errors.edrpouCodeFormat'
    )
    expect(validateCompanyBankingField('edrpou_code', '1234567Z')).not.toBeNull()
  })
})
