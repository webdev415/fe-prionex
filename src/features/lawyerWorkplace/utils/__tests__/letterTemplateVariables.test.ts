import { describe, expect, it, vi } from 'vitest'

// The letter body language follows the recipient (options.language), not the UI.
// Mock i18n so getFixedT resolves the client fallback per-language deterministically
// (the shared test setup mocks i18next core, leaving no real t on @/lib/i18n).
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
    default: {
      getFixedT: (lng: string) => (key: string, defaultValue: string) =>
        lng?.startsWith('uk') && key === 'pages.lawyerWorkplace.letterTemplate.clientFallback'
          ? 'Клієнт'
          : defaultValue,
    },
  }
})

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

  it('resolves the client fallback in the recipient letter language', () => {
    const body = 'Dear {{clientName}}'
    expect(applyLetterTemplatePlaceholders(body, {}, { language: 'uk' })).toBe('Dear Клієнт')
    expect(applyLetterTemplatePlaceholders(body, {}, { language: 'en' })).toBe('Dear Client')
  })
})
