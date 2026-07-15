import { describe, expect, it } from 'vitest'
import { applyLetterTemplatePlaceholders } from '../letterTemplateVariables'

describe('applyLetterTemplatePlaceholders', () => {
  const template =
    'Dear {{clientName}}, ref {{requestNo}} / {{referenceId}}, contract {{contract}}, due {{dueDate}}, on {{date}}.'

  it('replaces all phase-1 variables with provided context', () => {
    const result = applyLetterTemplatePlaceholders(
      template,
      {
        clientName: 'I. Petrenko',
        referenceId: 'A1B2C3D4',
        contract: 'CR-2024-00518',
        dueDate: '2026-07-15T12:00:00.000Z',
        date: '2026-06-24',
      },
      { language: 'en-GB' }
    )

    expect(result).toContain('Dear I. Petrenko')
    expect(result).toContain('ref A1B2C3D4 / A1B2C3D4')
    expect(result).toContain('contract CR-2024-00518')
    expect(result).toContain('due 15/07/2026')
    expect(result).toContain('on 2026-06-24')
  })

  it('uses fallbacks when context values are missing', () => {
    const result = applyLetterTemplatePlaceholders(template, {})

    expect(result).toContain('Dear Client')
    expect(result).toContain('ref — / —')
    expect(result).toContain('contract —')
    expect(result).toContain('due —')
    expect(result).toMatch(/on \d{4}-\d{2}-\d{2}/)
  })

  it('treats referenceId as an alias of requestNo', () => {
    const body = '{{requestNo}} vs {{referenceId}}'
    expect(applyLetterTemplatePlaceholders(body, { referenceId: 'REF-001' })).toBe(
      'REF-001 vs REF-001'
    )
  })
})
