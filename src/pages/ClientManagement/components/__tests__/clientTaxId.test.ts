import { describe, it, expect } from 'vitest'
import { taxIdErrorKey, taxIdMatches } from '../clientTaxId'

describe('taxIdMatches', () => {
  it.each(['1234567890', '0123456789'])(
    'accepts a Ukrainian TIN in a Ukrainian project: %s',
    (v) => {
      expect(taxIdMatches(v, 'UA')).toBe(true)
    }
  )

  it.each(['123', '12345678901', '12345678Z', 'X1234567L', ''])(
    'rejects %s in a Ukrainian project',
    (v) => {
      expect(taxIdMatches(v, 'UA')).toBe(false)
    }
  )

  it.each(['12345678Z', 'X1234567L', 'B12345678'])(
    'accepts a Spanish DNI, NIE or CIF in a Spanish project: %s',
    (v) => {
      expect(taxIdMatches(v, 'ES')).toBe(true)
    }
  )

  it('accepts a Spanish number typed in lower case', () => {
    expect(taxIdMatches('x1234567l', 'ES')).toBe(true)
  })

  it.each(['1234567890', '12345678', 'BB1234567', '1234567Z'])(
    'rejects %s in a Spanish project',
    (v) => {
      expect(taxIdMatches(v, 'ES')).toBe(false)
    }
  )
})

describe('taxIdErrorKey', () => {
  it('asks for ten digits in a Ukrainian project', () => {
    expect(taxIdErrorKey('UA')).toBe('pages.clients.editModal.taxIdInvalid')
  })

  it('names the Spanish document types in a Spanish project', () => {
    expect(taxIdErrorKey('ES')).toBe('pages.clients.editModal.taxIdInvalidEs')
  })
})
