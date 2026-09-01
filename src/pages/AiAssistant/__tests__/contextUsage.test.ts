import { describe, expect, it } from 'vitest'
import {
  CONTEXT_WINDOW_TOKENS,
  contextUsageLevel,
  extractContextUsage,
  formatTokensShort,
} from '../contextUsage'

describe('extractContextUsage', () => {
  it('суммирует input + оба cache-поля (живая форма done-кадра 31.08)', () => {
    const snapshot = extractContextUsage({
      session_id: 80,
      usage: {
        input_tokens: 15615,
        output_tokens: 569,
        cache_read_input_tokens: 100_000,
        cache_creation_input_tokens: 4385,
        service_tier: 'standard',
      },
    })
    expect(snapshot).not.toBeNull()
    expect(snapshot?.usedTokens).toBe(120_000)
    expect(snapshot?.fraction).toBeCloseTo(120_000 / CONTEXT_WINDOW_TOKENS)
  })

  it('null без usage, при пустом usage и на мусорных типах', () => {
    expect(extractContextUsage({ session_id: 1 })).toBeNull()
    expect(extractContextUsage({ usage: {} })).toBeNull()
    expect(extractContextUsage({ usage: { input_tokens: 0 } })).toBeNull()
    expect(extractContextUsage({ usage: { input_tokens: 'много' } })).toBeNull()
    expect(extractContextUsage({ usage: { input_tokens: -5 } })).toBeNull()
    expect(extractContextUsage(null)).toBeNull()
    expect(extractContextUsage('done')).toBeNull()
  })

  it('переполнение окна зажимается в 1', () => {
    const snapshot = extractContextUsage({ usage: { input_tokens: 999_999_999 } })
    expect(snapshot?.fraction).toBe(1)
  })
})

describe('contextUsageLevel', () => {
  it('пороги 70% и 90%', () => {
    expect(contextUsageLevel(0)).toBe('ok')
    expect(contextUsageLevel(0.69)).toBe('ok')
    expect(contextUsageLevel(0.7)).toBe('warn')
    expect(contextUsageLevel(0.89)).toBe('warn')
    expect(contextUsageLevel(0.9)).toBe('danger')
    expect(contextUsageLevel(1)).toBe('danger')
  })
})

describe('formatTokensShort', () => {
  it('тысячи и миллионы читаемо', () => {
    expect(formatTokensShort(569)).toBe('569')
    expect(formatTokensShort(15_615)).toContain('тис.')
    expect(formatTokensShort(262_144)).toContain('тис.')
    expect(formatTokensShort(1_250_000)).toContain('млн')
  })
})
