import { describe, it, expect } from 'vitest'
import { gradientRedToGreen } from '../gradient'

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

  it('honours an explicit scale (report tables colour over their own bounds)', () => {
    expect(gradientRedToGreen(0, 0, 1000)).toBe('hsl(0, 70%, 85%)')
    expect(gradientRedToGreen(500, 0, 1000)).toBe('hsl(60, 70%, 85%)')
    expect(gradientRedToGreen(1000, 0, 1000)).toBe('hsl(120, 70%, 85%)')
  })
})
