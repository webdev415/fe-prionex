import { describe, it, expect } from 'vitest'
import { formatPercent, gradientRedToGreen, percentCellBackground } from '../percentGradient'

describe('gradientRedToGreen', () => {
  it('maps the 0–100 scale endpoints to red and green', () => {
    expect(gradientRedToGreen(0)).toBe('hsl(0, 70%, 85%)')
    expect(gradientRedToGreen(50)).toBe('hsl(60, 70%, 85%)')
    expect(gradientRedToGreen(100)).toBe('hsl(120, 70%, 85%)')
  })

  it('clamps out-of-range values', () => {
    expect(gradientRedToGreen(-10)).toBe('hsl(0, 70%, 85%)')
    expect(gradientRedToGreen(150)).toBe('hsl(120, 70%, 85%)')
  })

  it('falls back to neutral yellow for NaN and collapsed ranges', () => {
    expect(gradientRedToGreen(Number.NaN)).toBe('hsl(60, 70%, 85%)')
    expect(gradientRedToGreen(42, 10, 10)).toBe('hsl(60, 70%, 85%)')
  })
})

describe('formatPercent', () => {
  it('formats 0..100 values as XX.XX% (already percents, no ×100)', () => {
    expect(formatPercent(0)).toBe('0.00%')
    expect(formatPercent(76.6)).toBe('76.60%')
    expect(formatPercent(12.3456)).toBe('12.35%')
    expect(formatPercent(100)).toBe('100.00%')
  })

  it('renders a dash for missing values', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(Number.NaN)).toBe('—')
  })
})

describe('percentCellBackground', () => {
  it('returns a gradient colour for numeric values', () => {
    expect(percentCellBackground(100)).toBe('hsl(120, 70%, 85%)')
  })

  it('returns no fill for missing values', () => {
    expect(percentCellBackground(null)).toBeUndefined()
    expect(percentCellBackground(Number.NaN)).toBeUndefined()
  })
})
