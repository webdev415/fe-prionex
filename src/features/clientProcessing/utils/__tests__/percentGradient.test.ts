import { describe, it, expect } from 'vitest'
import { formatPercent, gradientRedToGreen, percentCellBackground } from '../percentGradient'
import { gradientRedToGreen as libGradientRedToGreen } from '@/lib/gradient'

// The ramp's own behaviour is covered in src/lib/__tests__/gradient.test.ts —
// here we only pin the re-export the processing barrel and table import.
describe('gradientRedToGreen re-export', () => {
  it('is the shared lib ramp', () => {
    expect(gradientRedToGreen).toBe(libGradientRedToGreen)
  })
})

describe('formatPercent', () => {
  it('formats 0..100 values as XX.XX% (already percents, no ×100)', () => {
    expect(formatPercent(0, 'en')).toBe('0.00%')
    expect(formatPercent(76.6, 'en')).toBe('76.60%')
    expect(formatPercent(12.3456, 'en')).toBe('12.35%')
    expect(formatPercent(100, 'en')).toBe('100.00%')
  })

  it('uses the UI language locale for the decimal separator', () => {
    expect(formatPercent(76.6, 'uk')).toBe('76,60%')
  })

  it('renders a dash for missing or non-finite values', () => {
    expect(formatPercent(null, 'en')).toBe('—')
    expect(formatPercent(undefined, 'en')).toBe('—')
    expect(formatPercent(Number.NaN, 'en')).toBe('—')
    expect(formatPercent(Number.POSITIVE_INFINITY, 'en')).toBe('—')
  })
})

describe('percentCellBackground', () => {
  it('returns a gradient colour for numeric values', () => {
    expect(percentCellBackground(100)).toBe('hsl(120, 70%, 85%)')
  })

  it('returns no fill for missing or non-finite values', () => {
    expect(percentCellBackground(null)).toBeUndefined()
    expect(percentCellBackground(undefined)).toBeUndefined()
    expect(percentCellBackground(Number.NaN)).toBeUndefined()
    expect(percentCellBackground(Number.POSITIVE_INFINITY)).toBeUndefined()
  })
})
