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

import {
  applyLetterTemplatePlaceholders,
  fillTemplateVariables,
  extractIncomingRef,
  extractCaseNo,
  formatTemplateDate,
  LEGAL_LETTER_TEMPLATE_VARIABLES,
  LEGAL_LETTER_VARIABLE_GROUP_ORDER,
} from '../letterTemplateVariables'

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

describe('LEGAL_LETTER_TEMPLATE_VARIABLES palette definition', () => {
  it('exposes 16 variables across the four ordered groups', () => {
    expect(LEGAL_LETTER_TEMPLATE_VARIABLES).toHaveLength(16)
    expect(LEGAL_LETTER_VARIABLE_GROUP_ORDER).toEqual(['client', 'incoming', 'reply', 'company'])
    // Every variable belongs to a declared group.
    for (const variable of LEGAL_LETTER_TEMPLATE_VARIABLES) {
      expect(LEGAL_LETTER_VARIABLE_GROUP_ORDER).toContain(variable.group)
    }
  })

  it('has unique variable names', () => {
    const names = LEGAL_LETTER_TEMPLATE_VARIABLES.map((variable) => variable.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('fillTemplateVariables', () => {
  it('substitutes known non-empty values and leaves unknown placeholders intact', () => {
    const text = 'Шановний {{clientName}}, договір {{contract}}, ІПН {{clientTaxId}}.'
    const result = fillTemplateVariables(text, {
      clientName: 'Іваненко І. І.',
      contract: 'CR-2024-00518',
      // clientTaxId not provided → placeholder must stay
    })
    expect(result).toBe('Шановний Іваненко І. І., договір CR-2024-00518, ІПН {{clientTaxId}}.')
  })

  it('never touches {{outNo}} (assigned at send time)', () => {
    const text = 'Вих. № {{outNo}} від {{date}}'
    const result = fillTemplateVariables(text, { date: '30.07.2026' })
    expect(result).toBe('Вих. № {{outNo}} від 30.07.2026')
  })

  it('treats empty / whitespace / null values as missing', () => {
    const text = '{{clientName}} / {{contract}} / {{caseNo}}'
    const result = fillTemplateVariables(text, {
      clientName: '   ',
      contract: '',
      caseNo: null,
    })
    expect(result).toBe('{{clientName}} / {{contract}} / {{caseNo}}')
  })

  it('replaces every occurrence of a token', () => {
    expect(fillTemplateVariables('{{date}} … {{date}}', { date: '01.01.2026' })).toBe(
      '01.01.2026 … 01.01.2026'
    )
  })

  it('leaves unknown tokens that are not part of the context', () => {
    expect(fillTemplateVariables('{{whatever}}', { clientName: 'X' })).toBe('{{whatever}}')
  })
})

describe('extractIncomingRef', () => {
  it('prefers a hyphenated reference from the subject', () => {
    expect(extractIncomingRef('Звернення 12-3456 щодо боргу')).toBe('12-3456')
  })

  it('falls back to a bare multi-digit number', () => {
    expect(extractIncomingRef('Лист №4521 про платіж')).toBe('4521')
  })

  it('returns null when there is nothing number-like', () => {
    expect(extractIncomingRef('Payment complaint')).toBeNull()
    expect(extractIncomingRef('')).toBeNull()
    expect(extractIncomingRef(null)).toBeNull()
  })
})

describe('extractCaseNo', () => {
  it('extracts a case number after "справі №"', () => {
    expect(extractCaseNo('Щодо справі №910/456/24 про стягнення')).toBe('910/456/24')
  })

  it('handles a hyphenated case token without №', () => {
    expect(extractCaseNo('у справа А-123 від суду')).toBe('А-123')
  })

  it('returns null without a "справ" marker', () => {
    expect(extractCaseNo('Payment complaint')).toBeNull()
    expect(extractCaseNo(null)).toBeNull()
  })
})

describe('formatTemplateDate', () => {
  it('formats an ISO date for the given locale', () => {
    expect(formatTemplateDate('2026-07-15T12:00:00.000Z', 'en-GB')).toBe('15/07/2026')
  })

  it('returns null for empty or invalid input', () => {
    expect(formatTemplateDate('', 'en-GB')).toBeNull()
    expect(formatTemplateDate('not-a-date', 'en-GB')).toBeNull()
    expect(formatTemplateDate(null, 'en-GB')).toBeNull()
  })
})
